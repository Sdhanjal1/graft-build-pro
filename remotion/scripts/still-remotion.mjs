import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compId = process.argv[2];
const outPath = process.argv[3];
const frame = parseInt(process.argv[4] ?? "0", 10);
const inputProps = process.argv[5] ? JSON.parse(process.argv[5]) : {};

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl: bundled, id: compId, puppeteerInstance: browser, inputProps });
await renderStill({ composition, serveUrl: bundled, output: outPath, frame, puppeteerInstance: browser, inputProps });
await browser.close({ silent: false });
console.log("Still:", outPath);
