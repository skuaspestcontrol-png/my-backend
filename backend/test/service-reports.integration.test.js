const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { fixture } = require("./service-reports-fixtures");
const { start } = require("../scripts/service-reports/local-server");
const { root } = require("../scripts/service-reports/local-fixture");
const d = require("../serviceReports/domain");

test(
  "Service Reports: isolated MySQL and authenticated HTTP lifecycle",
  { skip: process.env.SERVICE_REPORT_LOCAL_QA !== "1" },
  async (t) => {
    const env = await start({ reset: true, port: 5189 }),
      url = "http://127.0.0.1:5189/api/service-reports";
    const req = async (method, payloadPath, body, user = "technician") => {
      const r = await fetch(url + payloadPath, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:5189",
          ...(user ? { Cookie: env.cookie(user) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    const create = async (
      content = fixture(),
      requestKey = crypto.randomUUID(),
      user = "technician",
    ) => req("POST", "/", { content, requestKey }, user);
    const upload = async (
      report,
      kind = "technicianSignature",
      fileName = "signature.png",
      buffer,
      user = "technician",
    ) => {
      const f = new FormData();
      f.append(
        "file",
        new Blob(
          [
            buffer ||
              fs.readFileSync(
                path.join(__dirname, "fixtures/service-reports/signature.png"),
              ),
          ],
          { type: "image/png" },
        ),
        fileName,
      );
      f.append("kind", kind);
      f.append("category", kind === "photo" ? "Before Treatment" : kind);
      f.append("caption", "SYNTHETIC QA fixture — no actual treatment");
      f.append("includeInPdf", "true");
      f.append("revision", report.revision);
      const r = await fetch(url + `/${report.external_id}/files`, {
        method: "POST",
        headers: {
          Cookie: env.cookie(user),
          Origin: "http://127.0.0.1:5189",
        },
        body: f,
      });
      return { status: r.status, body: await r.json() };
    };
    let r;
    try {
      await t.test("unauthenticated requests fail", async () =>
        assert.equal((await req("GET", "/", null, null)).status, 401),
      );
      await t.test(
        "cookie writes require an allowed request origin",
        async () => {
          const response = await fetch(url + "/", {
            method: "POST",
            headers: {
              Cookie: env.cookie("technician"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: fixture(),
              requestKey: crypto.randomUUID(),
            }),
          });
          assert.equal(response.status, 403);
        },
      );
      await t.test("migrations preserve existing master tables", async () => {
        const [rows] = await env.pool.query("SELECT COUNT(*) n FROM customers");
        assert.equal(rows[0].n, 2);
      });
      await t.test(
        "lookups resolve real customers and assigned jobs",
        async () => {
          const x = await req("GET", "/lookups");
          assert.equal(x.status, 200);
          assert.equal(x.body.customers.length, 1);
          assert.equal(x.body.customers[0].id, "QA-CUSTOMER-1");
        },
      );
      await t.test(
        "a lead ID is never accepted as customer identity",
        async () => {
          const c = fixture();
          c.links.customerId = "QA-CONVERTED-LEAD-1";
          assert.equal((await create(c)).status, 422);
        },
      );
      await t.test("site and job mismatches fail", async () => {
        for (const key of [
          "premiseId",
          "jobId",
          "contractReference",
          "scheduleReference",
        ]) {
          const c = fixture();
          c.links[key] = "WRONG";
          assert.equal((await create(c)).status, 422, key);
        }
        const standalone = fixture();
        standalone.links.jobId = "";
        standalone.links.contractSource = "contract";
        standalone.links.contractReference = "1";
        standalone.links.scheduleReference = "";
        const saved = await create(standalone);
        assert.equal(saved.status, 201, JSON.stringify(saved));
        assert.equal(
          saved.body.content.sourceContext.contract.name,
          "QA/CONTRACT/1",
        );
      });
      await t.test("linked invoice company identity is enforced", async () => {
        const c = fixture();
        c.header.companyType = "NON_GST";
        assert.equal((await create(c)).status, 422);
        assert.equal((await create(fixture("NON_GST"))).status, 201);
        const legacy = fixture("NON_GST");
        legacy.links.contractReference = "QA-LEGACY-NON-GST";
        legacy.links.scheduleReference = "";
        assert.equal((await create(legacy)).status, 201);
        legacy.header.companyType = "GST";
        assert.equal((await create(legacy)).status, 422);
      });
      await t.test(
        "draft creation assigns server number and authenticated preparer",
        async () => {
          const x = await create();
          assert.equal(x.status, 201, JSON.stringify(x));
          r = x.body;
          assert.match(r.report_number, /^SR-\d{7}$/);
          assert.equal(r.created_by, "QA-EMP-2");
          assert.equal(r.prepared_by, "QA Technician");
          assert.equal(r.service_date, "2026-11-07");
        },
      );
      await t.test(
        "concurrent identical retries return one draft",
        async () => {
          const key = crypto.randomUUID();
          const rows = await Promise.all(
            Array.from({ length: 4 }, () => create(fixture(), key)),
          );
          assert(rows.every((x) => x.status === 201));
          assert.equal(new Set(rows.map((x) => x.body.external_id)).size, 1);
          const other = fixture();
          other.summary.remarks = "Different";
          assert.equal((await create(other, key)).status, 409);
        },
      );
      await t.test(
        "concurrent distinct creates receive unique report numbers",
        async () => {
          const rows = await Promise.all(
            Array.from({ length: 4 }, () => create()),
          );
          assert.equal(new Set(rows.map((x) => x.body.report_number)).size, 4);
        },
      );
      await t.test(
        "unassigned employee cannot view report or files",
        async () =>
          assert.equal(
            (await req("GET", `/${r.external_id}`, null, "other")).status,
            403,
          ),
      );
      await t.test("staff cannot approve or assign permissions", async () => {
        assert.equal(
          (
            await req("POST", `/${r.external_id}/approve`, {
              revision: r.revision,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req("PUT", "/permissions/4", {
              capabilities: ["review"],
              scope: "all",
            })
          ).status,
          403,
        );
      });
      await t.test(
        "administrator grants use canonical ERP employee identities and revocation is immediate",
        async () => {
          assert.equal(
            (
              await req(
                "PUT",
                "/permissions/QA-EMP-4",
                {
                  capabilities: ["view", "history", "edit", "submit"],
                  scope: "all",
                },
                "manager",
              )
            ).status,
            200,
          );
          assert.equal(
            (await req("GET", `/${r.external_id}`, null, "other")).status,
            200,
          );
          const visible = await req("GET", `/${r.external_id}`, null, "other");
          assert.equal(visible.body.actions.edit, false);
          assert.equal(
            (
              await req(
                "PUT",
                `/${r.external_id}`,
                { revision: r.revision, content: r.content },
                "other",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await req(
                "POST",
                `/${r.external_id}/submit`,
                { revision: r.revision },
                "other",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await upload(
                r,
                "technicianSignature",
                "signature.png",
                undefined,
                "other",
              )
            ).status,
            403,
          );

          assert.equal(
            (
              await req(
                "PUT",
                "/permissions/QA-EMP-4",
                {
                  capabilities: ["view", "create", "edit", "submit", "history"],
                  scope: "assigned",
                },
                "manager",
              )
            ).status,
            200,
          );
          assert.equal(
            (await req("GET", `/${r.external_id}`, null, "other")).status,
            403,
          );
        },
      );
      await t.test(
        "self-approval is denied even to the existing administrator privilege",
        async () => {
          let own = (await create(fixture(), crypto.randomUUID(), "manager"))
            .body;
          assert.equal((await upload(own)).status, 201);
          own = (await req("GET", `/${own.external_id}`)).body;
          own = (
            await req(
              "POST",
              `/${own.external_id}/submit`,
              { revision: own.revision },
              "manager",
            )
          ).body;
          assert.equal(
            (
              await req(
                "POST",
                `/${own.external_id}/approve`,
                { revision: own.revision },
                "manager",
              )
            ).status,
            403,
          );
        },
      );
      await t.test(
        "contributors cannot approve their own changes after another staff member signs",
        async () => {
          let edited = (await create()).body;
          const change = structuredClone(edited.content);
          change.summary.remarks = "Manager clarification for synthetic QA";
          const saved = await req(
            "PUT",
            `/${edited.external_id}`,
            { revision: edited.revision, content: change },
            "manager",
          );
          assert.equal(saved.status, 200);
          edited = saved.body;
          assert.equal((await upload(edited)).status, 201);
          edited = (await req("GET", `/${edited.external_id}`)).body;
          const submitted = await req("POST", `/${edited.external_id}/submit`, {
            revision: edited.revision,
          });
          assert.equal(submitted.status, 200);
          edited = submitted.body;
          assert.equal(
            (
              await req(
                "POST",
                `/${edited.external_id}/approve`,
                { revision: edited.revision },
                "manager",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await req(
                "POST",
                `/${edited.external_id}/approve`,
                { revision: edited.revision },
                "reviewer",
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "stale draft writes fail and master records remain untouched",
        async () => {
          const before = (
            await env.pool.query("SELECT * FROM customers ORDER BY id")
          )[0];
          const content = fixture();
          content.header.contactPerson = "Report-only contact";
          const x = await req("PUT", `/${r.external_id}`, {
            revision: r.revision,
            content,
          });
          assert.equal(x.status, 200, JSON.stringify(x));
          assert.equal(
            (
              await req("PUT", `/${r.external_id}`, {
                revision: r.revision,
                content,
              })
            ).status,
            409,
          );
          r = x.body;
          assert.deepEqual(
            (await env.pool.query("SELECT * FROM customers ORDER BY id"))[0],
            before,
          );
        },
      );
      await t.test("missing signature blocks submission", async () =>
        assert.equal(
          (
            await req("POST", `/${r.external_id}/submit`, {
              revision: r.revision,
            })
          ).status,
          422,
        ),
      );
      await t.test("oversized evidence is rejected", async () =>
        assert.equal(
          (
            await upload(
              r,
              "photo",
              "oversized.png",
              Buffer.alloc(8 * 1024 * 1024 + 1),
            )
          ).status,
          422,
        ),
      );
      await t.test(
        "disguised file content fails without creating evidence",
        async () =>
          assert.equal(
            (
              await upload(
                r,
                "photo",
                "bad.png",
                Buffer.from("<script>bad</script>"),
              )
            ).status,
            422,
          ),
      );
      let photo;
      await t.test(
        "photographic evidence is private and authenticated",
        async () => {
          const x = await upload(
            r,
            "photo",
            "before.png",
            fs.readFileSync(
              path.join(__dirname, "fixtures/service-reports/photo.png"),
            ),
          );
          assert.equal(x.status, 201, JSON.stringify(x));
          photo = x.body.file;
          assert(photo.preview_sha256);
          assert(photo.preview_byte_size > 0);
          r = (await req("GET", `/${r.external_id}`)).body;
          assert(!("storage_key" in photo));
          assert.equal(
            (await fetch(url + `/${r.external_id}/files/${photo.id}`)).status,
            401,
          );
          assert.equal(
            (
              await fetch(url + `/${r.external_id}/files/${photo.id}`, {
                headers: { Cookie: env.cookie("other") },
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(url + `/${r.external_id}/files/${photo.id}`, {
                headers: { Cookie: env.cookie("technician") },
              })
            ).status,
            200,
          );
        },
      );
      await t.test("evidence integrity failure is detected", async () => {
        const [rows] = await env.pool.query(
          "SELECT storage_key FROM service_report_files WHERE id=?",
          [photo.id],
        );
        const filename = path.join(
            root,
            "private-evidence",
            rows[0].storage_key,
          ),
          original = fs.readFileSync(filename);
        try {
          fs.writeFileSync(filename, Buffer.from("tampered"));
          assert.equal(
            (
              await fetch(url + `/${r.external_id}/files/${photo.id}`, {
                headers: { Cookie: env.cookie("technician") },
              })
            ).status,
            422,
          );
        } finally {
          fs.writeFileSync(filename, original);
        }
      });
      await t.test(
        "signature capture binds current content and evidence",
        async () => {
          const x = await upload(r);
          assert.equal(x.status, 201, JSON.stringify(x));
          r = (await req("GET", `/${r.external_id}`)).body;
          assert(r.files.some((f) => f.kind === "technicianSignature"));
        },
      );
      await t.test(
        "editing invalidates current signatures and preserves original files",
        async () => {
          const content = r.content;
          content.summary.remarks = "Updated synthetic remarks";
          const x = await req("PUT", `/${r.external_id}`, {
            revision: r.revision,
            content,
          });
          assert.equal(x.status, 200);
          r = (await req("GET", `/${r.external_id}`)).body;
          assert(!r.files.some((f) => f.kind === "technicianSignature"));
          const [rows] = await env.pool.query(
            "SELECT * FROM service_report_files WHERE kind='technicianSignature'",
          );
          assert(rows.some((f) => f.removed_at));
          assert(
            rows.every((f) =>
              fs.existsSync(path.join(root, "private-evidence", f.storage_key)),
            ),
          );
        },
      );
      await t.test(
        "submit freezes a version and prevents further editing",
        async () => {
          assert.equal((await upload(r)).status, 201);
          r = (await req("GET", `/${r.external_id}`)).body;
          const x = await req("POST", `/${r.external_id}/submit`, {
            revision: r.revision,
          });
          assert.equal(x.status, 200, JSON.stringify(x));
          r = x.body;
          assert.equal(r.status, "Submitted");
          assert.equal(
            (
              await req("PUT", `/${r.external_id}`, {
                revision: r.revision,
                content: r.content,
              })
            ).status,
            409,
          );
        },
      );
      await t.test(
        "request revision requires a reason and records history",
        async () => {
          assert.equal(
            (
              await req(
                "POST",
                `/${r.external_id}/request-revision`,
                { revision: r.revision },
                "reviewer",
              )
            ).status,
            422,
          );
          const x = await req(
            "POST",
            `/${r.external_id}/request-revision`,
            { revision: r.revision, reason: "Clarify the synthetic finding" },
            "reviewer",
          );
          assert.equal(x.status, 200);
          r = x.body;
          assert.equal(r.status, "Revision Required");
        },
      );
      await t.test(
        "resubmission and approval preserve distinct immutable snapshots",
        async () => {
          let x = await req("POST", `/${r.external_id}/submit`, {
            revision: r.revision,
          });
          assert.equal(x.status, 200, JSON.stringify(x));
          r = x.body;
          x = await req(
            "POST",
            `/${r.external_id}/approve`,
            { revision: r.revision },
            "reviewer",
          );
          assert.equal(x.status, 200, JSON.stringify(x));
          r = x.body;
          assert.equal(r.status, "Approved");
          assert.equal(
            (
              await req("PUT", `/${r.external_id}`, {
                revision: r.revision,
                content: r.content,
              })
            ).status,
            409,
          );
        },
      );
      let approvedHash, pdfHash, version;
      await t.test(
        "approved PDF is cached privately and byte stable",
        async () => {
          const headers = { Cookie: env.cookie("reviewer") };
          const a = await fetch(url + `/${r.external_id}/pdf`, { headers });
          assert.equal(a.status, 200, await a.clone().text());
          const bytes = Buffer.from(await a.arrayBuffer());
          pdfHash = d.hash(bytes);
          assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
          fs.writeFileSync(path.join(root, "approved-gst.pdf"), bytes);
          const b = await fetch(url + `/${r.external_id}/pdf`, { headers });
          assert.equal(d.hash(Buffer.from(await b.arrayBuffer())), pdfHash);
          const [versions] = await env.pool.query(
            "SELECT * FROM service_report_versions WHERE state='Approved' AND report_id=?",
            [r.id],
          );
          version = versions[0].revision;
          approvedHash = versions[0].content_hash;
          assert.equal(versions[0].pdf_sha256, pdfHash);
        },
      );
      await t.test(
        "approved corrections preserve the previous version and PDF",
        async () => {
          const x = await req(
            "POST",
            `/${r.external_id}/revisions`,
            { revision: r.revision, reason: "Synthetic correction review" },
            "reviewer",
          );
          assert.equal(x.status, 200, JSON.stringify(x));
          r = x.body;
          assert.equal(r.status, "Revision Required");
          const [rows] = await env.pool.query(
            "SELECT * FROM service_report_versions WHERE state='Approved' AND report_id=?",
            [r.id],
          );
          assert.equal(rows[0].content_hash, approvedHash);
          const old = await fetch(
            url + `/${r.external_id}/pdf?version=${version}`,
            { headers: { Cookie: env.cookie("reviewer") } },
          );
          assert.equal(d.hash(Buffer.from(await old.arrayBuffer())), pdfHash);
        },
      );
      await t.test(
        "history includes creation, evidence, edits, submission, approval and correction",
        async () => {
          const x = await req("GET", `/${r.external_id}/history`);
          assert.equal(x.status, 200);
          for (const name of [
            "created",
            "file-added",
            "edited",
            "submit",
            "approve",
            "revisions",
          ])
            assert(
              x.body.events.some((e) => e.action === name),
              name,
            );
          assert.equal(x.body.versions.length, 3);
        },
      );
      await t.test(
        "pagination and real-record metrics share permission scope",
        async () => {
          const x = await req("GET", "/?limit=2&page=1");
          assert.equal(x.body.items.length, 2);
          assert(x.body.total >= 6);
          const other = await req("GET", "/", null, "other");
          assert.equal(other.body.total, 0);
        },
      );
      await t.test(
        "foreign evidence IDs cannot be retrieved through another report",
        async () => {
          const another = (await create()).body;
          assert.equal(
            (
              await fetch(url + `/${another.external_id}/files/${photo.id}`, {
                headers: { Cookie: env.cookie("technician") },
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        "master updates do not rewrite a signed report snapshot",
        async () => {
          let historical = (await create()).body;
          await upload(historical);
          historical = (await req("GET", `/${historical.external_id}`)).body;
          const [original] = await env.pool.query(
            "SELECT payload FROM customers WHERE external_id=?",
            ["QA-CUSTOMER-1"],
          );
          await env.pool.query(
            "UPDATE customers SET payload=JSON_SET(payload,'$.displayName',?) WHERE external_id=?",
            ["QA Changed Master Name", "QA-CUSTOMER-1"],
          );
          try {
            const submitted = await req(
              "POST",
              `/${historical.external_id}/submit`,
              { revision: historical.revision },
            );
            assert.equal(submitted.status, 200, JSON.stringify(submitted));
            assert.equal(
              submitted.body.content.sourceContext.customer.name,
              historical.content.sourceContext.customer.name,
            );
            assert.equal(
              (
                await req(
                  "POST",
                  `/${historical.external_id}/approve`,
                  { revision: submitted.body.revision },
                  "reviewer",
                )
              ).status,
              200,
            );
          } finally {
            await env.pool.query(
              "UPDATE customers SET payload=? WHERE external_id=?",
              [JSON.stringify(original[0].payload), "QA-CUSTOMER-1"],
            );
          }
        },
      );
      await t.test(
        "parallel draft PDF requests do not exhaust the shared settings pool",
        async () => {
          const responses = await Promise.all(
            Array.from({ length: 8 }, () =>
              fetch(url + `/${r.external_id}/pdf`, {
                headers: { Cookie: env.cookie("technician") },
                signal: AbortSignal.timeout(10000),
              }),
            ),
          );
          assert(responses.every((response) => response.status === 200));
          await Promise.all(
            responses.map((response) => response.arrayBuffer()),
          );
        },
      );
      await t.test(
        "identity collision and legacy access corrections",
        async (t) => {
          const {
            createPortalSession,
            buildPortalAuthCookie,
          } = require("../lib/portalAuth");
          const raw = async (method, route, body, identity) => {
            const cookie = buildPortalAuthCookie(
              createPortalSession({
                user: {
                  role: "Operations",
                  name: "Duplicate Name",
                  ...identity,
                },
                secret: "synthetic-local-qa-session-secret-0000000000",
              }),
              { secure: false },
            ).split(";")[0];
            const response = await fetch(url + route, {
              method,
              headers: {
                Cookie: cookie,
                Origin: "http://127.0.0.1:5189",
                "Content-Type": "application/json",
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return { status: response.status, body: await response.json() };
          };
          const grant = (
            id,
            capabilities = ["view", "pdf", "history"],
            scope = "assigned",
          ) =>
            req(
              "PUT",
              "/permissions/" + encodeURIComponent(id),
              { capabilities, scope },
              "manager",
            );
          const [before] = await env.pool.query(
            "SELECT * FROM service_report_permissions WHERE employee_id='QA-EMP-2'",
          );
          await env.pool.query(
            "INSERT INTO employees VALUES(50,'ROW-50','Duplicate Name','LEGACY-CODE',?),(51,'ROW-51','Duplicate Name','COLLISION-CODE',?),(52,'DISABLED','Duplicate Name','DISABLED-CODE',?),(53,'DUP-A','Duplicate Name','DUP-CODE-A',?),(54,'DUP-B','Duplicate Name','DUP-CODE-B',?)",
            [
              JSON.stringify({ _id: "LEGACY-50", mobile: "9000000000" }),
              JSON.stringify({ _id: "2" }),
              JSON.stringify({ webPortalAccessEnabled: false }),
              JSON.stringify({ _id: "DUPLICATE-ID" }),
              JSON.stringify({ _id: "DUPLICATE-ID" }),
            ],
          );
          const reservedId = "LEGACY/55?verified#id";
          await env.pool.query(
            "INSERT INTO employees VALUES(55,'ROW-55','Duplicate Name','RESERVED-CODE',?)",
            [JSON.stringify({ _id: reservedId })],
          );
          await env.pool.query(
            "INSERT INTO employees VALUES(56,'ROW-56','Duplicate Name','CASE-CODE-A',?),(57,'ROW-57','Duplicate Name','CASE-CODE-B',?)",
            [
              JSON.stringify({ _id: "CASE-IDENTITY" }),
              JSON.stringify({ _id: "case-identity" }),
            ],
          );
          try {
            await t.test(
              "numeric/external/canonical overlaps reject without changing another employee's grant",
              async () => {
                for (const id of ["2", "ROW-51", "DUPLICATE-ID", "DUP-A"])
                  assert.equal(
                    (await grant(id, ["view", "review", "pdf"], "all")).status,
                    409,
                  );
                const [after] = await env.pool.query(
                  "SELECT * FROM service_report_permissions WHERE employee_id='QA-EMP-2'",
                );
                assert.deepEqual(after, before);
              },
            );
            await t.test(
              "names, phones, missing and disabled identities never receive permissions",
              async () => {
                for (const id of ["Duplicate Name", "9000000000", "MISSING"])
                  assert.equal((await grant(id)).status, 404);
                assert.equal((await grant("DISABLED")).status, 403);
              },
            );
            await t.test(
              "valid payload-only legacy users receive only their canonical grant",
              async () => {
                assert.equal(
                  (
                    await grant(
                      "ROW-50",
                      ["view", "create", "edit", "submit", "pdf", "history"],
                      "all",
                    )
                  ).status,
                  200,
                );
                const [rows] = await env.pool.query(
                  "SELECT employee_id FROM service_report_permissions WHERE employee_id IN ('ROW-50','LEGACY-50')",
                );
                assert.deepEqual(
                  rows.map((r) => r.employee_id),
                  ["LEGACY-50"],
                );
                const c = fixture();
                c.assignees = ["LEGACY-50"];
                const draft = await raw(
                  "POST",
                  "/",
                  { content: c, requestKey: crypto.randomUUID() },
                  { id: "ROW-50", employeeId: "LEGACY-50" },
                );
                assert.equal(draft.status, 201, JSON.stringify(draft));
                assert.equal(draft.body.created_by, "LEGACY-50");
                assert.equal((await grant(reservedId)).status, 200);
                assert.equal(
                  (
                    await raw("GET", "/capabilities", undefined, {
                      id: reservedId,
                      employeeId: reservedId,
                    })
                  ).status,
                  200,
                );
              },
            );
            await t.test(
              "unrelated employee and forged employeeCode cannot access reports, evidence, approvals or revisions",
              async () => {
                const who = {
                  id: "LEGACY-50",
                  employeeId: "LEGACY-50",
                  employeeCode: "QA002",
                };
                assert.equal((await grant("LEGACY-50")).status, 200);
                for (const [method, route, body] of [
                  ["GET", `/${r.external_id}`],
                  ["GET", `/${r.external_id}/pdf`],
                  ["GET", `/${r.external_id}/files/${photo.id}`],
                  [
                    "POST",
                    `/${r.external_id}/approve`,
                    { revision: r.revision },
                  ],
                  [
                    "POST",
                    `/${r.external_id}/request-revision`,
                    { revision: r.revision, reason: "QA" },
                  ],
                  [
                    "POST",
                    `/${r.external_id}/revisions`,
                    { revision: r.revision, reason: "QA" },
                  ],
                ])
                  assert.equal(
                    (await raw(method, route, body, who)).status,
                    403,
                    route,
                  );
              },
            );
            await t.test(
              "database collation cannot overwrite foreign grants, leak assigned reports or replay another actor's request",
              async () => {
                const caps = ["view", "create", "pdf"];
                assert.equal(
                  (await grant("CASE-IDENTITY", caps, "all")).status,
                  200,
                );
                const content = fixture();
                content.assignees = ["CASE-IDENTITY"];
                const requestKey = crypto.randomUUID();
                const upper = {
                    id: "CASE-IDENTITY",
                    employeeId: "CASE-IDENTITY",
                  },
                  lower = { id: "case-identity", employeeId: "case-identity" };
                const created = await raw(
                  "POST",
                  "/",
                  { content, requestKey },
                  upper,
                );
                assert.equal(created.status, 201);
                assert.equal(
                  (await grant("case-identity", ["view", "review"], "all"))
                    .status,
                  409,
                );
                const [unchanged] = await env.pool.query(
                  "SELECT employee_id,capabilities FROM service_report_permissions WHERE employee_id='CASE-IDENTITY'",
                );
                assert.equal(unchanged[0].employee_id, "CASE-IDENTITY");
                assert.deepEqual(unchanged[0].capabilities, caps);
                assert.deepEqual(
                  (await raw("GET", "/capabilities", undefined, lower)).body
                    .capabilities,
                  [],
                );
                await env.pool.query(
                  "INSERT INTO service_report_permissions(employee_id,capabilities,access_scope,updated_by) VALUES('ROW-57',?,'assigned','QA')",
                  [JSON.stringify(caps)],
                );
                const list = await raw("GET", "/", undefined, lower);
                assert.equal(list.status, 200);
                assert.equal(list.body.total, 0);
                assert.equal(
                  (
                    await raw(
                      "GET",
                      `/${created.body.external_id}`,
                      undefined,
                      lower,
                    )
                  ).status,
                  403,
                );
                await env.pool.query(
                  "UPDATE service_report_permissions SET access_scope='all' WHERE employee_id='ROW-57'",
                );
                assert.equal(
                  (await raw("POST", "/", { content, requestKey }, lower))
                    .status,
                  409,
                );
              },
            );
            await t.test(
              "disabled employees lose every route including cached PDF/file downloads despite retained grants",
              async () => {
                await env.pool.query(
                  "UPDATE employees SET payload=JSON_SET(payload,'$.webPortalAccessEnabled',false) WHERE id=50",
                );
                const who = { id: "LEGACY-50", employeeId: "LEGACY-50" };
                for (const route of [
                  "/capabilities",
                  "/lookups",
                  `/${r.external_id}/pdf`,
                  `/${r.external_id}/files/${photo.id}`,
                ])
                  assert.equal(
                    (await raw("GET", route, undefined, who)).status,
                    403,
                  );
              },
            );
            await t.test(
              "ambiguous session identities cannot use another employee's permissions",
              async () => {
                assert.equal(
                  (
                    await raw("GET", "/capabilities", undefined, {
                      id: "2",
                      employeeId: "2",
                    })
                  ).status,
                  409,
                );
                assert.equal(
                  (
                    await raw("GET", "/capabilities", undefined, {
                      id: "QA-EMP-2",
                      employeeId: "QA-EMP-3",
                    })
                  ).status,
                  409,
                );
              },
            );
          } finally {
            await env.pool.query(
              "DELETE FROM service_report_permissions WHERE employee_id IN ('LEGACY-50','LEGACY/55?verified#id','CASE-IDENTITY','ROW-57')",
            );
            await env.pool.query(
              "DELETE FROM employees WHERE id BETWEEN 50 AND 57",
            );
          }
        },
      );
      fs.writeFileSync(path.join(root, "fixture-report-id.txt"), r.external_id);
    } finally {
      await env.close();
    }
  },
);
