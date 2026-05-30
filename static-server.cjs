const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 4192);
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const cleanRoutes = {
  "/vault": "/vault.html",
  "/scanner": "/scanner.html",
  "/sources": "/catalog-sources.html",
  "/catalog-sources": "/catalog-sources.html",
  "/values": "/pricing.html",
  "/pricing": "/pricing.html",
  "/grading": "/grading.html",
  "/sell": "/marketplace.html",
  "/marketplace": "/marketplace.html",
  "/assistant": "/assistant.html",
  "/account": "/auth.html",
  "/auth": "/auth.html",
  "/backend-status": "/backend-status.html",
  "/privacy": "/privacy.html",
  "/terms": "/terms.html",
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const route = url.pathname === "/" ? "/index.html" : cleanRoutes[url.pathname] || url.pathname;
  const filePath = path.normalize(path.join(root, decodeURIComponent(route)));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, body) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(body);
  });
}).listen(port, () => console.log(`CardCortex running at http://localhost:${port}`));
