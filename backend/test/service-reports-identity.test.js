const test = require("node:test");
const assert = require("node:assert/strict");
const {
  directory,
  resolveUser,
} = require("../serviceReports/employeeIdentity");
const row = (id, external_id, payload = {}, extra = {}) => ({
  id,
  external_id,
  payload,
  full_name: "Duplicate Name",
  emp_code: `CODE-${id}`,
  ...extra,
});
test("duplicate names/phones do not identify employees; unique canonical IDs do", () => {
  const dir = directory([
    row(10, "EMP-A", { mobile: "9000000000" }),
    row(11, "EMP-B", { mobile: "9000000000" }),
  ]);
  assert.equal(dir.resolve("EMP-A").canonicalId, "EMP-A");
  assert.equal(dir.resolve("EMP-B").canonicalId, "EMP-B");
  for (const id of ["Duplicate Name", "9000000000", "missing"])
    assert.throws(() => dir.resolve(id), { status: 404 });
  assert.throws(() => dir.resolve(""), { status: 422 });
});
test("payload-only legacy canonical identities and verified row/external/code aliases resolve to one record", () => {
  const dir = directory([row(50, "ROW-50", { _id: "LEGACY-50" })]);
  for (const id of ["LEGACY-50", "ROW-50", "50", "CODE-50"])
    assert.equal(dir.resolve(id).canonicalId, "LEGACY-50");
});
test("overlapping legacy IDs and duplicate canonical identities are rejected, never first-row matched", () => {
  const dir = directory([row(2, "EMP-2"), row(51, "ROW-51", { _id: "2" })]);
  assert.throws(() => dir.resolve("2"), { status: 409 });
  assert.throws(() => dir.resolve("ROW-51"), { status: 409 });
  assert(!dir.resolve("EMP-2").aliases.includes("2"));
  const reserved = directory([row(10, "admin", { _id: "EMP-A" })]);
  assert.throws(() => reserved.resolve("admin"), { status: 409 });
  assert(!reserved.resolve("EMP-A").aliases.includes("admin"));
  assert.throws(
    () => directory([row(10, "OTHER", { _id: "admin" })]).resolve("OTHER"),
    { status: 409 },
  );
  const duplicate = directory([
    row(50, "A", { _id: "SHARED" }),
    row(51, "B", { _id: "SHARED" }),
  ]);
  for (const id of ["SHARED", "A", "B"])
    assert.throws(() => duplicate.resolve(id), { status: 409 });
});
test("disabled and resigned records cannot resolve even when their identifier is unique", () => {
  for (const value of [
    { payload: { webPortalAccessEnabled: false } },
    { payload: { portalAccess: "disabled" } },
    { payload: { employmentStatus: "Resigned" } },
    { is_active: 0 },
    { status: "disabled" },
    { web_portal_access_enabled: 0 },
    { payload: { disabled: true } },
    { payload: { isDisabled: true } },
    { status: "suspended" },
  ]) {
    assert.throws(
      () => directory([row(10, "EMP-A", {}, value)]).resolve("EMP-A"),
      { status: 403 },
    );
  }
});
test("sessions must resolve to one verified employee; a foreign employeeCode cannot broaden aliases", async () => {
  const c = { query: async () => [[row(10, "EMP-A"), row(11, "EMP-B")]] };
  const identity = await resolveUser(c, {
    id: "EMP-A",
    employeeId: "10",
    employeeCode: "CODE-11",
  });
  assert.equal(identity.canonicalId, "EMP-A");
  assert(!identity.aliases.includes("CODE-11"));
  await assert.rejects(resolveUser(c, { id: "EMP-A", employeeId: "EMP-B" }), {
    status: 409,
  });
  await assert.rejects(resolveUser(c, { employeeCode: "CODE-10" }), {
    status: 403,
  });
});
test("existing verified legacy grants are retained without merging access; canonical revocation wins", async () => {
  const { Repository } = require("../serviceReports/repository");
  const repo = new Repository(() => {});
  const user = {
    role: "Employee",
    serviceReportIdentity: {
      canonicalId: "LEGACY-50",
      aliases: ["LEGACY-50", "ROW-50", "50"],
    },
  };
  let rows = [
    {
      employee_id: "ROW-50",
      capabilities: '["view"]',
      access_scope: "assigned",
    },
  ];
  const c = { query: async () => [rows] };
  assert.deepEqual(await repo.permission(c, user), {
    capabilities: ["view"],
    access_scope: "assigned",
  });
  rows.push({
    employee_id: "50",
    capabilities: '["review"]',
    access_scope: "all",
  });
  await assert.rejects(repo.permission(c, user), { status: 409 });
  rows.push({
    employee_id: "LEGACY-50",
    capabilities: "[]",
    access_scope: "assigned",
  });
  assert.deepEqual(await repo.permission(c, user), {
    capabilities: [],
    access_scope: "assigned",
  });
});
test("ambiguous historical author IDs can deny self-approval but never confer record access", () => {
  const d = require("../serviceReports/domain");
  const { Repository } = require("../serviceReports/repository");
  const identity = directory([
    row(2, "EMP-2"),
    row(51, "OTHER", { _id: "2" }),
  ]).resolve("EMP-2");
  const user = { role: "Employee", serviceReportIdentity: identity };
  assert(!d.actorIds(user).includes("2"));
  assert(d.approvalConflictIds(user).includes("2"));
  const report = {
    status: "Submitted",
    created_by: "2",
    submitted_by: "2",
    contributors: ["2"],
    assignees: [],
  };
  assert.equal(
    new Repository(() => {}).actions(
      user,
      { capabilities: ["review"], access_scope: "all" },
      report,
    ).approve,
    false,
  );
});
