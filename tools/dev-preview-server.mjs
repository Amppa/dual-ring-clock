import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 4173;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8"
};

const harness = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TimeMapper Android preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: row;
    background: #15151a;
    color: #e6e6e6;
    font: 13px/1.4 system-ui, sans-serif;
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 18px;
    flex: 0 0 auto;
    width: 220px;
    padding: 14px;
    border-right: 1px solid #2c2c33;
    background: #1b1b21;
  }
  .brand { font-weight: 700; letter-spacing: .3px; }
  .group { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
  .group span { color: #9a9aa5; }
  button {
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid #3a3a44;
    border-radius: 7px;
    background: #23232b;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover { border-color: #5a5a68; }
  button[aria-pressed="true"] { background: #e6e6e6; color: #15151a; border-color: #e6e6e6; }
  select {
    min-height: 30px;
    padding: 0 8px;
    border: 1px solid #3a3a44;
    border-radius: 7px;
    background: #23232b;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  select:hover { border-color: #5a5a68; }
  main {
    flex: 1;
    display: flex;
    justify-content: center;
    overflow: auto;
    padding: 20px;
  }
  iframe {
    width: 412px;
    height: 915px;
    border: 1px solid #3a3a44;
    border-radius: 10px;
    background: #fff;
  }
</style>
</head>
<body>
<aside>
  <div class="brand">TimeMapper Android</div>
  <div class="group" id="devices">
    <span>Device</span>
    <select id="device" aria-label="Device preset">
      <option value="pixel-7" selected>Pixel 7 · 412×915 · 420dpi</option>
      <option value="pixel-5">Pixel 5 · 393×851 · 440dpi</option>
      <option value="galaxy-s21">Galaxy S21 · 360×800 · 480dpi</option>
      <option value="galaxy-tab-s8">Galaxy Tab S8 · 800×1280 · 276dpi</option>
      <option value="desktop-1280">Desktop 1280 · 1280×800 · 160dpi</option>
    </select>
  </div>
  <div class="group">
    <button type="button" id="dark" aria-pressed="false">深色</button>
  </div>
  <div class="group">
    <button type="button" id="reload">Reload</button>
  </div>
</aside>
<main>
  <iframe id="frame" src="/src/app/index.html" title="Android preview"></iframe>
</main>
<script>
  const frame = document.getElementById("frame");
  const darkToggle = document.getElementById("dark");

  const isDark = () => frame.contentDocument?.documentElement.dataset.theme === "dark";

  const syncTheme = () => {
    darkToggle.setAttribute("aria-pressed", String(isDark()));
  };

  frame.addEventListener("load", syncTheme);

  darkToggle.addEventListener("click", () => {
    if (!frame.contentDocument || !frame.contentWindow.TimeMapperTheme) return;
    const next = isDark() ? "light" : "dark";
    frame.contentWindow.TimeMapperTheme.apply(next);
    darkToggle.setAttribute("aria-pressed", String(next === "dark"));
  });

  const devicePresets = {
    "pixel-7": { width: 412, height: 915, dpi: 420 },
    "pixel-5": { width: 393, height: 851, dpi: 440 },
    "galaxy-s21": { width: 360, height: 800, dpi: 480 },
    "galaxy-tab-s8": { width: 800, height: 1280, dpi: 276 },
    "desktop-1280": { width: 1280, height: 800, dpi: 160 }
  };
  // Pixel 7 (420dpi) is the 1:1 baseline; zoom scales the frame by relative density.
  const baseDpi = 420;
  const deviceSelect = document.getElementById("device");

  const applyDevice = () => {
    const preset = devicePresets[deviceSelect.value] || devicePresets["pixel-7"];
    frame.style.width = preset.width + "px";
    frame.style.height = preset.height + "px";
    frame.style.zoom = String(Math.round((preset.dpi / baseDpi) * 1000) / 1000);
  };

  deviceSelect.addEventListener("change", applyDevice);
  applyDevice();

  document.getElementById("reload").addEventListener("click", () => {
    frame.src = frame.src;
  });
</script>
</body>
</html>
`;

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (pathname === "/_dev" || pathname === "/_dev/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(harness);
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(302, { Location: "/src/app/index.html" });
    res.end();
    return;
  }

  const relative = decodeURIComponent(pathname);
  const filePath = path.resolve(root, "." + relative);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[dev] Local browser preview server running:`);
  console.log(`      > Live App (Direct):       http://127.0.0.1:${port}/`);
  console.log(`      > Mobile Frame Simulator:  http://127.0.0.1:${port}/_dev`);
  console.log(`      Source files in src/ are served live (refresh browser on change).`);
});
