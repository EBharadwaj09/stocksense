// Logs in to a running StockSense site as the demo user and saves screenshots.
//   node screenshots.mjs <base-url> <out-dir>
// Used by .github/workflows/screenshots.yml (the build sandbox can't reach the live site).
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [baseArg, outDir = "docs/screenshots"] = process.argv.slice(2);
const base = (baseArg || "https://stocksense-phi-tan.vercel.app").replace(/\/$/, "");
const here = dirname(fileURLToPath(import.meta.url));
const demo = JSON.parse(readFileSync(join(here, "../apps/web/src/lib/demo-account.json"), "utf8"));
mkdirSync(outDir, { recursive: true });

// [file name, path, wait for this text]
const PAGES = [
  ["overview", "/dashboard", "Overview"],
  ["reorder", "/dashboard/reorder", "Reorder"],
  ["stock", "/dashboard/stock", "Stock"],
  ["stock-count", "/dashboard/stock/count", "count"],
  ["sales", "/dashboard/sales", "Sales"],
  ["products", "/dashboard/products", "Products"],
];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await chromium.launch();
try {
  for (const [kind, opts] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...opts, locale: "en-IN", timezoneId: "Asia/Kolkata" });
    const page = await context.newPage();

    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(outDir, `${kind}-landing.png`) });

    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(outDir, `${kind}-login.png`) });
    await page.getByLabel("Email").fill(demo.email);
    await page.getByLabel("Password").fill(demo.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 30_000 });

    for (const [name, path, text] of PAGES) {
      await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15_000 });
      await page.screenshot({ path: join(outDir, `${kind}-${name}.png`), fullPage: kind === "mobile" ? false : true });
      console.log(`${kind} ${name} ok`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
