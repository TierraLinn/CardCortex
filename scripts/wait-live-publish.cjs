const { spawnSync } = require("child_process");

const attempts = Number(process.env.LIVE_VERIFY_ATTEMPTS || 12);
const waitMs = Number(process.env.LIVE_VERIFY_WAIT_MS || 15000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`Live publish verification attempt ${attempt}/${attempts}`);
    const result = spawnSync(process.execPath, ["scripts/verify-publish.cjs", "--live-required"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    if (result.status === 0) {
      console.log("Live publish verification passed.");
      return;
    }
    if (attempt < attempts) await sleep(waitMs);
  }
  throw new Error("Live site did not become current before the verification timeout.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
