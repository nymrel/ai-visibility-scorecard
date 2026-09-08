import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const toolPath = "/tools/ai-visibility-scorecard/";
const storeKey = "jbt.scorecard.checks";
const sentinel = "nymrel-local-only-8675309";

test.beforeEach(async ({ page }) => {
  await page.goto(toolPath, { waitUntil: "domcontentloaded" });
});

test("starts as a twenty-item foundations audit", async ({ page }) => {
  await expect(page.locator("#scoreVal")).toHaveText("0");
  await expect(page.locator("#gradeLabel")).toHaveText("Needs foundations");
  await expect(page.locator("#scoreCount")).toHaveText("0 / 20 checks");
  await expect(page.locator(".check-row input")).toHaveCount(20);
  await expect(page.locator("#fixList .fix")).toHaveCount(20);
  await expect(page.locator("#fixLead")).toContainText("Nymrel's editorial weights");
});

test("loads the deterministic example without presenting it as provider evidence", async ({ page }) => {
  await page.locator("#tryBtn").click();
  await expect(page.locator("#scoreVal")).toHaveText("49");
  await expect(page.locator("#gradeLabel")).toHaveText("Developing");
  await expect(page.locator("#scoreCount")).toHaveText("10 / 20 checks");
  await expect(page.locator("#exampleBanner")).toBeVisible();
  await expect(page.locator("#exampleBanner")).toContainText("Example site");
});

test("persists checked identifiers locally without attaching them to requests", async ({ page }) => {
  const leakedRequests = [];
  page.on("request", (request) => {
    const requestText = request.url() + "\n" + (request.postData() ?? "");
    if (requestText.includes(sentinel)) leakedRequests.push(requestText);
  });

  await page.evaluate(({ key, marker }) => {
    localStorage.setItem(key, JSON.stringify([marker]));
  }, { key: storeKey, marker: sentinel });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(leakedRequests).toEqual([]);

  await page.locator('[data-id="robots"]').check();
  await page.locator('[data-id="sitemap"]').check();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storeKey);
  expect(stored).toEqual(["robots", "sitemap"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-id="robots"]')).toBeChecked();
  await expect(page.locator('[data-id="sitemap"]')).toBeChecked();
  await expect(page.locator("#scoreCount")).toHaveText("2 / 20 checks");
});

test("labels a complete self-audit without promising outcomes", async ({ page }) => {
  const boxes = page.locator(".check-row input");
  for (let index = 0; index < await boxes.count(); index += 1) {
    await boxes.nth(index).check();
  }
  await expect(page.locator("#scoreVal")).toHaveText("100");
  await expect(page.locator("#gradeLabel")).toHaveText("Strong foundation");
  await expect(page.locator("#scoreCount")).toHaveText("20 / 20 checks");
  await expect(page.locator("#fixList .all-good")).toContainText(
    "does not guarantee crawling, indexing, ranking, citation, recommendation, or traffic",
  );
});

test("has no serious accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking).toEqual([]);
});

test("remains usable without horizontal overflow", async ({ page }) => {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
});
