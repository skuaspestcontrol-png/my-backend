// Creates synthetic review records through the actual authenticated feature APIs.
const fs = require("fs");
const path = require("path");
const { fixture } = require("../../test/service-reports-fixtures");
const { cookie, root } = (() => ({
  ...require("./local-server"),
  ...require("./local-fixture"),
}))();
const base = "http://127.0.0.1:5188/api/service-reports";
const origin = "http://127.0.0.1:5188";
const output =
  process.env.SERVICE_REPORT_ARTIFACT_DIR || path.join(root, "review");
async function request(method, url, body, user = "technician") {
  const response = await fetch(base + url, {
    method,
    headers: {
      Cookie: cookie(user),
      Origin: origin,
      ...(!(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  if (!response.ok)
    throw new Error(
      `${method} ${url}: ${response.status} ${await response.text()}`,
    );
  return response.headers.get("content-type")?.includes("application/pdf")
    ? Buffer.from(await response.arrayBuffer())
    : response.json();
}
async function upload(r, kind, name, bytes, meta = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  for (const [key, value] of Object.entries({
    kind,
    category: kind,
    revision: r.revision,
    includeInPdf: true,
    ...meta,
  }))
    form.append(key, String(value));
  await request("POST", `/${r.external_id}/files`, form);
  return request("GET", `/${r.external_id}`);
}
async function seed() {
  fs.mkdirSync(output, { recursive: true });
  const refs = {};
  for (const [label, type, status] of [
    ["draft", "GST", "Draft"],
    ["submitted", "GST", "Submitted"],
    ["approved", "GST", "Approved"],
    ["non-gst", "NON_GST", "Approved"],
  ]) {
    const content = fixture(type);
    content.acknowledgement.customerResponse = "Signed";
    content.acknowledgement.reason = "";
    let r = await request("POST", "/", {
      content,
      requestKey: crypto.randomUUID(),
    });
    const photo = fs.readFileSync(
      path.join(__dirname, "../../test/fixtures/service-reports/photo.png"),
    );
    r = await upload(r, "photo", "before.png", photo, {
      category: "Before Treatment",
      caption:
        "SYNTHETIC QA — before treatment image fixture; no real service evidence",
      area: "QA kitchen",
      displayOrder: 1,
    });
    r = await upload(r, "photo", "after.png", photo, {
      category: "After Treatment",
      caption:
        "SYNTHETIC QA — after treatment image fixture; no real service evidence",
      area: "QA kitchen",
      displayOrder: 2,
    });
    r = await upload(r, "siteMap", "diagram.png", photo, {
      category: "Treatment Diagram",
      caption: "SYNTHETIC QA diagram fixture",
      annotations: "M-01: QA monitoring point. Zone A: QA treatment area.",
    });
    const pdf = fs.readFileSync(path.join(output, "gst.pdf"));
    r = await upload(r, "attachment", "qa-supporting-document.pdf", pdf, {
      category: "Other",
      caption:
        "SYNTHETIC QA attachment — not a product label or operating instruction",
      includeInPdf: false,
    });
    r = await upload(
      r,
      "technicianSignature",
      "signature.png",
      fs.readFileSync(
        path.join(
          __dirname,
          "../../test/fixtures/service-reports/signature.png",
        ),
      ),
    );
    r = await upload(
      r,
      "customerSignature",
      "signature.png",
      fs.readFileSync(
        path.join(
          __dirname,
          "../../test/fixtures/service-reports/signature.png",
        ),
      ),
    );
    if (status !== "Draft")
      r = await request("POST", `/${r.external_id}/submit`, {
        revision: r.revision,
      });
    if (status === "Approved")
      r = await request(
        "POST",
        `/${r.external_id}/approve`,
        { revision: r.revision },
        "reviewer",
      );
    refs[label] = r.external_id;
    if (status === "Approved") {
      const bytes = await request(
        "GET",
        `/${r.external_id}/pdf`,
        null,
        "reviewer",
      );
      fs.writeFileSync(
        path.join(
          output,
          `${label === "approved" ? "sample-gst-with-photos" : "sample-non-gst"}.pdf`,
        ),
        bytes,
      );
    }
  }
  fs.writeFileSync(
    path.join(root, "review-records.json"),
    JSON.stringify(refs, null, 2),
  );
  console.log(refs);
}
if (require.main === module)
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
module.exports = { seed };
