// node preview.js <t1,t2,...> <out_dir>  -> PNG per time
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto("file://" + path.resolve(__dirname, "index.html"));
  await p.evaluate(() => window.__ready);
  console.log("rows", (await p.evaluate(() => window.capReport())).join(","));
  for (const t of process.argv[2].split(",").map(Number)) {
    await p.evaluate((x) => window.seek(x), t);
    await p.screenshot({ path: path.join(process.argv[3], `t${t}.png`) });
  }
  await b.close();
})();
