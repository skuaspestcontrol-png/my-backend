// Full local CRM workflow against the real feature router and disposable MySQL.
const { chromium } = require(
  process.env.SERVICE_REPORT_PLAYWRIGHT_MODULE || "playwright",
);
const { cookie } = require("./local-server");
const { fixture } = require("../../test/service-reports-fixtures");
const schema = require("../../serviceReports/schema.json");
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  crypto = require("crypto");
const origin = "http://127.0.0.1:5188",
  base = origin + "/api/service-reports",
  root =
    process.env.SERVICE_REPORT_ARTIFACT_DIR ||
    "/tmp/skuas-service-reports-phase2/review";
const result = { checks: [], errors: [] };
(async () => {
  const browser = await chromium.launch({
    ...(process.env.SERVICE_REPORT_CHROME
      ? { executablePath: process.env.SERVICE_REPORT_CHROME }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  await context.route("**/*", (r) =>
    r.request().url().startsWith(origin) ? r.continue() : r.abort(),
  );
  const session = cookie("technician");
  await context.addCookies([
    {
      name: session.split("=")[0],
      value: session.split("=").slice(1).join("="),
      url: origin,
    },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(e.message));
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    d.accept();
  });
  const panel = () => page.locator(".crm-wizard-panel:not([hidden])");
  const fields = async (defs, values) => {
    for (const [key, label, type] of defs) {
      if (key === "photoIds" || !values[key]) continue;
      const control = panel().getByLabel(label, { exact: true });
      if (type === "select") await control.selectOption(values[key]);
      else await control.fill(String(values[key]));
    }
  };
  const next = () =>
    page
      .locator(".sr-wizard")
      .getByRole("button", { name: "Next", exact: true })
      .click();
  const requestDone = (method, suffix) =>
    page.waitForResponse(
      (r) =>
        r.url().startsWith(base) &&
        r.url().endsWith(suffix) &&
        r.request().method() === method &&
        r.status() < 300,
    );
  await page.goto(origin + "/operations/service-reports");
  await page.getByRole("button", { name: "New report", exact: true }).click();
  await page.locator(".sr-wizard").waitFor();
  assert(page.url().endsWith("/new"));
  await panel()
    .getByLabel("Search CRM customers", { exact: true })
    .fill("QA Example");
  await panel()
    .getByLabel("CRM customer *", { exact: true })
    .selectOption("QA-CUSTOMER-1");
  await panel()
    .getByLabel("Property / site record", { exact: true })
    .selectOption("QA-SITE-1");
  await panel()
    .getByLabel("Linked job", { exact: true })
    .selectOption("QA-JOB-1");
  await panel()
    .getByLabel("Contract reference", { exact: true })
    .selectOption("invoice:QA-INVOICE-1");
  await panel()
    .getByLabel("Service schedule", { exact: true })
    .selectOption("QA-INVOICE-1-2026-11-07-1-0");
  await panel()
    .getByLabel("Assigned technicians", { exact: true })
    .selectOption(["QA-EMP-2"]);
  const content = fixture();
  content.acknowledgement.customerResponse = "Signed";
  content.acknowledgement.reason = "";
  await fields(schema.sections[0].fields, content.header);
  let created;
  const createWait = page.waitForResponse(
    (r) => r.url() === base + "/" && r.request().method() === "POST",
  );
  await panel()
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  created = await (await createWait).json();
  assert(created.external_id);
  result.checks.push(
    "UI draft creation with genuine CRM customer/job/site/contract links",
  );
  await next();
  await fields(schema.sections[1].fields, content.summary);
  await next();
  await page
    .locator(".sr-wizard")
    .getByRole("button", { name: "Back", exact: true })
    .click();
  assert.equal(
    await panel().getByLabel("Main findings", { exact: true }).inputValue(),
    content.summary.mainFindings,
  );
  result.checks.push("Wizard Back/Next preserves entered values");
  await next();
  await panel()
    .getByRole("button", { name: "Add finding", exact: true })
    .click();
  await fields(schema.sections[2].fields, content.findings[0]);
  await next();
  await panel()
    .getByRole("button", { name: "Add treatment", exact: true })
    .click();
  await fields(schema.sections[3].fields, content.treatments[0]);
  await panel()
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await fields(
    schema.sections[3].productFields,
    content.treatments[0].products[0],
  );
  await fields(schema.sections[3].safetyFields, content.safety);
  await next();
  await panel()
    .getByRole("button", { name: "Add recommendation", exact: true })
    .click();
  await fields(schema.sections[4].fields, content.recommendations[0]);
  await next();
  let fileWait = requestDone("POST", "/files");
  await panel()
    .getByLabel("Caption", { exact: true })
    .fill("SYNTHETIC QA photo uploaded through the CRM");
  await panel()
    .getByLabel("Upload Treatment photographs", { exact: true })
    .setInputFiles(
      path.join(__dirname, "../../test/fixtures/service-reports/photo.png"),
    );
  await fileWait;
  await panel().locator(".sr-evidence-card img").waitFor();
  result.checks.push(
    "Photo upload, private compressed preview and draft preservation through the UI",
  );
  await next();
  fileWait = requestDone("POST", "/files");
  await panel()
    .getByLabel("Caption", { exact: true })
    .fill("SYNTHETIC QA diagram");
  await panel()
    .getByLabel("Annotations / monitoring markers", { exact: true })
    .fill("M-01: synthetic monitoring point");
  await panel()
    .getByLabel("Upload Site maps & diagrams", { exact: true })
    .setInputFiles(
      path.join(__dirname, "../../test/fixtures/service-reports/photo.png"),
    );
  await fileWait;
  await next();
  await fields(schema.sections[7].fields, content.acknowledgement);
  await next();
  await panel().getByLabel("Category", { exact: true }).selectOption("Other");
  await panel()
    .getByLabel("Caption", { exact: true })
    .fill("SYNTHETIC QA supporting document");
  fileWait = requestDone("POST", "/files");
  await panel()
    .getByLabel("Upload Supporting attachments", { exact: true })
    .setInputFiles(path.join(root, "pdfs/gst.pdf"));
  await fileWait;
  await next();
  await fields(schema.sections[9].fields, content.followup);
  await next();
  await panel()
    .getByRole("heading", { name: "Final signatures", exact: true })
    .waitFor();
  const sign = async (index) => {
    const group = panel().locator(".sr-signature").nth(index),
      canvas = group.locator("canvas"),
      box = await canvas.boundingBox();
    await canvas.scrollIntoViewIfNeeded();
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x + 30, b.y + 65);
    await page.mouse.down();
    for (let x = 40; x < 220; x += 20)
      await page.mouse.move(b.x + x, b.y + 50 + (x % 40), { steps: 2 });
    await page.mouse.up();
    const done = requestDone("POST", "/files");
    await group
      .getByRole("button", { name: "Save signature", exact: true })
      .click();
    await done;
    await group.locator("img").waitFor();
  };
  await sign(0);
  await sign(1);
  result.checks.push(
    "Technician and customer signatures captured after all ten sections",
  );
  await panel()
    .getByRole("heading", { name: "Final signatures", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(root, "screenshots/final-review-signatures.png"),
  });
  await page
    .getByRole("button", { name: "Save report draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .waitFor();
  assert.equal(dialogs, 0, "Saved drafts should not trigger a discard prompt");
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .locator(".sr-detail-head .sr-status")
    .filter({ hasText: "Submitted" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Edit report", exact: true })
      .count(),
    0,
  );
  result.checks.push("Server-confirmed UI submission locks editing");
  const reviewer = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  await reviewer.route("**/*", (r) =>
    r.request().url().startsWith(origin) ? r.continue() : r.abort(),
  );
  // Native OS share sheets are device acceptance; force the documented download fallback here.
  await reviewer.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  const reviewCookie = cookie("reviewer");
  await reviewer.addCookies([
    {
      name: reviewCookie.split("=")[0],
      value: reviewCookie.split("=").slice(1).join("="),
      url: origin,
    },
  ]);
  const review = await reviewer.newPage();
  await review.goto(
    origin + `/operations/service-reports/${created.external_id}`,
  );
  await review.getByRole("button", { name: "Approve", exact: true }).click();
  await review.getByRole("button", { name: "Confirm", exact: true }).click();
  await review
    .locator(".sr-detail-head .sr-status")
    .filter({ hasText: "Approved" })
    .waitFor();
  result.checks.push("Independent reviewer approval through the CRM");
  const download = review.waitForEvent("download");
  await review.getByRole("button", { name: "Final PDF", exact: true }).click();
  const file = await download;
  const pdfPath = path.join(root, "pdfs/browser-created-approved.pdf");
  await file.saveAs(pdfPath);
  assert.equal(fs.readFileSync(pdfPath).subarray(0, 4).toString(), "%PDF");
  result.checks.push(
    "Authenticated final PDF download for the UI-created report",
  );
  const share = review.waitForEvent("download");
  await review.getByRole("button", { name: "Share PDF", exact: true }).click();
  const shared = await share;
  const sharedPath = path.join(root, "pdfs/browser-share-fallback.pdf");
  await shared.saveAs(sharedPath);
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(sharedPath))
      .digest("hex"),
    crypto.createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex"),
  );
  result.checks.push(
    "Device-share download fallback preserves final PDF bytes",
  );
  await reviewer.clearCookies();
  await review.getByRole("button", { name: "History", exact: true }).click();
  await review
    .locator(".sr-error")
    .filter({ hasText: "Authenticated staff session required" })
    .waitFor();
  result.checks.push(
    "Expired session is rejected by the server and shown clearly",
  );
  await page.goto(origin + "/operations/service-reports/new");
  await page.locator(".sr-wizard").waitFor();
  await panel()
    .getByLabel("CRM customer *", { exact: true })
    .selectOption("QA-CUSTOMER-1");
  const fail = (route) => route.abort();
  await page.route(base + "/", fail);
  await panel()
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await page
    .locator(".crm-wizard-error")
    .filter({ hasText: "Network Error" })
    .waitFor();
  assert.equal(
    await panel().getByLabel("CRM customer *", { exact: true }).inputValue(),
    "QA-CUSTOMER-1",
  );
  await page.unroute(base + "/", fail);
  const retried = page.waitForResponse(
    (r) => r.url() === base + "/" && r.request().method() === "POST",
  );
  await panel()
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  assert.equal((await retried).status(), 201);
  result.checks.push(
    "Network failure keeps draft fields and retry succeeds without false submission",
  );
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  await browser.close();
  result.reportId = created.external_id;
  fs.writeFileSync(
    path.join(root, "browser-behavior.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(`Browser workflow passed: ${result.checks.length} checks`);
})().catch((error) => {
  fs.writeFileSync(
    path.join(root, "browser-behavior.json"),
    JSON.stringify({ ...result, failure: error.stack }, null, 2),
  );
  console.error(error);
  process.exit(1);
});
