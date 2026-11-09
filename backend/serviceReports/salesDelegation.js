const crypto = require("node:crypto");
const PREFIX = "skuas:sales:service-reports:v1.";
const HEADER = "x-skuas-service-report-delegation";
const ROOT = "/api/service-reports";
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
function targetFor(method, raw) {
  const url = new URL(raw, "https://service-reports.invalid");
  if (
    url.origin !== "https://service-reports.invalid" ||
    raw.split("?")[0] !== url.pathname
  )
    fail(403, "Sales report operation is not allowed");
  const suffix = url.pathname.slice(ROOT.length);
  if (!url.pathname.startsWith(ROOT) || (suffix && !suffix.startsWith("/")))
    fail(403, "Sales report operation is not allowed");
  const report = "SR-[a-f0-9-]{36}",
    file = "[a-f0-9-]{36}";
  const patterns = {
    GET: new RegExp(
      `^(?:/?|/(?:capabilities|schema|lookups)|/${report}(?:/(?:history|pdf)|/files/${file})?)$`,
    ),
    POST: new RegExp(`^(?:/?|/${report}/(?:files|submit))$`),
    PUT: new RegExp(`^/${report}$`),
    DELETE: new RegExp(`^/${report}/files/${file}$`),
  };
  if (!patterns[method]?.test(suffix))
    fail(403, "Sales report operation is not allowed");
  const allowed =
    method !== "GET"
      ? []
      : /\/pdf$/.test(suffix)
        ? ["version", "share"]
        : /\/files\//.test(suffix)
          ? ["preview"]
          : /^\/?$/.test(suffix)
            ? [
                "number",
                "customer",
                "site",
                "service",
                "reference",
                "job",
                "employee",
                "status",
                "from",
                "to",
                "page",
                "limit",
              ]
            : [];
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || seen.has(key) || value.length > 255)
      fail(422, "Invalid Service Report query");
    if (["version", "page", "limit"].includes(key) && !/^[1-9]\d*$/.test(value))
      fail(422, "Invalid Service Report query");
    if (["preview", "share"].includes(key) && !["0", "1"].includes(value))
      fail(422, "Invalid Service Report query");
    seen.add(key);
  }
  url.searchParams.sort();
  const target =
    ROOT +
    (suffix === "/" ? "" : suffix) +
    (url.searchParams.size ? "?" + url.searchParams.toString() : "");
  if (target.length > 2048) fail(422, "Service Report query is too long");
  return target;
}
function checkSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32)
    fail(503, "Service Report integration is not configured");
}
function signDelegation({
  employeeRowId,
  method,
  target,
  secret,
  now = Date.now(),
}) {
  checkSecret(secret);
  if (typeof employeeRowId === "number" && !Number.isSafeInteger(employeeRowId))
    fail(403, "Verified Sales employee identity required");
  if (!/^[1-9]\d{0,19}$/.test(String(employeeRowId)))
    fail(403, "Verified Sales employee identity required");
  const claims = {
    v: 1,
    aud: "crm-service-reports",
    sub: String(employeeRowId),
    method,
    target: targetFor(method, target),
    iat: now,
    exp: now + 15000,
    nonce: crypto.randomUUID(),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return (
    body +
    "." +
    crypto
      .createHmac("sha256", secret)
      .update(PREFIX + body)
      .digest("base64url")
  );
}
function verifyDelegation({ token, method, target, secret, now = Date.now() }) {
  checkSecret(secret);
  if (
    typeof token !== "string" ||
    token.length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  )
    fail(401, "Invalid Sales report delegation");
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(PREFIX + body)
    .digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  )
    fail(401, "Invalid Sales report delegation");
  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    fail(401, "Invalid Sales report delegation");
  }
  if (
    !claims ||
    Object.keys(claims).sort().join(",") !==
      "aud,exp,iat,method,nonce,sub,target,v" ||
    claims.v !== 1 ||
    claims.aud !== "crm-service-reports" ||
    typeof claims.sub !== "string" ||
    !/^[1-9]\d{0,19}$/.test(claims.sub) ||
    !/^[a-f0-9-]{36}$/.test(claims.nonce) ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= now ||
    claims.iat > now + 2000 ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 20000
  )
    fail(401, "Expired or invalid Sales report delegation");
  if (claims.method !== method || claims.target !== targetFor(method, target))
    fail(403, "Sales report delegation does not match this operation");
  return claims;
}
module.exports = { HEADER, ROOT, targetFor, signDelegation, verifyDelegation };
