const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "UPLOAD-MANIFEST.json");
const ignored = new Set(["UPLOAD-MANIFEST.json"]);
const ignoredDirs = new Set([".git", "node_modules", ".vercel", ".netlify"]);

function walk(dir) {
  const entries = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    const rel = path.relative(root, fullPath).replace(/\\/g, "/");
    if (ignored.has(rel)) continue;
    if (item.isDirectory()) {
      if (ignoredDirs.has(item.name)) continue;
      entries.push(...walk(fullPath));
      continue;
    }
    if (/\.log$|\.zip$/.test(item.name)) continue;
    if (/^\.env/.test(item.name) && item.name !== ".env.example") continue;
    const buffer = fs.readFileSync(fullPath);
    entries.push({
      path: rel,
      bytes: buffer.length,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

const files = walk(root);
const manifest = {
  generatedAt: new Date().toISOString(),
  app: "CardCortex",
  fileCount: files.length,
  files,
};

fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, output)} with ${files.length} files.`);
