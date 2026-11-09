const d = require("./domain");
const crypto = require("crypto");
const sqlDate = (value) =>
  value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : value;
const hydrate = (row) =>
  row && {
    ...row,
    service_date: sqlDate(row.service_date),
    followup_date: sqlDate(row.followup_date),
    content: d.parse(row.content),
    contributors: d.parse(row.contributors),
    assignees: d.parse(row.assignees),
    revision: Number(row.revision),
    id: String(row.id),
  };
class Repository {
  constructor(getConnection) {
    this.getConnection = getConnection;
  }
  async read(fn) {
    const c = await this.getConnection();
    try {
      return await fn(c);
    } finally {
      c.release();
    }
  }
  async transaction(fn, retries = 0) {
    try {
      return await this.read(async (c) => {
        await c.beginTransaction();
        try {
          const value = await fn(c);
          await c.commit();
          return value;
        } catch (e) {
          await c.rollback();
          throw e;
        }
      });
    } catch (error) {
      if (
        retries > 0 &&
        ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)
      )
        return this.transaction(fn, retries - 1);
      throw error;
    }
  }
  async permission(c, user) {
    // The existing authenticated administrator privilege is retained; staff require explicit grants.
    if (String(user.role).toLowerCase() === "admin")
      return {
        capabilities: d.capabilities,
        access_scope: "all",
        manage: true,
      };
    const ids = d.actorIds(user);
    const [rows] = await c.query(
      `SELECT employee_id,capabilities,access_scope FROM service_report_permissions WHERE BINARY employee_id IN (${ids.map(() => "?").join(",")})`,
      ids,
    );
    // An explicit canonical grant (including revocation) wins. Legacy grants are
    // honoured only through a unique verified row relationship, never merged.
    const canonical = rows.find((r) => r.employee_id === d.actorId(user));
    if (
      !canonical &&
      new Set(
        rows.map((r) =>
          d.hash({
            capabilities: d.parse(r.capabilities),
            scope: r.access_scope,
          }),
        ),
      ).size > 1
    )
      d.fail(
        409,
        "Conflicting legacy employee permissions require administrator review",
      );
    const row = canonical || rows[0];
    return row
      ? {
          capabilities: d.parse(row.capabilities),
          access_scope: row.access_scope,
        }
      : { capabilities: [], access_scope: "assigned" };
  }

  async authorize(c, user, capability, report) {
    const p = await this.permission(c, user);
    if (!p.capabilities.includes(capability))
      d.fail(403, "Service Report permission required");
    const ids = d.actorIds(user);
    if (
      report &&
      p.access_scope !== "all" &&
      !ids.includes(report.created_by) &&
      !report.assignees.some((id) => ids.includes(String(id)))
    )
      d.fail(403, "Report is outside your assigned scope");
    if (
      report &&
      ["edit", "submit"].includes(capability) &&
      !ids.includes(report.created_by) &&
      !report.assignees.some((id) => ids.includes(String(id))) &&
      !p.manage &&
      !p.capabilities.includes("review")
    )
      d.fail(
        403,
        "Only the preparer, assigned staff or an authorised reviewer can change this draft",
      );
    return p;
  }
  actions(user, grant, report) {
    const ids = d.actorIds(user),
      participant =
        ids.includes(report.created_by) ||
        report.assignees.some((id) => ids.includes(String(id))),
      editor =
        participant || grant.manage || grant.capabilities.includes("review"),
      draft = ["Draft", "Revision Required"].includes(report.status),
      author = [
        report.created_by,
        report.submitted_by,
        ...report.contributors,
      ].some((id) => d.approvalConflictIds(user).includes(String(id)));
    return {
      edit: draft && editor && grant.capabilities.includes("edit"),
      submit: draft && editor && grant.capabilities.includes("submit"),
      approve:
        report.status === "Submitted" &&
        grant.capabilities.includes("review") &&
        !author,
      requestRevision:
        report.status === "Submitted" && grant.capabilities.includes("review"),
      correction:
        report.status === "Approved" && grant.capabilities.includes("review"),
    };
  }
  async get(c, id, lock = false) {
    const [rows] = await c.query(
      `SELECT * FROM service_reports WHERE external_id = ? ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    if (!rows[0]) d.fail(404, "Report not found");
    return hydrate(rows[0]);
  }
  async files(c, reportId, all = false) {
    const [rows] = await c.query(
      `SELECT * FROM service_report_files WHERE report_id = ? ${all ? "" : "AND removed_at IS NULL"} ORDER BY display_order, created_at, id`,
      [reportId],
    );
    return rows;
  }
  async audit(c, user, r, action, details = {}) {
    await c.query(
      "INSERT INTO service_report_audit_logs (report_id,actor_id,actor_name,action,revision,details) VALUES (?,?,?,?,?,?)",
      [
        r.id,
        d.actorId(user),
        String(user.name || "Staff"),
        action,
        r.revision,
        JSON.stringify(details),
      ],
    );
  }
  async save(c, r, content) {
    await c.query(
      `UPDATE service_reports SET customer_external_id=?,premise_id=?,job_external_id=?,contract_reference=?,contract_source=?,schedule_reference=?,customer_name=?,site_name=?,service_type=?,company_type=?,service_date=?,assignees=?,content=?,has_findings=?,followup_required=?,followup_date=?,revision=?,last_edited_by=?,contributors=? WHERE id=?`,
      [
        content.links.customerId,
        content.links.premiseId || null,
        content.links.jobId || null,
        content.links.contractReference || null,
        content.links.contractSource || null,
        content.links.scheduleReference || null,
        content.header.customerName,
        content.header.siteName,
        content.header.serviceType,
        content.header.companyType,
        content.header.serviceDate || null,
        JSON.stringify(content.assignees),
        JSON.stringify(content),
        content.findings.some((f) =>
          ["Low", "Moderate", "High"].includes(f.activityLevel),
        )
          ? 1
          : 0,
        content.followup.required === "Yes" ? 1 : 0,
        content.followup.nextVisitDate || null,
        r.revision,
        r.last_edited_by,
        JSON.stringify(r.contributors),
        r.id,
      ],
    );
  }
  async create(c, user, content, key) {
    const digest = d.hash(d.normalize(content));
    await c.query(
      "INSERT INTO service_report_request_keys (actor_id,request_key,request_hash,report_external_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE request_key=VALUES(request_key)",
      [d.actorId(user), key, digest, `SR-${crypto.randomUUID()}`],
    );
    const [keys] = await c.query(
      "SELECT * FROM service_report_request_keys WHERE actor_id=? AND request_key=? FOR UPDATE",
      [d.actorId(user), key],
    );
    const request = keys[0];
    if (!d.actorIds(user).includes(String(request.actor_id)))
      d.fail(
        409,
        "Employee request identity conflicts with an existing identifier. No report was created or returned.",
      );
    if (request.request_hash !== digest)
      d.fail(409, "Request key was already used with different content");
    const [existing] = await c.query(
      "SELECT * FROM service_reports WHERE external_id=? FOR UPDATE",
      [request.report_external_id],
    );
    if (existing[0]) return hydrate(existing[0]);
    const [result] = await c.query(
      "INSERT INTO service_reports (external_id,customer_external_id,customer_name,company_type,created_by,prepared_by,last_edited_by,contributors,assignees,content) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        request.report_external_id,
        content.links.customerId,
        content.header.customerName,
        content.header.companyType,
        d.actorId(user),
        String(user.name || "Staff"),
        d.actorId(user),
        JSON.stringify([d.actorId(user)]),
        JSON.stringify(content.assignees),
        JSON.stringify(content),
      ],
    );
    const r = {
      id: String(result.insertId),
      revision: 1,
      last_edited_by: d.actorId(user),
      contributors: [d.actorId(user)],
    };
    // AUTO_INCREMENT is atomic across writers; gaps are intentional and never reused.
    await c.query("UPDATE service_reports SET report_number=? WHERE id=?", [
      `SR-${String(result.insertId).padStart(7, "0")}`,
      r.id,
    ]);
    await this.save(c, r, content);
    const report = await this.get(c, request.report_external_id);
    await this.audit(c, user, report, "created");
    return report;
  }
  async list(c, user, q) {
    const p = await this.authorize(c, user, "view");
    const clauses = ["1=1"],
      args = [];
    if (p.access_scope !== "all") {
      const ids = [...new Set(d.actorIds(user))];
      clauses.push(
        `(BINARY created_by IN (${ids.map(() => "?").join(",")}) OR ${ids.map(() => "JSON_CONTAINS(assignees, JSON_QUOTE(?))").join(" OR ")})`,
      );
      args.push(...ids, ...ids);
    }
    for (const [key, column] of Object.entries({
      number: "report_number",
      customer: "customer_name",
      site: "site_name",
      service: "service_type",
      reference: "contract_reference",
    }))
      if (q[key]) {
        clauses.push(`${column} LIKE ?`);
        args.push(`%${d.text(q[key], 255)}%`);
      }
    if (q.status) {
      if (!d.states.includes(q.status)) d.fail(422, "Invalid report status");
      clauses.push("status=?");
      args.push(q.status);
    }
    if (q.from) {
      clauses.push("service_date>=?");
      args.push(d.text(q.from, 10));
    }
    if (q.to) {
      clauses.push("service_date<=?");
      args.push(d.text(q.to, 10));
    }
    if (q.employee) {
      clauses.push(
        "(BINARY created_by=? OR JSON_CONTAINS(assignees,JSON_QUOTE(?)))",
      );
      args.push(d.text(q.employee, 120), d.text(q.employee, 120));
    }
    if (q.job) {
      clauses.push("job_external_id LIKE ?");
      args.push(`%${d.text(q.job, 80)}%`);
    }
    const where = clauses.join(" AND "),
      page = Math.max(1, Math.min(100000, parseInt(q.page) || 1)),
      limit = Math.max(1, Math.min(100, parseInt(q.limit) || 25));
    const [metrics] = await c.query(
      `SELECT COUNT(*) total,SUM(status='Draft') drafts,SUM(status='Submitted') submitted,SUM(status='Approved') approved,SUM(status='Revision Required') revisions,SUM(has_findings) findings,SUM(followup_required) followups FROM service_reports WHERE ${where}`,
      args,
    );
    const [rows] = await c.query(
      `SELECT * FROM service_reports WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...args, limit, (page - 1) * limit],
    );
    return {
      items: rows.map(hydrate),
      summary: Object.fromEntries(
        Object.entries(metrics[0]).map(([k, v]) => [k, Number(v || 0)]),
      ),
      page,
      limit,
      total: Number(metrics[0].total),
    };
  }
  async version(c, user, r, state, branding) {
    const snapshot = {
      reportNumber: r.report_number,
      preparedBy: r.prepared_by,
      content: r.content,
      files: await this.files(c, r.id),
      branding,
      state,
      revision: r.revision,
      recordedAt: new Date().toISOString(),
      recordedBy: { id: d.actorId(user), name: String(user.name || "Staff") },
    };
    const [result] = await c.query(
      "INSERT INTO service_report_versions (report_id,revision,state,snapshot,content_hash,created_by) VALUES (?,?,?,?,?,?)",
      [
        r.id,
        r.revision,
        state,
        JSON.stringify(snapshot),
        d.hash(snapshot),
        d.actorId(user),
      ],
    );
    return { id: result.insertId, snapshot };
  }
}
module.exports = { Repository, hydrate };
