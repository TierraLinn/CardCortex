const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.admin.local");
const fallbackConfigPath = path.join(root, "supabase-config.js");

function readEnv() {
  const env = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }
  }
  if (!env.SUPABASE_URL && fs.existsSync(fallbackConfigPath)) {
    const config = fs.readFileSync(fallbackConfigPath, "utf8");
    env.SUPABASE_URL = /url:\s*"([^"]+)"/.exec(config)?.[1] || "";
  }
  return env;
}

function getAdminConfig() {
  const env = readEnv();
  if (!env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL. Add .env.admin.local.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Add .env.admin.local.");
  return env;
}

async function restCheck() {
  const env = readEnv();
  const publicKey = /publishableKey:\s*"([^"]+)"/.exec(fs.readFileSync(fallbackConfigPath, "utf8"))?.[1] || "";
  if (!env.SUPABASE_URL || !publicKey) throw new Error("Missing public Supabase config.");
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
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
    });
    console.log(`${table}\t${response.status}`);
  }
}

async function adminCheck() {
  const env = getAdminConfig();
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
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    console.log(`${table}\t${response.status}`);
  }
}

async function copySql(fileName) {
  getAdminConfig();
  const sqlPath = path.resolve(root, fileName);
  if (!sqlPath.startsWith(root) || !fs.existsSync(sqlPath)) throw new Error(`SQL file not found: ${fileName}`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  if (process.platform === "win32") {
    const { spawnSync } = require("child_process");
    const result = spawnSync("powershell", ["-NoProfile", "-Command", "$input | Set-Clipboard"], { input: sql });
    if (result.status !== 0) throw new Error("Could not copy SQL to clipboard.");
    console.log(`Copied ${fileName} to clipboard.`);
    return;
  }
  console.log(sql);
}

async function main() {
  const command = process.argv[2] || "check";
  if (command === "check") return restCheck();
  if (command === "admin-check") return adminCheck();
  if (command === "copy-sql") return copySql(process.argv[3] || "SUPABASE-CATALOG-SOURCES-REPAIR.sql");
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
