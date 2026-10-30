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
    flex-direction: column;
    background: #15151a;
    color: #e6e6e6;
    font: 13px/1.4 system-ui, sans-serif;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid #2c2c33;
    background: #1b1b21;
  }
  .brand { font-weight: 700; letter-spacing: .3px; margin-right: 8px; }
  .group { display: flex; align-items: center; gap: 6px; }
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
  button.active { background: #e6e6e6; color: #15151a; border-color: #e6e6e6; }
  main {
    flex: 1;
    display: flex;
    justify-content: center;
    overflow: auto;
    padding: 20px;
  }
  iframe {
    width: 390px;
    max-width: 100%;
    height: 844px;
    border: 1px solid #3a3a44;
    border-radius: 10px;
    background: #fff;
  }
</style>
</head>
<body>
<header>
  <div class="brand">TimeMapper Android</div>
  <div class="group" id="views">
    <button type="button" data-view="home" class="active">首頁</button>
    <button type="button" data-view="settings">設定</button>
  </div>
  <div class="group" id="widths">
    <span>Width</span>
    <button type="button" data-width="390" class="active">390</button>
    <button type="button" data-width="760">760</button>
    <button type="button" data-width="1280">1280</button>
  </div>
  <div class="group">
    <button type="button" id="reload">Reload</button>
  </div>
</header>
<main>
  <iframe id="frame" src="/src/app/index.html" title="Android preview"></iframe>
</main>
<script>
  const frame = document.getElementById("frame");
  const viewButtons = document.querySelectorAll("#views button");
  let ready = false;

  const syncView = () => {
    if (!ready) return;
    const view = frame.contentWindow.history.state?.view === "settings" ? "settings" : "home";
    viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  };

  frame.addEventListener("load", () => {
    ready = true;
    syncView();
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!ready) return;
      const target = frame.contentDocument.querySelector('.bottom-bar-item[data-view="' + button.dataset.view + '"]');
      if (!target) return;
      target.click();
      setTimeout(syncView, 120);
    });
  });

  document.querySelectorAll("#widths button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#widths button").forEach((item) => item.classList.toggle("active", item === button));
      frame.style.width = button.dataset.width + "px";
    });
  });

  document.getElementById("reload").addEventListener("click", () => {
    ready = false;
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
