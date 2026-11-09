const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const sharp = require("sharp");
const { renderPdf, brandingFromSettings } = require("../serviceReports/pdf");
const {
  branding,
  logoPath,
} = require("../scripts/service-reports/local-fixture");
const { fixture } = require("./service-reports-fixtures");
const dir = path.join(__dirname, "fixtures/service-reports");
for (const scenario of [
  "gst-approved",
  "non-gst-approved",
  "gst-draft",
  "non-gst-draft",
  "long-captions",
  "long-followup",
  "oversized-caption",
]) {
  test(`measured PDF layout: ${scenario}`, async () => {
    const type = scenario.startsWith("non-gst") ? "NON_GST" : "GST",
      content = fixture(type);
    const files = [0, 1, 2, 3].map((n) => ({
      id: `PHOTO-${n}`,
      kind: "photo",
      category: [
        "Before Treatment",
        "During Treatment",
        "After Treatment",
        "Monitoring Devices",
      ][n],
      caption:
        scenario === "long-captions"
          ? `Caption ${n}: ` +
            "Synthetic caption wraps without losing its corresponding image. ".repeat(
              16,
            )
          : `Synthetic treatment photograph ${n}`,
      area: "QA kitchen",
      mime_type: "image/png",
      include_in_pdf: 1,
      created_at: "2026-11-07T10:00:00Z",
    }));
    if (scenario === "oversized-caption")
      files[0].caption =
        "Synthetic maximum caption retains every word. ".repeat(125) +
        "MAX_CAPTION_SENTINEL";
    files.push({
      ...files[0],
      id: "MAP",
      kind: "siteMap",
      category: "Treatment Diagram",
      caption:
        scenario === "long-captions"
          ? "Diagram caption and monitoring markers. ".repeat(20)
          : "Synthetic site diagram",
      annotations: "M-01: synthetic monitoring point",
    });
    files.push(
      ...["technicianSignature", "customerSignature"].map((kind) => ({
        ...files[0],
        id: kind,
        kind,
      })),
    );
    content.acknowledgement.customerResponse = "Signed";
    if (scenario === "long-followup") {
      content.followup.reason =
        "Lengthy synthetic follow-up paragraph. ".repeat(120);
      content.followup.correctiveActions =
        "Lengthy corrective action to retain in output. ".repeat(110);
      content.followup.customerInstructions =
        "Long closing instructions retained across pages. ".repeat(100) +
        " FINAL_FOLLOWUP_SENTINEL";
    }
    const state = scenario.endsWith("draft") ? "Draft" : "Approved";
    const snapshot = {
      reportNumber: `QA-CORRECTION-${scenario}`,
      revision: 1,
      state,
      preparedBy: "QA Technician",
      recordedBy: { name: "QA Reviewer" },
      recordedAt: "2026-11-07T10:15:00Z",
      content,
      files,
      branding: brandingFromSettings(branding(), type, () => logoPath),
    };
    const fragments = [],
      layout = [];
    const bytes = await renderPdf(snapshot, {
      readFile: (f) =>
        fs.readFileSync(
          path.join(
            dir,
            f.kind.endsWith("Signature") ? "signature.png" : "photo.png",
          ),
        ),
      onFragment: (f) => fragments.push(f),
      onLayout: (f) => layout.push(f),
    });
    const pages = Math.max(...fragments.map((f) => f.page)) + 1;
    const marks = fragments.filter((f) => f.text === "DRAFT");
    assert.equal(
      marks.length,
      state === "Approved" ? 0 : pages,
      "one watermark on every non-final page; none on Approved",
    );
    assert.equal(new Set(marks.map((f) => f.page)).size, marks.length);
    const dimensions = await sharp(
      fs.readFileSync(path.join(dir, "photo.png")),
    ).metadata();
    for (const file of files.filter((f) => !f.kind.endsWith("Signature"))) {
      const image = layout.find((f) => f.type === "image" && f.id === file.id);
      const captions = layout.filter(
        (f) => f.type === "media-text" && f.id === file.id,
      );
      assert(image, file.id);
      assert(
        captions.every(
          (f) => f.page === image.page && f.bottom <= image.y + 0.1,
        ),
        `caption and image stay together: ${file.id}`,
      );
      assert(
        Math.abs(
          image.width / image.height - dimensions.width / dimensions.height,
        ) < 0.001,
        "proportional image scaling",
      );
      assert(
        image.y + image.height <= 783.9 && image.y >= 144,
        "image stays inside content margins",
      );
    }
    if (scenario === "oversized-caption") {
      assert(
        fragments.some((f) => f.text.includes("MAX_CAPTION_SENTINEL")),
        "maximum caption retained",
      );
      assert.equal(
        fragments.find((f) => f.text.startsWith("6. Treatment")).page,
        fragments.find((f) =>
          f.text.startsWith("Before Treatment — Synthetic maximum"),
        ).page,
        "oversized caption starts with its heading",
      );
    }
    const title = fragments.find((f) => f.text.startsWith("10. Follow-up"));
    const first = fragments.find((f) =>
      f.text.startsWith("Follow-up required:"),
    );
    const approval = fragments.find((f) => f.text === "Approval");
    assert.equal(title.page, first.page, "follow-up heading stays with fields");
    if (scenario === "long-followup") {
      const tail = fragments.find((f) =>
        f.text.includes("FINAL_FOLLOWUP_SENTINEL"),
      );
      assert(tail, "all lengthy closing content retained");
      assert.equal(
        tail.page,
        approval.page,
        "approval stays with end of lengthy follow-up",
      );
    } else if (state === "Approved")
      assert.equal(
        title.page,
        approval.page,
        "complete short follow-up and approval remain together",
      );
    const ack = fragments.find((f) => f.text.startsWith("8. Signatures"));
    if (scenario !== "long-followup")
      assert.equal(
        ack.page,
        title.page,
        "short sign-off and follow-up stay together instead of creating an almost-empty final page",
      );
    for (const label of ["Technician signature", "Customer signature"])
      assert.equal(
        fragments.find((f) => f.text === label).page,
        ack.page,
        "practical signature block stays with acknowledgement",
      );
    for (const f of fragments)
      assert(
        f.y >= 40 && f.y + f.height <= 816 && f.x >= 54 && f.x + f.width <= 542,
        `fragment within A4 margins: ${f.text}`,
      );
    const text = fragments.map((f) => f.text).join(" ");
    assert(!text.includes("CONFIDENTIAL_INTERNAL_SENTINEL"));
    if (process.env.SERVICE_REPORT_ARTIFACT_DIR) {
      fs.mkdirSync(process.env.SERVICE_REPORT_ARTIFACT_DIR, {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(process.env.SERVICE_REPORT_ARTIFACT_DIR, scenario + ".pdf"),
        bytes,
      );
      fs.writeFileSync(
        path.join(
          process.env.SERVICE_REPORT_ARTIFACT_DIR,
          scenario + "-layout.json",
        ),
        JSON.stringify({ fragments, layout }, null, 2),
      );
    }
  });
}
