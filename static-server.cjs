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

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const route = url.pathname === "/" ? "/index.html" : url.pathname;
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
