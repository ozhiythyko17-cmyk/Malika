// Renders every frame of index.html with Playwright (4 parallel workers) and encodes with ffmpeg.
// Usage: node render.js <out.mp4> [workers]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const OUT = path.resolve(process.argv[2] || "out/video.mp4");
const WORKERS = Number(process.argv[3] || 4);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asamerta-frames-"));
const url = "file://" + path.resolve(__dirname, "index.html");

(async () => {
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(url);
    await page.evaluate(() => window.__ready);
    return page;
  };
  const first = await mk();
  const info = await first.evaluate(() => ({ total: window.TIMINGS.total, fps: window.TIMINGS.fps, rows: window.capReport() }));
  console.log("caption rows per chunk:", info.rows.join(","));
  if (Math.max(...info.rows) > 2) throw new Error("a caption chunk needs more than 2 lines");
  const frames = Math.floor(info.total * info.fps);
  const pages = [first, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, mk)))];
  let done = 0;
  await Promise.all(pages.map(async (page, w) => {
    for (let f = w; f < frames; f += WORKERS) {
      await page.evaluate((t) => window.seek(t), f / info.fps);
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93 });
      if (++done % 150 === 0) console.log(`${done}/${frames}`);
    }
  }));
  await browser.close();
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(info.fps), "-i", path.join(dir, "f%05d.jpg"),
    "-i", path.resolve(__dirname, "out/mix.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT], { stdio: "inherit" });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("wrote", OUT);
})();
