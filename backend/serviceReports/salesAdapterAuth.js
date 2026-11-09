const { HEADER, verifyDelegation } = require("./salesDelegation");
const { loadDirectory } = require("./employeeIdentity");
const d = require("./domain");

function createSalesReportAuth({
  getConnection,
  secret = process.env.SERVICE_REPORT_BRIDGE_SECRET,
  portalSecret = "",
  now = Date.now,
}) {
  const nonces = new Map();
  return async (req, res, next) => {
    const token = req.headers[HEADER];
    if (!token) return next(); // Existing CRM portal authentication is unchanged.
    res.setHeader("Cache-Control", "private, no-store");
    let c;
    try {
      if (
        req.headers.cookie ||
        req.headers.authorization ||
        req.portalUser ||
        req.documentShare
      )
        d.fail(401, "Mixed report authentication is not allowed");
      if (secret && secret === portalSecret)
        d.fail(503, "A dedicated Service Report delegation secret is required");
      const instant = now();
      const claims = verifyDelegation({
        token,
        method: req.method,
        target: req.originalUrl,
        secret,
        now: instant,
      });
      for (const [nonce, expiry] of nonces)
        if (expiry <= instant) nonces.delete(nonce);
      if (nonces.has(claims.nonce))
        d.fail(401, "Sales report delegation was already used");
      if (nonces.size >= 10000)
        d.fail(503, "Sales report delegation capacity exceeded");
      nonces.set(claims.nonce, claims.exp);
      c = await getConnection();
      const [rows] = await c.query(
        "SELECT employees.*, CAST(id AS CHAR) AS service_report_row_id FROM employees WHERE BINARY CAST(id AS CHAR)=?",
        [claims.sub],
      );
      if (rows.length !== 1)
        d.fail(403, "Sales employee relationship could not be verified");
      const row = rows[0],
        payload = d.parse(row.payload) || {};
      const role = [
        row.role,
        row.role_name,
        row.designation,
        row.department,
        payload.role,
        payload.roleName,
        payload.designation,
        payload.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (
        !/\bsales\b|salesperson|business development|bdm|telecaller|marketing/.test(
          role,
        )
      )
        d.fail(403, "An active CRM Sales employee is required");
      const identity = (await loadDirectory(c)).resolve(
        payload._id || row.external_id || row.service_report_row_id,
      );
      // The adapter never inherits an administrator role, even from mixed employee roles.
      req.portalUser = {
        id: identity.canonicalId,
        employeeId: identity.canonicalId,
        employeeCode: identity.code,
        name: identity.name,
        type: "employee",
        role: "Sales",
      };
      req.salesReportAdapter = true;
      next();
    } catch (error) {
      res.status(error.status || 503).json({
        error: error.status
          ? error.message
          : "Sales report authentication unavailable",
      });
    } finally {
      c?.release();
    }
  };
}
module.exports = { createSalesReportAuth };
