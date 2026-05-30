const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.VERIFY_PORT || 4292);
const baseUrl = `http://localhost:${port}`;
const liveUrl = process.env.LIVE_URL || "https://tierralinn.github.io/CardCortex/";
const liveRequired = process.argv.includes("--live-required") || process.env.LIVE_REQUIRED === "1";
const routes = [
  ["/", "CardCortex | AI Trading Card Vault"],
  ["/vault", "Vault | CardCortex"],
  ["/scanner", "Scanner | CardCortex"],
  ["/sources", "Catalog Sources | CardCortex"],
  ["/catalog-sources", "Catalog Sources | CardCortex"],
  ["/values", "Values | CardCortex"],
  ["/grading", "AI Grading | CardCortex"],
  ["/sell", "Sell | CardCortex"],
  ["/assistant", "AI Assistant | CardCortex"],
  ["/account", "Account | CardCortex"],
  ["/backend-status", "Backend Status | CardCortex"],
  ["/privacy", "Privacy | CardCortex"],
  ["/terms", "Terms | CardCortex"],
];
const requiredFiles = [
  "index.html",
  "vault.html",
  "scanner.html",
  "catalog-sources.html",
  "backend-status.html",
  "auth.html",
  "app.js",
  "supabase-client.js",
  "backend-status.js",
  "catalog-sources.js",
  "sw.js",
  "_redirects",
  "_headers",
  "netlify.toml",
  "vercel.json",
  ".nojekyll",
];
const forbiddenPatterns = [
  [/app\.js\?v=cortex6/, "old app.js cache version"],
  [/supabase-client\.js\?v=multiuser1/, "old Supabase client cache version"],
  [/Scanner demo UI|AI advisor demo UI|Value dashboard demo UI/, "old demo launch copy"],
];

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Local server did not start at ${baseUrl}`);
}

function assertFiles() {
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`Missing required publish files: ${missing.join(", ")}`);
}

function assertNoForbiddenCopy() {
  const files = fs.readdirSync(root).filter((file) => /\.(html|md|js|json|toml|webmanifest)$/.test(file));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const [pattern, label] of forbiddenPatterns) {
      if (pattern.test(text)) hits.push(`${file}: ${label}`);
    }
  }
  if (hits.length) throw new Error(`Publish copy/version check failed:\n${hits.join("\n")}`);
}

async function assertRoutes() {
  for (const [route, expectedTitle] of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    if (!response.ok) throw new Error(`${route} returned ${response.status}`);
    const html = await response.text();
    const title = /<title>(.*?)<\/title>/i.exec(html)?.[1] || "";
    if (title !== expectedTitle) throw new Error(`${route} title mismatch: ${title}`);
  }
}

async function assertSupabaseRest() {
  const config = fs.readFileSync(path.join(root, "supabase-config.js"), "utf8");
  const url = /url:\s*"([^"]+)"/.exec(config)?.[1] || "";
  const key = /publishableKey:\s*"([^"]+)"/.exec(config)?.[1] || "";
  const tables = [
    "cards",
    "card_catalog",
    "catalog_sources",
    "source_sync_runs",
    "scan_jobs",
    "grade_reports",
    "user_entitlements",
    "usage_counters",
    "billing_events",
  ];
  for (const table of tables) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`Supabase table ${table} returned ${response.status}`);
  }
}

async function assertLiveDeploymentState() {
  const cacheBust = liveUrl.includes("?") ? `&v=${Date.now()}` : `?v=${Date.now()}`;
  const response = await fetch(`${liveUrl}${cacheBust}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`Live URL returned ${response.status}: ${liveUrl}`);
  const html = await response.text();
  const currentSignals = [
    "catalog-sources.html",
    "app.js?v=cortex8",
    "supabase-client.js?v=multiuser2",
  ];
  const missing = currentSignals.filter((signal) => !html.includes(signal));
  if (missing.length) {
    const message = `Live URL is reachable but not current yet. Missing: ${missing.join(", ")}`;
    if (liveRequired) throw new Error(message);
    console.log(message);
    return;
  }
  console.log("Live URL appears current.");
}

async function main() {
  assertFiles();
  assertNoForbiddenCopy();
  const server = spawn(process.execPath, ["static-server.cjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    await waitForServer();
    await assertRoutes();
    await assertSupabaseRest();
    await assertLiveDeploymentState();
    console.log(`Publish verification passed at ${baseUrl}`);
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
