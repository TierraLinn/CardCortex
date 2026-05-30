const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const liveBase = (process.env.LIVE_URL || "https://tierralinn.github.io/CardCortex/").replace(/\/?$/, "/");
const output = path.join(root, "LIVE-DELTA-REPORT.md");
const checks = [
  ["index.html", ""],
  ["vault.html", "vault.html"],
  ["scanner.html", "scanner.html"],
  ["catalog-sources.html", "catalog-sources.html"],
  ["pricing.html", "pricing.html"],
  ["grading.html", "grading.html"],
  ["marketplace.html", "marketplace.html"],
  ["assistant.html", "assistant.html"],
  ["auth.html", "auth.html"],
  ["backend-status.html", "backend-status.html"],
  ["app.js", "app.js"],
  ["supabase-client.js", "supabase-client.js"],
  ["backend-status.js", "backend-status.js"],
  ["catalog-sources.js", "catalog-sources.js"],
  ["sw.js", "sw.js"],
];

async function compare() {
  const rows = [];
  for (const [localFile, livePath] of checks) {
    const localPath = path.join(root, localFile);
    const localExists = fs.existsSync(localPath);
    const localSize = localExists ? fs.statSync(localPath).size : 0;
    const url = new URL(livePath, liveBase).toString();
    try {
      const response = await fetch(url, { redirect: "follow" });
      const body = await response.arrayBuffer();
      rows.push({
        file: localFile,
        url,
        status: response.status,
        localSize,
        liveSize: body.byteLength,
        current: response.ok && localSize === body.byteLength,
      });
    } catch (error) {
      rows.push({ file: localFile, url, status: "ERR", localSize, liveSize: 0, current: false, error: error.message });
    }
  }
  return rows;
}

function render(rows) {
  const stale = rows.filter((row) => !row.current);
  return `# CardCortex Live Delta Report

Generated: ${new Date().toISOString()}

Live URL: ${liveBase}

Current files: ${rows.length - stale.length}/${rows.length}

${stale.length ? "The live site is reachable but does not match the local production package yet." : "The live site matches the checked local production files."}

| File | Live status | Local bytes | Live bytes | Current |
| --- | ---: | ---: | ---: | --- |
${rows.map((row) => `| ${row.file} | ${row.status} | ${row.localSize} | ${row.liveSize} | ${row.current ? "yes" : "no"} |`).join("\n")}

## Publish Action

Upload the contents of:

\`\`\`text
C:\\Users\\tierr\\Documents\\Codex\\2026-05-03\\i-want-to-create-a-factory\\CardCortex-GitHub-Upload-Folder
\`\`\`

or upload:

\`\`\`text
C:\\Users\\tierr\\Documents\\Codex\\2026-05-03\\i-want-to-create-a-factory\\CardCortex-Production-Deploy.zip
\`\`\`
`;
}

compare()
  .then((rows) => {
    fs.writeFileSync(output, render(rows));
    const stale = rows.filter((row) => !row.current);
    console.log(`Wrote LIVE-DELTA-REPORT.md. Current files: ${rows.length - stale.length}/${rows.length}`);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
