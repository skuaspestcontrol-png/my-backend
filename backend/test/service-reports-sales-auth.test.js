const test = require("node:test");
const assert = require("node:assert/strict");
const { createSalesReportAuth } = require("../serviceReports/salesAdapterAuth");
const { signDelegation, HEADER } = require("../serviceReports/salesDelegation");
const secret = "synthetic-report-only-delegation-key-0000000";
const row = (overrides = {}) => ({
  id: 44,
  service_report_row_id: "44",
  external_id: "ROW-44",
  full_name: "Synthetic Sales",
  role: "Sales",
  status: "active",
  payload: { _id: "CANON-44" },
  ...overrides,
});
const target = "/api/service-reports/lookups";
function setup(rows = [row()], options = {}) {
  let calls = 0,
    releases = 0;
  const middleware = createSalesReportAuth({
    secret,
    now: () => 1000000,
    getConnection: async () => ({
      query: async (sql, params) => {
        calls++;
        return [
          sql.includes("WHERE BINARY")
            ? rows.filter((r) => String(r.id) === params[0])
            : rows,
        ];
      },
      release: () => releases++,
    }),
    ...options,
  });
  return { middleware, calls: () => calls, releases: () => releases };
}
async function run(
  env,
  {
    token = signDelegation({
      employeeRowId: 44,
      method: "GET",
      target,
      secret,
      now: 1000000,
    }),
    method = "GET",
    originalUrl = target,
    headers = {},
    portalUser,
  } = {},
) {
  const req = {
    method,
    originalUrl,
    headers: { ...(token ? { [HEADER]: token } : {}), ...headers },
    portalUser,
  };
  const res = {
    statusCode: 200,
    setHeader() {},
    status(v) {
      this.statusCode = v;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
  let next = false;
  await env.middleware(req, res, () => {
    next = true;
  });
  return { req, res, next };
}
test("delegation resolves the exact Sales employee row to canonical CRM identity without administrator privileges", async () => {
  const env = setup([row({ role: "Admin", designation: "Sales Manager" })]);
  const x = await run(env);
  assert(x.next);
  assert.equal(x.req.portalUser.id, "CANON-44");
  assert.equal(x.req.portalUser.role, "Sales");
  assert.equal(x.req.portalUser.type, "employee");
  assert.equal(env.releases(), 1);
});
test("ordinary CRM portal authentication is unchanged without a delegation header", async () => {
  const env = setup();
  const x = await run(env, { token: "", portalUser: { role: "Admin" } });
  assert(x.next);
  assert.equal(x.req.portalUser.role, "Admin");
  assert.equal(env.calls(), 0);
});
test("invalid, expired, wrong-secret and operation-mismatched delegations fail before database access", async () => {
  const tokens = [
    "invalid",
    signDelegation({
      employeeRowId: 44,
      method: "GET",
      target,
      secret: secret + "x",
      now: 1000000,
    }),
    signDelegation({
      employeeRowId: 44,
      method: "GET",
      target,
      secret,
      now: 900000,
    }),
  ];
  for (const token of tokens) {
    const env = setup();
    assert.equal((await run(env, { token })).res.statusCode, 401);
    assert.equal(env.calls(), 0);
  }
  const env = setup();
  assert.equal(
    (await run(env, { originalUrl: "/api/service-reports/schema" })).res
      .statusCode,
    403,
  );
  assert.equal(env.calls(), 0);
});
test("cookie or bearer authentication cannot be mixed with Sales delegation to inherit an administrator session", async () => {
  for (const headers of [
    { cookie: "skuas_portal_session=admin" },
    { authorization: "Bearer administrator" },
  ]) {
    const env = setup();
    const x = await run(env, { headers });
    assert.equal(x.res.statusCode, 401);
    assert.equal(env.calls(), 0);
  }
});
test("disabled, non-Sales, missing and ambiguous CRM identities are rejected without automatic grants", async () => {
  const scenarios = [
    [row({ payload: { _id: "CANON-44", webPortalAccessEnabled: false } })],
    [row({ role: "Technician" })],
    [],
    [row(), row({ id: 45, service_report_row_id: "45", external_id: "OTHER" })],
  ];
  for (const rows of scenarios) {
    const x = await run(setup(rows));
    assert(!x.next);
    assert([403, 409].includes(x.res.statusCode));
  }
});
test("delegation nonce reuse is rejected and missing/dedicated-key configuration fails closed", async () => {
  const env = setup();
  const token = signDelegation({
    employeeRowId: 44,
    method: "GET",
    target,
    secret,
    now: 1000000,
  });
  assert((await run(env, { token })).next);
  assert.equal((await run(env, { token })).res.statusCode, 401);
  assert.equal(
    (await run(setup(undefined, { secret: "" }))).res.statusCode,
    503,
  );
  assert.equal(
    (await run(setup(undefined, { portalSecret: secret }))).res.statusCode,
    503,
  );
});
