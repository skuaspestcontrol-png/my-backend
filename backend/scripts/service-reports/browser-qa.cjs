const { chromium } = require(
  process.env.SERVICE_REPORT_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("fs"),
  assert = require("assert/strict");
const { cookie } = require("./local-server");
const origin = "http://127.0.0.1:5188",
  root =
    process.env.SERVICE_REPORT_ARTIFACT_DIR ||
    "/tmp/skuas-service-reports-phase2/review";
const refs = JSON.parse(
  fs.readFileSync("/tmp/skuas-service-reports-phase2/review-records.json"),
);
const shots = root + "/screenshots";
fs.mkdirSync(shots, { recursive: true });
const results = { errors: [], failedApi: [], screenshots: [], checks: [] };
(async () => {
  const browser = await chromium.launch({
    ...(process.env.SERVICE_REPORT_CHROME
      ? { executablePath: process.env.SERVICE_REPORT_CHROME }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext();
    const session = cookie("manager");
    await context.addCookies([
      {
        name: session.split("=")[0],
        value: session.split("=").slice(1).join("="),
        url: origin,
      },
    ]);
    await context.addInitScript((theme) => {
      localStorage.setItem("skuas-theme", theme);
      localStorage.setItem(
        "skuas_branding_settings",
        JSON.stringify({
          brandingAppearance: "light",
          brandingAccentColor: "#1d2547",
        }),
      );
    }, theme);
    await context.route("**/*", (r) =>
      r.request().url().startsWith(origin) ? r.continue() : r.abort(),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes("/api/service-reports") && r.status() >= 400)
        results.failedApi.push({ url: r.url(), status: r.status() });
    });
    page.on("dialog", (d) => d.accept());
    const shot = async (name) => {
      await page.screenshot({ path: `${shots}/${name}.png` });
      results.screenshots.push(`${name}.png`);
    };
    for (const width of [1920, 1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.goto(origin + "/operations/service-reports");
      await page.locator(".sr-table-scroll tbody tr").first().waitFor();
      const bounds = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        module: document.querySelector(".sr-page").getBoundingClientRect()
          .width,
        tableScroll: document.querySelector(".sr-table-scroll").scrollWidth,
        tableViewport: document.querySelector(".sr-table-scroll").clientWidth,
        columns: document.querySelectorAll(".sr-table-scroll thead th").length,
        theme: document.documentElement.dataset.theme,
      }));
      assert(bounds.document <= width + 2, JSON.stringify(bounds));
      assert.equal(bounds.columns, 10);
      assert.equal(bounds.theme, theme);
      results.checks.push({
        name: "dashboard-responsive",
        width,
        theme,
        ...bounds,
      });
      await shot(`dashboard-${theme}-${width}-top`);
      await page.locator(".sr-table-scroll").scrollIntoViewIfNeeded();
      await shot(`dashboard-${theme}-${width}-table`);
      await page
        .locator(".sr-table-scroll")
        .evaluate((e) => (e.scrollLeft = e.scrollWidth));
      const trigger = page
        .getByRole("button", { name: "Action", exact: true })
        .first();
      await trigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300); // Let the existing scroll-close menu policy settle.
      await trigger.click({ force: true });
      const menu = page.locator('[data-action-menu="true"]');
      await menu.waitFor();
      const box = await menu.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1);
      await shot(`actions-${theme}-${width}`);
      await page.keyboard.press("Escape");
      await page.mouse.click(4, 80);
      await page.goto(origin + `/operations/service-reports/${refs.draft}`);
      await page
        .getByRole("button", { name: "Edit report", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Edit report", exact: true })
        .click();
      await page.locator(".sr-wizard").waitFor();
      const wizard = await page.locator(".sr-wizard").boundingBox();
      assert(wizard.x >= 0 && wizard.x + wizard.width <= width + 2);
      await shot(`form-${theme}-${width}-header`);
      if (width === 1440) {
        for (let step = 1; step <= 10; step++) {
          const body = page.locator(".crm-wizard-body");
          const dimensions = await body.evaluate((e) => ({
            height: e.clientHeight,
            total: e.scrollHeight,
          }));
          const offsets = [];
          for (
            let y = 0;
            y < dimensions.total;
            y += Math.max(200, Math.floor(dimensions.height * 0.78))
          )
            offsets.push(Math.min(y, dimensions.total - dimensions.height));
          if (
            !offsets.includes(Math.max(0, dimensions.total - dimensions.height))
          )
            offsets.push(Math.max(0, dimensions.total - dimensions.height));
          for (const [i, y] of [...new Set(offsets)].entries()) {
            await body.evaluate((e, y) => (e.scrollTop = y), y);
            await shot(
              `form-${theme}-section-${String(step).padStart(2, "0")}-part-${i + 1}`,
            );
          }
          results.checks.push({
            name: "wizard-section",
            theme,
            step,
            ...dimensions,
          });
          await page.getByRole("button", { name: "Next", exact: true }).click();
        }
        await page
          .getByRole("heading", { name: "Review & save", exact: true })
          .waitFor();
        await shot(`form-${theme}-review`);
      }
      if (width === 390) {
        const wizard = page.locator(".sr-wizard");
        for (let step = 1; step < 6; step++)
          await wizard
            .getByRole("button", { name: "Next", exact: true })
            .click();
        await page
          .locator(".crm-wizard-panel:not([hidden]) .sr-evidence-card img")
          .first()
          .scrollIntoViewIfNeeded();
        const current = await page
          .locator('.sr-wizard [aria-current="step"]')
          .boundingBox();
        assert(
          current.x >= 0 && current.x + current.width <= width + 1,
          "Current mobile step remains visible",
        );
        await shot(`form-${theme}-390-photographs`);
        for (let step = 6; step < 8; step++)
          await wizard
            .getByRole("button", { name: "Next", exact: true })
            .click();
        const canvas = page
          .locator(".crm-wizard-panel:not([hidden]) canvas")
          .first();
        await canvas.scrollIntoViewIfNeeded();
        const bounds = await canvas.boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        await shot(`form-${theme}-390-signatures`);
        results.checks.push({
          name: "mobile-progress-photo-signature",
          theme,
          width,
        });
      }
      await page
        .getByRole("button", { name: "Close", exact: true })
        .last()
        .click();
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(origin + `/operations/service-reports/${refs.submitted}`);
    await page.getByRole("button", { name: "Approve", exact: true }).waitFor();
    await shot(`approval-${theme}-detail`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page
      .getByRole("heading", { name: "Approve report", exact: true })
      .waitFor();
    await shot(`approval-${theme}-confirm`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto(origin + `/operations/service-reports/${refs.approved}`);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page
      .getByRole("heading", { name: "Version & audit history", exact: true })
      .waitFor();
    await shot(`history-${theme}`);
    await page
      .getByRole("button", { name: "Close history", exact: true })
      .click();
    await page.goto(origin + "/operations/service-reports");
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await page
      .getByRole("heading", { name: "Service Report access", exact: true })
      .waitFor();
    await shot(`permissions-${theme}`);
    await page
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    await context.close();
  }
  await browser.close();
  assert.equal(results.errors.length, 0, JSON.stringify(results.errors));
  assert.equal(results.failedApi.length, 0, JSON.stringify(results.failedApi));
  fs.writeFileSync(
    root + "/browser-validation.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `Browser QA passed: ${results.checks.length} checks; ${results.screenshots.length} screenshots`,
  );
})().catch((error) => {
  fs.writeFileSync(
    root + "/browser-validation.json",
    JSON.stringify({ ...results, failure: error.stack }, null, 2),
  );
  console.error(error);
  process.exit(1);
});
