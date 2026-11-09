const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const d = require("../serviceReports/domain");
const { renderPdf, brandingFromSettings } = require("../serviceReports/pdf");
const { fixture } = require("./service-reports-fixtures");
const {
  branding,
  logoPath,
} = require("../scripts/service-reports/local-fixture");
const samples = process.env.SERVICE_REPORT_ARTIFACT_DIR;
const hasLogo = fs.existsSync(logoPath);
const configs = [
  ["general-pest", "GST", "General Pest Control"],
  ["termite", "GST", "Termite Control"],
  ["rodent", "GST", "Rodent Control"],
  ["fogging", "GST", "Thermal / ULV Fogging"],
  ["commercial-amc", "GST", "Commercial AMC"],
  ["long-findings", "GST", "General Pest Control"],
  ["multiple-photos", "GST", "General Pest Control"],
  ["no-attachments", "GST", "General Pest Control"],
  ["gst", "GST", "General Pest Control"],
  ["non-gst", "NON_GST", "General Pest Control"],
];
for (const [name, type, service] of configs)
  test(`PDF: ${name}`, { skip: !hasLogo }, async () => {
    const content = fixture(type);
    content.header.serviceType = service;
    content.summary.remarks +=
      " Temperature 25 °C; sample 10 µL; café façade; en–dash.";
    if (name === "long-findings")
      content.findings = Array.from({ length: 35 }, (_, i) => ({
        ...content.findings[0],
        entryId: `QA-${i}`,
        area: `QA Area ${i + 1}`,
        description:
          "Long synthetic finding text with measured layout and retained words. ".repeat(
            i === 0 ? 85 : 4,
          ) + (i === 34 ? "FINAL_FINDING_SENTINEL" : ""),
      }));
    const files = [];
    if (name === "multiple-photos")
      for (let i = 0; i < 4; i++)
        files.push({
          id: `QA-PHOTO-${i}`,
          kind: "photo",
          category: [
            "Before Treatment",
            "During Treatment",
            "After Treatment",
            "Monitoring Devices",
          ][i],
          caption: "SYNTHETIC QA IMAGE — no actual site or treatment",
          area: "QA kitchen",
          created_at: "2026-11-07T09:00:00Z",
          uploaded_by: "QA Technician",
          mime_type: "image/png",
          include_in_pdf: 1,
        });
    if (name !== "no-attachments")
      files.push({
        id: "QA-MAP",
        kind: "siteMap",
        category: "Floor Plan",
        caption: "SYNTHETIC QA site diagram",
        annotations: "M-01: QA monitoring point",
        created_at: "2026-11-07T09:00:00Z",
        mime_type: "image/png",
        include_in_pdf: 1,
      });
    files.push({
      id: "QA-SIGNATURE",
      kind: "technicianSignature",
      category: "technicianSignature",
      created_at: "2026-11-07T10:00:00Z",
      mime_type: "image/png",
      include_in_pdf: 1,
    });
    const snapshot = {
      reportNumber: `QA-SR-${name.toUpperCase()}`,
      revision: 1,
      state: "Approved",
      preparedBy: "QA Technician — synthetic record",
      recordedBy: { name: "QA Reviewer" },
      recordedAt: "2026-11-07T10:15:00Z",
      content,
      files,
      branding: brandingFromSettings(branding(), type, () => logoPath),
    };
    const trace = [],
      buffer = await renderPdf(snapshot, {
        readFile: (f) =>
          fs.readFileSync(
            require("path").join(
              __dirname,
              `fixtures/service-reports/${f.kind.endsWith("Signature") ? "signature" : "photo"}.png`,
            ),
          ),
        onFragment: (f) => trace.push(f),
      });
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    const text = trace.map((t) => t.text).join(" ");
    for (const section of d.schema.sections)
      assert(text.includes(section.title), section.title);
    for (const sentinel of [
      "CONFIDENTIAL_INTERNAL_SENTINEL",
      "CONFIDENTIAL_BANK_SENTINEL",
      "CONFIDENTIAL_SECRET_SENTINEL",
    ])
      assert(!text.includes(sentinel));
    if (type === "NON_GST") {
      assert(text.includes("SKUAS Non-GST"));
      assert(!text.includes("GST Details:"));
    } else assert(text.includes("GST Details: QA GST"));
    if (name === "long-findings")
      assert(text.includes("FINAL_FINDING_SENTINEL"));
    assert.equal(snapshot.branding.logoHash, d.hash(fs.readFileSync(logoPath)));
    const footer = trace.filter(
      (f) => f.text.includes("Page ") && f.text.includes(" of "),
    );
    const pages = Math.max(...trace.map((f) => f.page)) + 1;
    assert.equal(footer.length, pages, "exactly one footer per actual page");
    for (const f of trace) {
      assert(f.y >= 40, `Text above margin: ${f.text}`);
      assert(f.y + f.height <= 816, `Text clipped at bottom: ${f.text}`);
      assert(
        f.x >= 54 && f.x + f.width <= 542,
        `Text clipped horizontally: ${f.text}`,
      );
    }
    const headings = trace.filter((f) => /^\d+\. /.test(f.text));
    for (const h of headings)
      assert(
        trace.some(
          (f) =>
            f.page === h.page &&
            f.y > h.y &&
            f.y < 790 &&
            !f.text.includes("Page "),
        ),
        `Orphan heading: ${h.text}`,
      );
    if (samples) {
      fs.mkdirSync(samples, { recursive: true });
      fs.writeFileSync(`${samples}/${name}.pdf`, buffer);
      fs.writeFileSync(
        `${samples}/${name}-trace.json`,
        JSON.stringify(trace, null, 2),
      );
    }
  });
test("missing company identity or original logo blocks PDF branding", () => {
  assert.throws(() => brandingFromSettings({}, "GST", () => ""), {
    status: 422,
  });
  assert.throws(() => brandingFromSettings(branding(), "NON_GST", () => ""), {
    status: 422,
  });
});
