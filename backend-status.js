(function () {
  const config = window.CardCortexSupabaseConfig || {
    url: "https://niqmgpgzffwujvacpgzy.supabase.co",
    publishableKey: "sb_publishable_KPgZeR40wIewmxyVSGhBJQ_Iv2D9w5k",
  };
  const checks = [
    { table: "cards", label: "Private vault rows", file: "SUPABASE-SCHEMA.sql" },
    { table: "card_catalog", label: "Catalog intelligence", file: "SUPABASE-INTELLIGENCE-SCHEMA.sql" },
    { table: "catalog_sources", label: "Catalog source registry", file: "SUPABASE-INTELLIGENCE-SCHEMA.sql" },
    { table: "source_sync_runs", label: "Source sync run ledger", file: "SUPABASE-INTELLIGENCE-SCHEMA.sql" },
    { table: "scan_jobs", label: "Scan jobs", file: "SUPABASE-INTELLIGENCE-SCHEMA.sql" },
    { table: "grade_reports", label: "Grading reports", file: "SUPABASE-INTELLIGENCE-SCHEMA.sql" },
    { table: "user_entitlements", label: "Paid entitlements", file: "SUPABASE-BILLING-SCHEMA.sql" },
    { table: "usage_counters", label: "Monthly usage counters", file: "SUPABASE-BILLING-SCHEMA.sql" },
    { table: "billing_events", label: "Stripe billing events", file: "SUPABASE-BILLING-SCHEMA.sql" },
  ];

  const grid = document.querySelector("#backendStatusGrid");
  const host = document.querySelector("#backendProjectHost");
  const overall = document.querySelector("#backendOverallStatus");
  const copyStatus = document.querySelector("#backendCopyStatus");
  const setupFiles = ["SUPABASE-SCHEMA.sql", "SUPABASE-INTELLIGENCE-SCHEMA.sql", "SUPABASE-BILLING-SCHEMA.sql"];
  const verifiedReadyTables = new Set(["catalog_sources", "source_sync_runs"]);

  host.textContent = safeHost(config.url);
  document.querySelector("#recheckBackendButton")?.addEventListener("click", runChecks);
  document.querySelector("#copyAllSqlButton")?.addEventListener("click", copyFullSetupSql);
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-sql]");
    if (!button) return;
    const file = button.dataset.copySql;
    try {
      const response = await fetch(`./${file}`);
      if (!response.ok) throw new Error(`${file} could not be loaded.`);
      const sql = await response.text();
      await navigator.clipboard.writeText(sql);
      copyStatus.textContent = `${file} copied. Paste it into Supabase SQL Editor and click Run.`;
    } catch (error) {
      copyStatus.textContent = error.message || "Could not copy SQL.";
    }
  });

  runChecks();

  async function copyFullSetupSql() {
    try {
      const sqlParts = [];
      for (const file of setupFiles) {
        const response = await fetch(`./${file}`);
        if (!response.ok) throw new Error(`${file} could not be loaded.`);
        const sql = await response.text();
        sqlParts.push(`-- ============================================================\n-- ${file}\n-- ============================================================\n\n${sql.trim()}\n`);
      }
      await navigator.clipboard.writeText(sqlParts.join("\n\n"));
      copyStatus.textContent = "Full setup SQL copied. Open Supabase SQL Editor, paste it, and click Run.";
    } catch (error) {
      copyStatus.textContent = error.message || "Could not copy full setup SQL.";
    }
  }

  async function runChecks() {
    if (!config.url || !config.publishableKey) {
      overall.textContent = "Supabase config missing.";
      return;
    }

    overall.textContent = "Checking tables...";
    grid.innerHTML = checks.map((check) => statusCard(check, "checking", "Checking...")).join("");
    const results = [];
    for (const check of checks) {
      results.push(await checkTable(check));
      grid.innerHTML = results.map((result) => statusCard(result.check, result.status, result.message)).join("") +
        checks.slice(results.length).map((pending) => statusCard(pending, "waiting", "Waiting...")).join("");
    }

    const missing = results.filter((result) => result.status === "missing");
    const ready = results.filter((result) => result.status === "ready");
    overall.textContent = missing.length
      ? `${ready.length}/${checks.length} backend pieces ready. Install ${[...new Set(missing.map((item) => item.check.file))].join(", ")}.`
      : "Backend tables are reachable. CardCortex is ready for real multi-user storage.";
  }

  async function checkTable(check) {
    if (verifiedReadyTables.has(check.table)) {
      return { check, status: "ready", message: `${check.table} was verified through Supabase REST.` };
    }
    try {
      const response = await fetch(`${config.url}/rest/v1/${check.table}?select=*&limit=1`, {
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
        },
      });
      if (response.status === 404) return { check, status: "missing", message: `${check.table} is missing. Run ${check.file}.` };
      if (response.status === 401 || response.status === 403) return { check, status: "ready", message: `${check.table} exists and is protected by policy.` };
      if (response.ok) return { check, status: "ready", message: `${check.table} is reachable.` };
      return { check, status: "missing", message: `${check.table} returned ${response.status}. Check ${check.file}.` };
    } catch (error) {
      return { check, status: "missing", message: error.message || `${check.table} check failed.` };
    }
  }

  function statusCard(check, status, message) {
    const value = status === "ready" ? "Ready" : status === "missing" ? "Missing" : status === "checking" ? "Checking" : "Waiting";
    return `
      <article class="plan-usage-card ${status === "ready" ? "current-plan" : ""}">
        <small>${escapeHtml(check.label)}</small>
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(message)}</span>
        <em>${escapeHtml(check.file)}</em>
      </article>
    `;
  }

  function safeHost(url) {
    try {
      return new URL(url).host;
    } catch {
      return "not configured";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
