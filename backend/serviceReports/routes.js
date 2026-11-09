const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const d = require("./domain");
const { Repository } = require("./repository");
const { brandingFromSettings, renderPdf } = require("./pdf");
const security = require("../lib/security");
const { directory, loadDirectory, resolveUser } = require("./employeeIdentity");
const json = (value) => {
  try {
    return d.parse(value) || {};
  } catch {
    return {};
  }
};
const fileView = (f) => {
  const {
    storage_key,
    preview_storage_key,
    signed_content_hash,
    report_id,
    ...safe
  } = f;
  return safe;
};
const editable = (r) => {
  if (!["Draft", "Revision Required"].includes(r.status))
    d.fail(409, "Only drafts and reports requiring revision can be edited");
};
const revision = (req, r) => {
  if (Number(req.body.revision) !== r.revision)
    d.fail(409, "This report changed. Reload it before continuing.");
};
function createServiceReportRouter({
  getConnection,
  loadSettings,
  resolveAsset,
  privateRoot,
  publicRoots = [],
}) {
  const router = express.Router(),
    repo = new Repository(getConnection);
  const realLocation = (target) =>
    fs.existsSync(target)
      ? fs.realpathSync(target)
      : path.join(realLocation(path.dirname(target)), path.basename(target));
  const root = realLocation(path.resolve(privateRoot));
  if (
    publicRoots.some((folder) => {
      const p = realLocation(path.resolve(folder));
      return root === p || root.startsWith(p + path.sep);
    })
  )
    throw new Error(
      "Service Report evidence must be outside public/static storage",
    );
  const asyncRoute = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  const assetPath = (f) => {
    if (!/^[a-f0-9-]{36}(-preview)?\.(png|jpg|webp|pdf)$/.test(f.storage_key))
      d.fail(404, "File unavailable");
    const file = path.resolve(root, f.storage_key);
    if (!file.startsWith(root + path.sep)) d.fail(404, "File unavailable");
    return file;
  };
  const readFile = (f, original = false) => {
    const preview = !original && f.preview_storage_key;
    const file = assetPath(
      preview ? { ...f, storage_key: f.preview_storage_key } : f,
    );
    if (!fs.existsSync(file)) d.fail(422, "Evidence file unavailable");
    const bytes = fs.readFileSync(file);
    if (d.hash(bytes) !== (preview ? f.preview_sha256 : f.sha256))
      d.fail(422, "Evidence integrity check failed");
    return bytes;
  };
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!req.portalUser || req.documentShare)
      return res
        .status(401)
        .json({ error: "Authenticated staff session required" });
    next();
  });
  router.use(
    asyncRoute(async (req, res, next) => {
      const identity = await repo.read((c) => resolveUser(c, req.portalUser));
      req.portalUser = { ...req.portalUser, serviceReportIdentity: identity };
      next();
    }),
  );
  router.get(
    "/capabilities",
    asyncRoute(async (req, res) =>
      res.json(await repo.read((c) => repo.permission(c, req.portalUser))),
    ),
  );
  router.get(
    "/schema",
    asyncRoute(async (req, res) => {
      await repo.read((c) => repo.authorize(c, req.portalUser, "view"));
      res.json(d.schema);
    }),
  );
  router.get(
    "/permissions",
    asyncRoute(async (req, res) => {
      if (!security.isAdmin(req.portalUser))
        d.fail(403, "Administrator access required");
      res.json(
        await repo.read(async (c) => {
          const [rows] = await c.query(
            "SELECT * FROM service_report_permissions",
          );
          const employees = await loadDirectory(c);
          return rows.map((row) => {
            let canonicalId = null;
            try {
              canonicalId = employees.resolve(row.employee_id).canonicalId;
            } catch {
              /* Retain unresolved grants for explicit administrator review. */
            }
            return {
              ...row,
              canonical_employee_id: canonicalId,
              capabilities: json(row.capabilities),
            };
          });
        }),
      );
    }),
  );
  router.put(
    "/permissions/:employeeId",
    asyncRoute(async (req, res) => {
      if (!security.isAdmin(req.portalUser))
        d.fail(403, "Administrator access required");
      const caps = req.body.capabilities;
      if (
        !Array.isArray(caps) ||
        caps.some((v) => !d.capabilities.includes(v)) ||
        !["all", "assigned"].includes(req.body.scope)
      )
        d.fail(422, "Invalid capabilities or scope");
      await repo.transaction(async (c) => {
        const employees = await loadDirectory(c);
        const employee = employees.resolve(req.params.employeeId);
        // A case/accent-insensitive grant key must never overwrite another employee.
        const [existing] = await c.query(
          "SELECT employee_id FROM service_report_permissions WHERE employee_id=? FOR UPDATE",
          [employee.canonicalId],
        );
        for (const grant of existing) {
          try {
            if (
              employees.resolve(grant.employee_id).canonicalId !==
              employee.canonicalId
            )
              throw new Error("conflict");
          } catch {
            d.fail(
              409,
              "Employee permission identifier conflicts with another stored identity. Existing permissions were preserved.",
            );
          }
        }
        await c.query(
          "INSERT INTO service_report_permissions (employee_id,capabilities,access_scope,updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE employee_id=VALUES(employee_id),capabilities=VALUES(capabilities),access_scope=VALUES(access_scope),updated_by=VALUES(updated_by)",
          [
            employee.canonicalId,
            JSON.stringify([...new Set(caps)]),
            req.body.scope,
            d.actorId(req.portalUser),
          ],
        );
      });
      res.json({ success: true });
    }),
  );
  async function context(c, user) {
    const grant = await repo.authorize(c, user, "view");
    const optional = (sql) =>
      c.query(sql).catch((error) => {
        if (error.code === "ER_NO_SUCH_TABLE") return [[]];
        throw error;
      });
    const [
      [customerRows],
      [jobRows],
      [invoiceRows],
      [contractRows],
      [premiseRows],
      [employeeRows],
      [itemRows],
    ] = await Promise.all([
      c.query("SELECT id,external_id,payload FROM customers"),
      c.query(
        "SELECT id,external_id,customer_external_id,invoice_external_id,payload FROM jobs",
      ),
      c.query("SELECT id,external_id,payload FROM invoices"),
      optional(
        "SELECT id,external_id,customer_external_id,contract_number,payload FROM contracts",
      ),
      optional(
        "SELECT id,premise_id,customer_id,premise_label,address_line_1,area_name,city,state,pincode,contact_person,mobile,email FROM customer_premises WHERE is_active=1",
      ),
      c.query("SELECT * FROM employees"),
      optional("SELECT external_id,payload FROM items"),
    ]);
    const employeeDirectory = directory(employeeRows);
    const jobs = jobRows
      .map((row) => {
        const p = json(row.payload);
        return {
          id: String(row.external_id),
          customerId: String(row.customer_external_id || p.customerId || ""),
          invoiceId: String(
            row.invoice_external_id || p.invoiceId || p.contractId || "",
          ),
          name: String(p.jobNumber || p.jobCardNumber || row.external_id),
          technicianIds: p.technicianIds || [],
          technicians: p.technicians || p.assignedTechnicians || [],
          assignedTo: p.assignedTo,
          technicianId: p.technicianId,
          technicianName: p.technicianName,
          technician_name: p.technicianName,
          serviceType: p.serviceType || p.serviceName || "",
          siteAddress: p.siteAddress || p.address || "",
          premiseId: p.premiseId || "",
        };
      })
      .filter(
        (job) =>
          grant.access_scope === "all" ||
          [
            ...(Array.isArray(job.technicianIds) ? job.technicianIds : []),
            job.technicianId,
          ].some((v) => d.actorIds(user).includes(String(v))),
      );
    const customerIds = new Set(jobs.map((j) => j.customerId));
    const customers = customerRows
      .filter(
        (row) =>
          grant.access_scope === "all" ||
          customerIds.has(String(row.external_id)),
      )
      .map((row) => {
        const p = json(row.payload);
        return {
          id: String(row.external_id),
          rowId: String(row.id),
          name: String(p.displayName || p.customerName || p.companyName || ""),
          siteAddress: String(
            p.shippingAddress || p.billingAddress || p.address || "",
          ),
          contactPerson: String(p.contactPersonName || ""),
          mobile: String(p.mobileNumber || p.workPhone || ""),
          email: String(p.emailId || p.email || ""),
        };
      });
    const permitted = new Set(customers.map((x) => x.id)),
      rowToExternal = new Map(customers.map((x) => [x.rowId, x.id]));
    const invoices = invoiceRows
      .map((row) => {
        const p = json(row.payload);
        return {
          id: String(row.external_id),
          source: "invoice",
          customerId: String(p.customerId || ""),
          name: String(p.invoiceNumber || row.external_id),
          companyType: d.companyTypeForInvoice(p),
          schedules: (p.serviceSchedules || []).map((s, i) => ({
            id: `${row.external_id}-${s.serviceDate}-${s.serviceNumber}-${i}`,
            date: s.serviceDate,
            number: s.serviceNumber,
            serviceType: s.itemName || "",
          })),
        };
      })
      .filter((x) => permitted.has(x.customerId));
    return {
      customers,
      jobs: jobs.filter((j) => permitted.has(j.customerId)),
      contracts: [
        ...invoices,
        ...contractRows
          .map((row) => ({
            id: String(row.external_id || row.id),
            source: "contract",
            customerId: String(row.customer_external_id || ""),
            name: String(row.contract_number || row.external_id || row.id),
          }))
          .filter((x) => permitted.has(x.customerId)),
      ],
      premises: premiseRows
        .filter((p) => rowToExternal.has(String(p.customer_id)))
        .map((p) => ({
          id: p.premise_id,
          customerId: rowToExternal.get(String(p.customer_id)),
          name: p.premise_label || p.premise_id,
          address: [p.address_line_1, p.area_name, p.city, p.state, p.pincode]
            .filter(Boolean)
            .join(", "),
          contactPerson: p.contact_person,
          mobile: p.mobile,
          email: p.email,
        })),
      employees: employeeRows.flatMap((row) => {
        try {
          const e = employeeDirectory.resolve(
            json(row.payload)._id ||
              row.external_id ||
              String(row.service_report_row_id ?? row.id),
          );
          return [
            {
              id: e.canonicalId,
              externalId: row.external_id,
              name: e.name,
              code: e.code,
            },
          ];
        } catch (error) {
          if ([403, 409].includes(error.status)) return [];
          throw error;
        }
      }),
      pests: [
        ...new Set(
          itemRows.flatMap((row) => {
            const p = json(row.payload);
            const values =
              p.pestsCovered || p.pests_covered || p.pestName || p.pest || [];
            return Array.isArray(values)
              ? values.map(String)
              : String(values)
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
          }),
        ),
      ],
      services: itemRows
        .map((row) => {
          const p = json(row.payload);
          return {
            id: row.external_id,
            name: p.itemName || p.name || "",
            type: p.itemType || p.type || "",
          };
        })
        .filter((x) => x.name),
    };
  }
  async function validateLinks(c, user, content, captureSnapshot = true) {
    const ctx = await context(c, user),
      links = content.links;
    const customer = ctx.customers.find((x) => x.id === links.customerId);
    if (!customer)
      d.fail(
        422,
        "Select an authorised CRM customer. Lead IDs are not accepted.",
      );
    if (
      links.premiseId &&
      !ctx.premises.some(
        (p) => p.id === links.premiseId && p.customerId === customer.id,
      )
    )
      d.fail(422, "Site does not belong to this customer");
    const job =
      links.jobId &&
      ctx.jobs.find(
        (j) => j.id === links.jobId && j.customerId === customer.id,
      );
    if (links.jobId && !job)
      d.fail(422, "Job does not belong to this customer or your scope");
    if (job?.premiseId && links.premiseId && job.premiseId !== links.premiseId)
      d.fail(422, "Job and selected site do not match");
    const contract =
      links.contractReference &&
      ctx.contracts.find(
        (x) =>
          x.id === links.contractReference &&
          x.source === links.contractSource &&
          x.customerId === customer.id,
      );
    if (links.contractReference && !contract)
      d.fail(422, "Contract reference does not belong to this customer");
    if (
      contract?.source === "invoice" &&
      contract.companyType !== content.header.companyType
    )
      d.fail(422, "Company identity must match the linked invoice");
    if (
      links.scheduleReference &&
      (!contract ||
        !contract.schedules?.some((s) => s.id === links.scheduleReference))
    )
      d.fail(422, "Schedule does not belong to the selected invoice contract");
    if (
      job?.invoiceId &&
      contract?.source === "invoice" &&
      job.invoiceId !== contract.id
    )
      d.fail(422, "Job and contract do not match");
    if (content.assignees.some((id) => !ctx.employees.some((e) => e.id === id)))
      d.fail(422, "Select existing employees");
    if (captureSnapshot)
      content.sourceContext = {
        customer: { id: customer.id, name: customer.name },
        assignees: ctx.employees
          .filter((employee) => content.assignees.includes(employee.id))
          .map(({ id, name, code }) => ({ id, name, code })),
        site: ctx.premises.find((p) => p.id === links.premiseId) || null,
        job: job
          ? { id: job.id, name: job.name, invoiceId: job.invoiceId }
          : null,
        contract: contract
          ? { id: contract.id, name: contract.name, source: contract.source }
          : null,
        schedule:
          contract?.schedules?.find((s) => s.id === links.scheduleReference) ||
          null,
      };
    return content;
  }
  router.get(
    "/lookups",
    asyncRoute(async (req, res) =>
      res.json(await repo.read((c) => context(c, req.portalUser))),
    ),
  );
  router.get(
    "/",
    asyncRoute(async (req, res) =>
      res.json(await repo.read((c) => repo.list(c, req.portalUser, req.query))),
    ),
  );
  router.post(
    "/",
    asyncRoute(async (req, res) => {
      const key = d.text(
        req.get("Idempotency-Key") || req.body.requestKey,
        100,
      );
      if (!/^[\w-]{8,100}$/.test(key))
        d.fail(422, "A unique request key is required");
      const content = d.normalize(req.body.content);
      const r = await repo.transaction(async (c) => {
        await repo.authorize(c, req.portalUser, "create");
        await validateLinks(c, req.portalUser, content);
        return repo.create(c, req.portalUser, content, key);
      }, 3);
      res.status(201).json(r);
    }),
  );
  router.get(
    "/:id",
    asyncRoute(async (req, res) =>
      res.json(
        await repo.read(async (c) => {
          const r = await repo.get(c, req.params.id);
          const grant = await repo.authorize(c, req.portalUser, "view", r);
          return {
            ...r,
            files: (await repo.files(c, r.id)).map(fileView),
            capabilities: grant.capabilities,
            actions: repo.actions(req.portalUser, grant, r),
          };
        }),
      ),
    ),
  );
  router.put(
    "/:id",
    asyncRoute(async (req, res) =>
      res.json(
        await repo.transaction(async (c) => {
          const r = await repo.get(c, req.params.id, true);
          await repo.authorize(c, req.portalUser, "edit", r);
          editable(r);
          revision(req, r);
          const content = d.normalize(req.body.content);
          await validateLinks(c, req.portalUser, content);
          if (d.hash(content) !== d.hash(r.content)) {
            await c.query(
              "UPDATE service_report_files SET removed_at=CURRENT_TIMESTAMP(3) WHERE report_id=? AND removed_at IS NULL AND kind IN ('technicianSignature','customerSignature')",
              [r.id],
            );
          }
          r.revision++;
          r.last_edited_by = d.actorId(req.portalUser);
          r.contributors = [
            ...new Set([...r.contributors, d.actorId(req.portalUser)]),
          ];
          await repo.save(c, r, content);
          await repo.audit(c, req.portalUser, r, "edited", {
            previousContentHash: d.hash(r.content),
            contentHash: d.hash(content),
            before: r.content,
            after: content,
          });
          return repo.get(c, req.params.id);
        }),
      ),
    ),
  );
  router.get(
    "/:id/history",
    asyncRoute(async (req, res) =>
      res.json(
        await repo.read(async (c) => {
          const r = await repo.get(c, req.params.id);
          await repo.authorize(c, req.portalUser, "history", r);
          const [events] = await c.query(
            "SELECT actor_id,actor_name,action,revision,details,created_at FROM service_report_audit_logs WHERE report_id=? ORDER BY id DESC",
            [r.id],
          );
          const [versions] = await c.query(
            "SELECT id,revision,state,content_hash,created_by,created_at FROM service_report_versions WHERE report_id=? ORDER BY revision DESC",
            [r.id],
          );
          return { events, versions };
        }),
      ),
    ),
  );
  for (const action of ["submit", "approve", "request-revision", "revisions"])
    router.post(
      `/:id/${action}`,
      asyncRoute(async (req, res) => {
        let settings;
        if (action === "submit") {
          await repo.read(async (c) => {
            const current = await repo.get(c, req.params.id);
            await repo.authorize(c, req.portalUser, "submit", current);
          });
          settings = await loadSettings();
        }
        return res.json(
          await repo.transaction(async (c) => {
            const r = await repo.get(c, req.params.id, true);
            revision(req, r);
            await repo.authorize(
              c,
              req.portalUser,
              ["approve", "request-revision", "revisions"].includes(action)
                ? "review"
                : "submit",
              r,
            );
            let next;
            if (action === "submit") {
              editable(r);
              await validateLinks(c, req.portalUser, r.content, false);
              const files = await repo.files(c, r.id);
              d.validateSubmission(r.content, files);
              const digest = d.signatureHash(r.content, files);
              if (
                files.some(
                  (f) =>
                    f.kind.endsWith("Signature") &&
                    f.signed_content_hash !== digest,
                )
              )
                d.fail(
                  422,
                  "The report changed after signing. Capture signatures again.",
                );
              files.forEach((f) => readFile(f, true));
              next = "Submitted";
            } else if (action === "approve") {
              if (r.status !== "Submitted")
                d.fail(409, "Only submitted reports can be approved");
              if (
                [
                  r.created_by,
                  r.last_edited_by,
                  r.submitted_by,
                  ...r.contributors,
                ].some((id) =>
                  d.approvalConflictIds(req.portalUser).includes(String(id)),
                )
              )
                d.fail(
                  403,
                  "A different authorised reviewer must approve the report",
                );
              next = "Approved";
            } else if (action === "request-revision") {
              if (r.status !== "Submitted")
                d.fail(
                  409,
                  "Only submitted reports can be returned for revision",
                );
              if (!d.text(req.body.reason))
                d.fail(422, "Revision reason is required");
              next = "Revision Required";
            } else {
              if (r.status !== "Approved")
                d.fail(409, "Only approved reports need a new revision");
              if (!d.text(req.body.reason))
                d.fail(422, "Correction reason is required");
              next = "Revision Required";
            }
            r.revision++;
            if (["Submitted", "Approved"].includes(next)) {
              let branding;
              if (next === "Approved") {
                const [rows] = await c.query(
                  "SELECT snapshot FROM service_report_versions WHERE report_id=? AND state='Submitted' ORDER BY revision DESC LIMIT 1",
                  [r.id],
                );
                if (!rows.length) d.fail(409, "Submitted version unavailable");
                const submitted = json(rows[0].snapshot);
                if (d.hash(submitted.content) !== d.hash(r.content))
                  d.fail(409, "Submitted content differs from current report");
                branding = submitted.branding;
              } else
                branding = brandingFromSettings(
                  settings,
                  r.company_type,
                  resolveAsset,
                );
              const v = await repo.version(
                c,
                req.portalUser,
                r,
                next,
                branding,
              );
              if (next === "Approved")
                await c.query(
                  "UPDATE service_reports SET approved_version_id=? WHERE id=?",
                  [v.id, r.id],
                );
            }
            if (action === "revisions")
              await c.query(
                "UPDATE service_report_files SET removed_at=CURRENT_TIMESTAMP(3) WHERE report_id=? AND removed_at IS NULL AND kind IN ('technicianSignature','customerSignature')",
                [r.id],
              );
            if (action === "revisions")
              await c.query(
                "UPDATE service_reports SET contributors=JSON_ARRAY() WHERE id=?",
                [r.id],
              );
            await c.query(
              "UPDATE service_reports SET status=?,revision=?,submitted_by=CASE WHEN ?='Submitted' THEN ? ELSE submitted_by END WHERE id=?",
              [next, r.revision, next, d.actorId(req.portalUser), r.id],
            );
            await repo.audit(c, req.portalUser, r, action, {
              from: r.status,
              to: next,
              reason: d.text(req.body.reason),
            });
            return repo.get(c, req.params.id);
          }),
        );
      }),
    );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: d.MAX_FILE_BYTES,
      files: 1,
      fields: 15,
      fieldSize: 8000,
    },
  }).single("file");
  router.post(
    "/:id/files",
    asyncRoute(async (req, res) => {
      await repo.read((c) => repo.authorize(c, req.portalUser, "edit", null));
      await new Promise((resolve, reject) =>
        upload(req, res, (e) => (e ? reject(e) : resolve())),
      );
      const written = [];
      try {
        const output = await repo.transaction(async (c) => {
          const r = await repo.get(c, req.params.id, true);
          await repo.authorize(c, req.portalUser, "edit", r);
          editable(r);
          revision(req, r);
          if (!req.file) d.fail(422, "Choose a file");
          const [mime, ext] = d.fileType(req.file.buffer),
            kind = d.text(req.body.kind, 20);
          if (!d.fileKinds.includes(kind))
            d.fail(422, "Invalid evidence category");
          if (
            (kind === "photo" || kind.endsWith("Signature")) &&
            !mime.startsWith("image/")
          )
            d.fail(422, "Photos and signatures must be images");
          if (
            !req.file.originalname.toLowerCase().endsWith(ext) &&
            !(
              ext === ".jpg" &&
              req.file.originalname.toLowerCase().endsWith(".jpeg")
            )
          )
            d.fail(422, "File extension must match its content");
          const category = d.text(req.body.category, 80),
            section = d.schema.sections.find((s) => s.fileKind === kind);
          if (section && !section.categories.includes(category))
            d.fail(422, "Choose a valid evidence category");
          let preview;
          if (mime.startsWith("image/")) {
            try {
              const image = sharp(req.file.buffer, {
                limitInputPixels: 25000000,
                failOn: "warning",
              });
              await image.stats();
              if (!kind.endsWith("Signature"))
                preview = await image
                  .rotate()
                  .resize({
                    width: 1600,
                    height: 1600,
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .flatten({ background: "#ffffff" })
                  .jpeg({ quality: 82 })
                  .toBuffer();
            } catch {
              d.fail(422, "Image is invalid or exceeds 25 megapixels");
            }
          }
          const files = await repo.files(c, r.id),
            retained = await repo.files(c, r.id, true);
          if (
            files.length >= 50 ||
            retained.reduce(
              (n, f) =>
                n + Number(f.byte_size) + Number(f.preview_byte_size || 0),
              0,
            ) +
              req.file.size +
              (preview?.length || 0) >
              d.MAX_REPORT_BYTES
          )
            d.fail(422, "Maximum 50 files and 80 MB per report");
          const signature = kind.endsWith("Signature");
          if (signature) {
            const name =
              kind === "technicianSignature"
                ? r.content.acknowledgement.technicianName
                : r.content.acknowledgement.customerName;
            if (!name)
              d.fail(
                422,
                "Save the signatory name before capturing a signature",
              );
          }
          const id = crypto.randomUUID(),
            storageKey = id + ext;
          fs.mkdirSync(root, { recursive: true, mode: 0o700 });
          const originalPath = path.join(root, storageKey);
          fs.writeFileSync(originalPath, req.file.buffer, {
            flag: "wx",
            mode: 0o600,
          });
          written.push(originalPath);
          const previewKey = preview ? `${id}-preview.jpg` : null;
          if (preview) {
            const previewPath = path.join(root, previewKey);
            fs.writeFileSync(previewPath, preview, { flag: "wx", mode: 0o600 });
            written.push(previewPath);
          }
          const signedHash = signature
            ? d.signatureHash(r.content, files)
            : null;
          if (signature)
            await c.query(
              "UPDATE service_report_files SET removed_at=CURRENT_TIMESTAMP(3) WHERE report_id=? AND kind=? AND removed_at IS NULL",
              [r.id, kind],
            );
          else
            await c.query(
              "UPDATE service_report_files SET removed_at=CURRENT_TIMESTAMP(3) WHERE report_id=? AND removed_at IS NULL AND kind IN ('technicianSignature','customerSignature')",
              [r.id],
            );
          await c.query(
            "INSERT INTO service_report_files (id,report_id,kind,category,caption,area,annotations,captured_at,display_order,include_in_pdf,original_name,storage_key,mime_type,byte_size,sha256,signed_content_hash,uploaded_by,preview_storage_key,preview_sha256,preview_byte_size) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [
              id,
              r.id,
              kind,
              category || kind,
              d.text(req.body.caption),
              d.text(req.body.area, 255),
              d.text(req.body.annotations),
              d.text(req.body.capturedAt, 40) || null,
              Number(req.body.displayOrder) || 0,
              signature ? 1 : req.body.includeInPdf === "false" ? 0 : 1,
              path.basename(req.file.originalname).slice(0, 255),
              storageKey,
              mime,
              req.file.size,
              d.hash(req.file.buffer),
              signedHash,
              d.actorId(req.portalUser),
              previewKey,
              preview ? d.hash(preview) : null,
              preview?.length || null,
            ],
          );
          r.revision++;
          await c.query(
            "UPDATE service_reports SET revision=?,last_edited_by=?,contributors=CASE WHEN JSON_CONTAINS(contributors,JSON_QUOTE(?)) THEN contributors ELSE JSON_ARRAY_APPEND(contributors,'$',?) END WHERE id=?",
            [
              r.revision,
              d.actorId(req.portalUser),
              d.actorId(req.portalUser),
              d.actorId(req.portalUser),
              r.id,
            ],
          );
          await repo.audit(c, req.portalUser, r, "file-added", {
            fileId: id,
            kind,
            sha256: d.hash(req.file.buffer),
          });
          return {
            revision: r.revision,
            file: fileView(
              (await repo.files(c, r.id)).find((f) => f.id === id),
            ),
          };
        });
        written.length = 0;
        res.status(201).json(output);
      } catch (e) {
        written.forEach((file) => fs.rmSync(file, { force: true }));
        throw e;
      }
    }),
  );
  router.get(
    "/:id/files/:fileId",
    asyncRoute(async (req, res) => {
      const file = await repo.read(async (c) => {
        const r = await repo.get(c, req.params.id);
        await repo.authorize(c, req.portalUser, "view", r);
        const [files] = await c.query(
          "SELECT * FROM service_report_files WHERE id=? AND report_id=?",
          [req.params.fileId, r.id],
        );
        if (!files[0]) d.fail(404, "File not found");
        return files[0];
      });
      const bytes = readFile(file, req.query.preview !== "1");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="evidence-${file.id}${path.extname(file.storage_key)}"`,
      );
      res
        .type(
          req.query.preview === "1" && file.preview_storage_key
            ? "image/jpeg"
            : file.mime_type,
        )
        .send(bytes);
    }),
  );
  router.delete(
    "/:id/files/:fileId",
    asyncRoute(async (req, res) =>
      res.json(
        await repo.transaction(async (c) => {
          const r = await repo.get(c, req.params.id, true);
          await repo.authorize(c, req.portalUser, "edit", r);
          editable(r);
          revision(req, r);
          const files = await repo.files(c, r.id);
          if (!files.some((f) => f.id === req.params.fileId))
            d.fail(404, "File not found");
          await c.query(
            "UPDATE service_report_files SET removed_at=CURRENT_TIMESTAMP(3) WHERE report_id=? AND removed_at IS NULL AND (id=? OR kind IN ('technicianSignature','customerSignature'))",
            [r.id, req.params.fileId],
          );
          r.revision++;
          await c.query(
            "UPDATE service_reports SET revision=?,last_edited_by=?,contributors=CASE WHEN JSON_CONTAINS(contributors,JSON_QUOTE(?)) THEN contributors ELSE JSON_ARRAY_APPEND(contributors,'$',?) END WHERE id=?",
            [
              r.revision,
              d.actorId(req.portalUser),
              d.actorId(req.portalUser),
              d.actorId(req.portalUser),
              r.id,
            ],
          );
          await repo.audit(c, req.portalUser, r, "file-removed", {
            fileId: req.params.fileId,
          });
          return { revision: r.revision };
        }),
      ),
    ),
  );
  router.get(
    "/:id/pdf",
    asyncRoute(async (req, res) => {
      let newFile;
      try {
        // Release the feature connection before loading settings through the existing pool.
        const initial = await repo.read(async (c) => {
          const current = await repo.get(c, req.params.id);
          await repo.authorize(c, req.portalUser, "pdf", current);
          if (req.query.share === "1")
            await repo.authorize(c, req.portalUser, "share", current);
          return current;
        });
        const settings =
          !req.query.version && initial.status !== "Approved"
            ? await loadSettings()
            : null;
        const result = await repo.transaction(async (c) => {
          const r = await repo.get(c, req.params.id);
          await repo.authorize(c, req.portalUser, "pdf", r);
          if (req.query.share === "1")
            await repo.authorize(c, req.portalUser, "share", r);
          let version;
          if (req.query.version) {
            const [rows] = await c.query(
              "SELECT * FROM service_report_versions WHERE report_id=? AND revision=? FOR UPDATE",
              [r.id, Number(req.query.version)],
            );
            if (!rows.length) d.fail(404, "Version not found");
            version = rows[0];
          } else if (r.status === "Approved") {
            const [rows] = await c.query(
              "SELECT * FROM service_report_versions WHERE id=? AND report_id=? FOR UPDATE",
              [r.approved_version_id, r.id],
            );
            version = rows[0];
            if (!version) d.fail(409, "Approved version unavailable");
          }
          const snapshot = version
            ? json(version.snapshot)
            : {
                reportNumber: r.report_number,
                preparedBy: r.prepared_by,
                content: r.content,
                files: await repo.files(c, r.id),
                branding: brandingFromSettings(
                  settings ||
                    d.fail(
                      409,
                      "Report changed. Reload before generating the PDF.",
                    ),
                  r.company_type,
                  resolveAsset,
                ),
                state: r.status,
                revision: r.revision,
                recordedAt: new Date().toISOString(),
              };
          if (version && d.hash(snapshot) !== version.content_hash)
            d.fail(422, "Version integrity check failed");
          let buffer;
          if (version?.pdf_storage_key) {
            if (!/^pdf-[a-f0-9-]{36}\.pdf$/.test(version.pdf_storage_key))
              d.fail(422, "PDF storage key invalid");
            buffer = fs.readFileSync(path.join(root, version.pdf_storage_key));
            if (d.hash(buffer) !== version.pdf_sha256)
              d.fail(422, "Preserved PDF integrity check failed");
          } else {
            buffer = await renderPdf(snapshot, { readFile });
            if (version) {
              fs.mkdirSync(root, { recursive: true, mode: 0o700 });
              const key = `pdf-${crypto.randomUUID()}.pdf`;
              newFile = path.join(root, key);
              fs.writeFileSync(newFile, buffer, { flag: "wx", mode: 0o600 });
              await c.query(
                "UPDATE service_report_versions SET pdf_storage_key=?,pdf_sha256=? WHERE id=?",
                [key, d.hash(buffer), version.id],
              );
            }
          }
          await repo.audit(c, req.portalUser, r, "pdf-downloaded", {
            version: snapshot.revision,
            state: snapshot.state,
          });
          return { buffer, snapshot };
        });
        newFile = null;
        res
          .type("application/pdf")
          .set(
            "Content-Disposition",
            `inline; filename="${result.snapshot.reportNumber}-v${result.snapshot.revision}.pdf"`,
          )
          .send(result.buffer);
      } catch (error) {
        if (newFile) fs.rmSync(newFile, { force: true });
        throw error;
      }
    }),
  );
  router.use((err, req, res, next) => {
    void next;
    const status =
      err.status || (err instanceof multer.MulterError ? 422 : 500);
    if (status === 500)
      console.error("[service-reports] request failed", err.code || "internal");
    res.status(status).json({
      error:
        status === 500
          ? "Service Reports unavailable. Verify the explicit migration and configuration."
          : err.message,
      ...(err.fields ? { fields: err.fields } : {}),
    });
  });
  return router;
}
module.exports = { createServiceReportRouter };
