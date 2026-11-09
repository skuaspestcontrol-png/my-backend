const d = require("./domain");
const id = (value) => String(value ?? "").trim();
const off = (value) =>
  [
    "false",
    "0",
    "no",
    "disabled",
    "inactive",
    "off",
    "resigned",
    "blocked",
    "suspended",
  ].includes(id(value).toLowerCase());
function directory(rows) {
  const employees = rows.map((row) => {
    const p = d.parse(row.payload) || {};
    const canonicalId =
      id(p._id) ||
      id(row.external_id) ||
      id(row.service_report_row_id ?? row.id);
    const rowId = row.service_report_row_id ?? row.id;
    const aliases = [
      ...new Set(
        [canonicalId, row.external_id, rowId, row.emp_code, p.empCode]
          .map(id)
          .filter(Boolean),
      ),
    ];
    const status = id(
      p.employmentStatus ?? row.employment_status,
    ).toLowerCase();
    const disabled =
      [
        p.active,
        p.isActive,
        p.is_active,
        row.is_active,
        p.webPortalAccessEnabled,
        p.web_portal_access_enabled,
        p.portalAccess,
        row.web_portal_access_enabled,
        row.status,
        p.status,
      ].some(off) ||
      [p.disabled, p.isDisabled, row.disabled].some((v) =>
        ["true", "1", "yes"].includes(id(v).toLowerCase()),
      ) ||
      [
        "inactive",
        "not active",
        "disabled",
        "resigned",
        "left",
        "quit",
        "suspended",
      ].includes(status);
    return {
      canonicalId,
      aliases,
      disabled,
      row,
      name: row.full_name || p.fullName || "",
      code: row.emp_code || p.empCode || "",
    };
  });
  const matches = (value) =>
    employees.filter((e) => e.aliases.includes(id(value)));
  function resolve(value) {
    if (!id(value)) d.fail(422, "Employee identity is required");
    const found = matches(value);
    if (id(value) === "admin" || found.some((e) => e.canonicalId === "admin"))
      d.fail(
        409,
        "Employee identity conflicts with the built-in administrator. Use a unique CRM employee identifier.",
      );
    if (!found.length)
      d.fail(404, "Employee identity could not be resolved to a CRM employee");
    if (found.length !== 1 || matches(found[0].canonicalId).length !== 1)
      d.fail(
        409,
        "Employee identity is ambiguous. Resolve the conflicting CRM identifiers before changing access.",
      );
    if (found[0].disabled) d.fail(403, "Employee access is disabled");
    return {
      canonicalId: found[0].canonicalId,
      name: found[0].name,
      code: found[0].code,
      aliases: found[0].aliases.filter(
        (v) => v !== "admin" && matches(v).length === 1,
      ),
      // Ambiguous aliases can deny self-approval, but can never confer access.
      possibleAliases: found[0].aliases,
    };
  }
  return { employees, resolve };
}
async function loadDirectory(c) {
  // SELECT * supports both legacy JSON-only and newer employee schemas. No employee writes.
  const [rows] = await c.query(
    "SELECT employees.*, CAST(id AS CHAR) AS service_report_row_id FROM employees",
  );
  return directory(rows);
}
async function resolveUser(c, user) {
  // The existing built-in administrator is not an employee record.
  if (
    user.type === "admin" &&
    user.id === "admin" &&
    String(user.role).toLowerCase() === "admin"
  )
    return { canonicalId: "admin", aliases: ["admin"] };
  const dir = await loadDirectory(c);
  const identities = [
    ...new Set([user.id, user.employeeId].map(id).filter(Boolean)),
  ];
  if (!identities.length)
    d.fail(403, "A verified CRM employee identity is required");
  const resolved = identities.map((value) => dir.resolve(value));
  if (resolved.some((e) => e.canonicalId !== resolved[0].canonicalId))
    d.fail(
      409,
      "Session employee identities conflict. Sign in with a verified CRM employee account.",
    );
  return resolved[0];
}
module.exports = { directory, loadDirectory, resolveUser };
