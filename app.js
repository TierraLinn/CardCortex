const seedCards = window.CardCortexData.cards;
const { marketplaces } = window.CardCortexData;
let cards = [...seedCards];
let activeVaultRender = null;
let lastScanCard = null;
let lastScanImageUrl = "";
let lastScanSearchHint = "";
const page = document.body.dataset.page;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

document.querySelectorAll("nav a").forEach((link) => {
  if (link.getAttribute("href")?.includes(`${page}.html`) || (page === "home" && link.getAttribute("href") === "./index.html")) {
    link.classList.add("active");
  }
});

window.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
  document.documentElement.style.setProperty("--my", `${event.clientY}px`);
});

if (page === "vault") renderVault();
if (page === "scanner") initScanner();
if (page === "pricing") renderPricing();
if (page === "grading") renderGrading();
if (page === "marketplace") renderMarketplace();
if (page === "assistant") initAssistant();
initPwaInstall();

function totalValue(items = cards) {
  return items.reduce((sum, card) => sum + card.rawValue, 0);
}

function renderVault() {
  const search = document.querySelector("#vaultSearch");
  const filter = document.querySelector("#categoryFilter");
  const sort = document.querySelector("#sortSelect");
  const quickAddForm = document.querySelector("#quickAddForm");
  const vaultMode = document.querySelector("#vaultMode");
  const exportButton = document.querySelector("#exportVaultButton");
  const binderButton = document.querySelector("#binderViewButton");
  const commandStatus = document.querySelector("#vaultCommandStatus");
  let binderMode = false;
  const rerender = () => {
    const categories = ["All categories", ...new Set(cards.map((card) => card.category))];
    const currentFilter = filter.value || "All categories";
    filter.innerHTML = categories.map((category) => `<option value="${category}" ${category === currentFilter ? "selected" : ""}>${category}</option>`).join("");
    const query = search.value.toLowerCase();
    const category = filter.value || "All categories";
    const sorted = cards
      .filter((card) => category === "All categories" || card.category === category)
      .filter((card) => `${card.name} ${card.category} ${card.set} ${card.storage}`.toLowerCase().includes(query))
      .sort((a, b) => sort.value === "name" ? a.name.localeCompare(b.name) : sort.value === "grade" ? b.grade - a.grade : b.rawValue - a.rawValue);
    document.querySelector("#vaultTotal").textContent = money.format(totalValue(sorted));
    const grid = document.querySelector("#cardGrid");
    grid.classList.toggle("binder-mode", binderMode);
    grid.innerHTML = sorted.map(cardTile).join("");
    renderStats(sorted);
  };
  activeVaultRender = rerender;
  [search, filter, sort].forEach((el) => el.addEventListener("input", rerender));
  quickAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const api = window.CardCortexSupabase;
    if (!api || !(await api.getUser())) {
      vaultMode.textContent = "Sign in on the Account page before saving real cards.";
      return;
    }
    vaultMode.textContent = "Saving card...";
    await api.createCard({
      name: document.querySelector("#quickName").value.trim(),
      category: document.querySelector("#quickCategory").value.trim(),
      set_name: "Manual entry",
      raw_value: Number(document.querySelector("#quickValue").value || 0),
      graded_value: Number(document.querySelector("#quickValue").value || 0),
      ai_grade: 0,
      ai_confidence: 0,
      storage_location: "Unassigned",
    });
    quickAddForm.reset();
    await loadSupabaseCards(vaultMode);
    rerender();
  });
  document.querySelector("#cardGrid").addEventListener("click", async (event) => {
    const manage = event.target.closest("[data-manage-card]");
    const remove = event.target.closest("[data-delete-card]");
    if (manage) {
      openVaultEditor(manage.dataset.manageCard);
      return;
    }
    if (remove) {
      await deleteVaultCard(remove.dataset.deleteCard);
    }
  });
  exportButton?.addEventListener("click", () => {
    exportVaultCsv(cards);
    if (commandStatus) commandStatus.textContent = "CSV export created with card name, category, set, number, rarity, storage, value, grade, and confidence.";
  });
  binderButton?.addEventListener("click", () => {
    binderMode = !binderMode;
    binderButton.textContent = binderMode ? "List view" : "Binder view";
    if (commandStatus) commandStatus.textContent = binderMode ? "Binder view shows cards in collection-page format." : "List view restored for management.";
    rerender();
  });
  loadSupabaseCards(vaultMode).then(rerender);
  rerender();
}

function exportVaultCsv(items) {
  const headers = ["Name", "Category", "Set", "Number", "Rarity", "Storage", "Raw Value", "Graded Value", "AI Grade", "AI Confidence"];
  const rows = items.map((card) => [
    card.name,
    card.category,
    card.set,
    card.number,
    card.rarity,
    card.storage,
    card.rawValue,
    card.gradedValue,
    card.grade,
    card.confidence,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cardcortex-vault-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function loadSupabaseCards(statusEl) {
  const api = window.CardCortexSupabase;
  if (!api) return;
  const user = await api.getUser();
  if (!user) {
    if (statusEl) statusEl.textContent = "Sign in to save cards to Supabase. Demo cards are shown until your account has saved cards.";
    return;
  }
  try {
    const rows = await api.listCards();
    if (rows.length) {
      cards = rows.map(dbCardToCard);
      if (statusEl) statusEl.textContent = `Signed in as ${user.email}. Showing ${rows.length} saved card${rows.length === 1 ? "" : "s"}.`;
    } else {
      if (statusEl) statusEl.textContent = `Signed in as ${user.email}. Your real vault is empty, so demo cards are still shown.`;
    }
  } catch (error) {
    if (statusEl) statusEl.textContent = `Supabase setup needed: ${error.message}`;
  }
}

function dbCardToCard(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    set: row.set_name || "Saved card",
    number: row.card_number || "",
    rarity: row.rarity || "Unspecified",
    storage: row.storage_location || "Unassigned",
    rawValue: Number(row.raw_value || 0),
    gradedValue: Number(row.graded_value || row.raw_value || 0),
    grade: Number(row.ai_grade || 0),
    confidence: Number(row.ai_confidence || 0),
    sources: { Saved: Number(row.raw_value || 0), AI: Number(row.graded_value || row.raw_value || 0) },
    color: "#14b8a6",
    imageUrl: row.image_url || "",
    saved: true,
  };
}

function openVaultEditor(id) {
  const card = cards.find((item) => item.id === id);
  const editor = document.querySelector("#vaultEditor");
  if (!card || !editor) return;
  editor.hidden = false;
  editor.innerHTML = `
    <div>
      <h2>Manage card</h2>
      <p>Edit your saved vault record. Changes update Supabase.</p>
    </div>
    <form id="vaultEditForm" class="quick-add-form">
      <input id="editName" type="text" value="${escapeAttribute(card.name)}" required />
      <input id="editCategory" type="text" value="${escapeAttribute(card.category)}" required />
      <input id="editValue" type="number" min="0" step="1" value="${Number(card.rawValue || 0)}" required />
      <button class="primary-button" type="submit">Update card</button>
    </form>
  `;
  document.querySelector("#vaultEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const api = window.CardCortexSupabase;
    if (!api) return;
    await api.updateCard(id, {
      name: document.querySelector("#editName").value.trim(),
      category: document.querySelector("#editCategory").value.trim(),
      raw_value: Number(document.querySelector("#editValue").value || 0),
      updated_at: new Date().toISOString(),
    });
    editor.hidden = true;
    await loadSupabaseCards(document.querySelector("#vaultMode"));
    activeVaultRender?.();
  });
  editor.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteVaultCard(id) {
  const api = window.CardCortexSupabase;
  const status = document.querySelector("#vaultMode");
  if (!api || !(await api.getUser())) {
    status.textContent = "Sign in before deleting saved cards.";
    return;
  }
  const card = cards.find((item) => item.id === id);
  const ok = window.confirm(`Delete ${card?.name || "this card"} from your vault?`);
  if (!ok) return;
  await api.deleteCard(id);
  status.textContent = "Card deleted from your vault.";
  await loadSupabaseCards(status);
  activeVaultRender?.();
}

function renderStats(items) {
  const grouped = items.reduce((map, card) => {
    map[card.category] = (map[card.category] || 0) + card.rawValue;
    return map;
  }, {});
  document.querySelector("#categoryStats").innerHTML = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => `<article><small>${category}</small><strong>${money.format(value)}</strong></article>`)
    .join("");
  const top = [...items].sort((a, b) => b.rawValue - a.rawValue)[0];
  const upside = items.reduce((sum, card) => sum + Math.max(0, (card.gradedValue || 0) - (card.rawValue || 0)), 0);
  const pulse = document.querySelector("#portfolioPulse");
  const next = document.querySelector("#nextMove");
  const insurance = document.querySelector("#insuranceSnapshot");
  if (pulse) pulse.textContent = `${items.length} tracked cards across ${Object.keys(grouped).length} categories with ${money.format(totalValue(items))} current raw value.`;
  if (next) next.textContent = top ? `Focus on ${top.name}; it carries the highest current value signal at ${money.format(top.rawValue)}.` : "Add cards to unlock recommendations.";
  if (insurance) insurance.textContent = `Insurance snapshot estimate: ${money.format(totalValue(items))}. Potential graded upside: ${money.format(upside)}.`;
}

function cardTile(card) {
  return `
    <article class="collection-card" style="--card-accent:${card.color}">
      <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.set} &middot; ${card.number} &middot; ${card.rarity}</p>
        <div class="chip-row"><span>${card.category}</span><span>${card.storage}</span><span>AI ${card.grade}</span></div>
      </div>
      <div class="card-actions">
        <strong>${money.format(card.rawValue)}</strong>
        ${card.saved ? `<button class="secondary-button tiny-button" data-manage-card="${card.id}" type="button">Manage</button><button class="danger-button tiny-button" data-delete-card="${card.id}" type="button">Delete</button>` : ""}
      </div>
    </article>`;
}

function initScanner() {
  const video = document.querySelector("#cameraFeed");
  const canvas = document.querySelector("#scanCanvas");
  const status = document.querySelector("#scanStatus");
  const result = document.querySelector("#scanResult");

  document.querySelector("#cameraButton").addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      status.textContent = "Camera active. Place one card inside the reticle.";
    } catch {
      status.textContent = "Camera permission was not available. Use upload or capture simulation.";
    }
  });

  document.querySelector("#captureButton").addEventListener("click", () => simulateScan(result, status));
  document.querySelector("#uploadInput").addEventListener("change", (event) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    lastScanSearchHint = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const image = new Image();
    image.onload = async () => {
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      const api = window.CardCortexSupabase;
      lastScanImageUrl = "";
      if (api && (await api.getUser())) {
        status.textContent = "Uploading card image to your Supabase vault...";
        try {
          lastScanImageUrl = await api.uploadCardImage(file);
        } catch (error) {
          status.textContent = `Image upload needs Supabase storage setup: ${error.message}`;
        }
      }
      simulateScan(result, status);
    };
    image.src = URL.createObjectURL(file);
  });

  document.addEventListener("click", async (event) => {
    const matchButton = event.target.closest("[data-use-catalog-match]");
    if (matchButton) {
      const payload = JSON.parse(decodeURIComponent(matchButton.dataset.useCatalogMatch));
      applyCatalogMatchToScan(payload);
      status.textContent = `${payload.name} was applied to the editable scan review. You can still change anything before saving.`;
      return;
    }

    const catalogSearchButton = event.target.closest("#scanCatalogSearchButton");
    if (catalogSearchButton) {
      await loadScanCatalogMatches(document.querySelector("#scanCatalogQuery")?.value || "", status);
      return;
    }

    if (!event.target.matches("#saveScanButton")) return;
    const api = window.CardCortexSupabase;
    if (!api || !(await api.getUser())) {
      status.textContent = "Sign in on the Account page before saving scans.";
      return;
    }
    if (!lastScanCard) {
      status.textContent = "Capture or upload a card before saving.";
      return;
    }
    status.textContent = "Saving scan to your real vault...";
    try {
      const payload = readScanReviewForm();
      await api.createCard(payload);
      status.textContent = `${payload.name} saved to your Supabase vault. Open Vault to see it.`;
      event.target.textContent = "Saved to vault";
      event.target.disabled = true;
    } catch (error) {
      status.textContent = `Save failed: ${error.message}`;
    }
  });
}

async function simulateScan(result, status) {
  const card = cards[Math.floor(Math.random() * cards.length)];
  lastScanCard = { ...card };
  status.textContent = `AI made a best guess: ${card.name}. Review and correct it before saving.`;
  result.innerHTML = `
    <article class="scan-review">
      <div class="scan-review-card" style="--card-accent:${card.color}">
        <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
        <div>
          <h2>Review AI guess</h2>
          <p>Correct anything that is wrong. CardCortex saves your reviewed version, not the raw guess.</p>
        </div>
      </div>
      <form id="scanReviewForm" class="scan-review-form">
        <label>Card name<input id="scanName" type="text" value="${escapeAttribute(card.name)}" required /></label>
        <label>Category<input id="scanCategory" type="text" value="${escapeAttribute(card.category)}" required /></label>
        <label>Set<input id="scanSet" type="text" value="${escapeAttribute(card.set)}" /></label>
        <label>Card number<input id="scanNumber" type="text" value="${escapeAttribute(card.number)}" /></label>
        <label>Rarity<input id="scanRarity" type="text" value="${escapeAttribute(card.rarity)}" /></label>
        <label>Storage location<input id="scanStorage" type="text" value="Scanned inbox" /></label>
        <label>Raw value<input id="scanRawValue" type="number" min="0" step="1" value="${Number(card.rawValue || 0)}" /></label>
        <label>Graded value<input id="scanGradedValue" type="number" min="0" step="1" value="${Number(card.gradedValue || card.rawValue || 0)}" /></label>
        <label>AI grade<input id="scanGrade" type="number" min="0" max="10" step="0.1" value="${Number(card.grade || 0)}" /></label>
        <label>AI confidence<input id="scanConfidence" type="number" min="0" max="100" step="1" value="${Number(card.confidence || 0)}" /></label>
      </form>
      <div class="scan-review-actions">
        <button id="saveScanButton" class="primary-button save-scan-button" type="button">Save reviewed card to vault</button>
        <button id="newGuessButton" class="secondary-button" type="button">Try another AI guess</button>
      </div>
      <section class="catalog-match-panel">
        <div>
          <h2>Catalog match candidates</h2>
          <p>Search the synced CardCortex catalog and apply the closest real match before saving.</p>
        </div>
        <div class="catalog-match-search">
          <input id="scanCatalogQuery" type="search" value="${escapeAttribute(lastScanSearchHint || card.name)}" placeholder="Search synced catalog by name, set, sport, or game" />
          <button id="scanCatalogSearchButton" class="secondary-button" type="button">Find real matches</button>
        </div>
        <div id="scanCatalogMatches" class="catalog-match-results">
          <div class="empty-state">Looking for synced catalog matches...</div>
        </div>
      </section>
    </article>`;

  document.querySelector("#newGuessButton")?.addEventListener("click", () => simulateScan(result, status));
  await loadScanCatalogMatches(lastScanSearchHint || card.name, status);
}

async function loadScanCatalogMatches(query, status) {
  const api = window.CardCortexSupabase;
  const target = document.querySelector("#scanCatalogMatches");
  const clean = String(query || "").trim();
  if (!target) return;
  if (!api) {
    target.innerHTML = `<div class="empty-state">Supabase catalog is not connected yet.</div>`;
    return;
  }
  if (!clean) {
    target.innerHTML = `<div class="empty-state">Type a card name or set to search your synced catalog.</div>`;
    return;
  }
  target.innerHTML = `<div class="ai-panel">Searching synced catalog for "${escapeHtml(clean)}"...</div>`;
  try {
    const rows = await api.searchCatalog(clean);
    if (!rows.length) {
      const liveMatches = await searchPokemonTcg(clean);
      if (!liveMatches.length) {
        target.innerHTML = `<div class="empty-state">No catalog or live source matches found. Try the exact card name, set name, or a simpler search.</div>`;
        return;
      }
      target.innerHTML = liveMatches.slice(0, 5).map(scanPokemonMatchCard).join("");
      if (status) status.textContent = `Found ${liveMatches.slice(0, 5).length} live source candidate${liveMatches.length === 1 ? "" : "s"}. Pick one or keep editing manually.`;
      return;
    }
    const matches = await Promise.all(rows.slice(0, 5).map(async (row) => ({
      row,
      prices: await api.latestPrices(row.id),
    })));
    target.innerHTML = matches.map(scanCatalogMatchCard).join("");
    if (status) status.textContent = `Found ${matches.length} synced catalog candidate${matches.length === 1 ? "" : "s"}. Pick one or keep editing manually.`;
  } catch (error) {
    target.innerHTML = `<div class="empty-state">Catalog matching failed: ${escapeHtml(error.message)}</div>`;
  }
}

function scanCatalogMatchCard({ row, prices }) {
  const latest = prices[0];
  const bestPrice = latest ? Number(latest.price || 0) : 0;
  const payload = {
    name: row.name,
    category: row.category || row.game_or_sport || "Trading card",
    set: row.set_name || "",
    number: row.card_number || "",
    rarity: row.rarity || "",
    rawValue: bestPrice,
    gradedValue: Math.round(bestPrice * 1.8),
    confidence: prices.length ? 92 : 78,
    imageUrl: row.image_url || "",
    source: row.source || "synced catalog",
  };
  return `
    <article class="catalog-match-card">
      <img src="${row.image_url || ""}" alt="${escapeAttribute(row.name)}" />
      <div>
        <h3>${escapeHtml(row.name)}</h3>
        <p>${escapeHtml(row.set_name || "Unknown set")} ${row.card_number ? `#${escapeHtml(row.card_number)}` : ""} ${row.rarity ? `&middot; ${escapeHtml(row.rarity)}` : ""}</p>
        <div class="chip-row">
          <span>${escapeHtml(row.source || "catalog")}</span>
          <span>${bestPrice ? money.format(bestPrice) : "price pending"}</span>
          <span>${prices.length} price signal${prices.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <button class="primary-button tiny-button" type="button" data-use-catalog-match="${encodeURIComponent(JSON.stringify(payload))}">Use this match</button>
    </article>
  `;
}

function scanPokemonMatchCard(card) {
  const priceRows = pokemonPriceRows(card);
  const best = priceRows.find((row) => row.label === "market") || priceRows[0];
  const bestPrice = best ? Number(best.value || 0) : 0;
  const payload = {
    name: card.name,
    category: "Pokemon",
    set: card.set?.name || "",
    number: card.number || "",
    rarity: card.rarity || "",
    rawValue: bestPrice,
    gradedValue: Math.round(bestPrice * 1.8),
    confidence: bestPrice ? 90 : 76,
    imageUrl: card.images?.small || "",
    source: "Pokemon TCG API",
  };
  return `
    <article class="catalog-match-card">
      <img src="${card.images?.small || ""}" alt="${escapeAttribute(card.name)}" />
      <div>
        <h3>${escapeHtml(card.name)}</h3>
        <p>${escapeHtml(card.set?.name || "Unknown set")} ${card.number ? `#${escapeHtml(card.number)}` : ""} ${card.rarity ? `&middot; ${escapeHtml(card.rarity)}` : ""}</p>
        <div class="chip-row">
          <span>Live source: Pokemon TCG API</span>
          <span>${bestPrice ? money.format(bestPrice) : "price pending"}</span>
          <span>${priceRows.length} price signal${priceRows.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <button class="primary-button tiny-button" type="button" data-use-catalog-match="${encodeURIComponent(JSON.stringify(payload))}">Use this match</button>
    </article>
  `;
}

function pokemonPriceRows(card) {
  const prices = card.tcgplayer?.prices || {};
  return Object.entries(prices)
    .flatMap(([variant, values]) => Object.entries(values || {}).map(([label, value]) => ({ variant, label, value })))
    .filter((row) => typeof row.value === "number");
}

function applyCatalogMatchToScan(card) {
  const fields = {
    scanName: card.name,
    scanCategory: card.category,
    scanSet: card.set,
    scanNumber: card.number,
    scanRarity: card.rarity,
    scanRawValue: Math.round(Number(card.rawValue || 0)),
    scanGradedValue: Math.round(Number(card.gradedValue || card.rawValue || 0)),
    scanConfidence: Number(card.confidence || 0),
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.querySelector(`#${id}`);
    if (input) input.value = value;
  });
  lastScanCard = { ...lastScanCard, ...card };
}

function readScanReviewForm() {
  return {
    name: document.querySelector("#scanName").value.trim(),
    category: document.querySelector("#scanCategory").value.trim(),
    set_name: document.querySelector("#scanSet").value.trim(),
    card_number: document.querySelector("#scanNumber").value.trim(),
    rarity: document.querySelector("#scanRarity").value.trim(),
    storage_location: document.querySelector("#scanStorage").value.trim() || "Scanned inbox",
    raw_value: Number(document.querySelector("#scanRawValue").value || 0),
    graded_value: Number(document.querySelector("#scanGradedValue").value || 0),
    ai_grade: Number(document.querySelector("#scanGrade").value || 0),
    ai_confidence: Number(document.querySelector("#scanConfidence").value || 0),
    image_url: lastScanImageUrl,
  };
}

function escapeAttribute(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function renderPricing() {
  const upside = cards.reduce((sum, card) => sum + Math.max(0, card.gradedValue - card.rawValue), 0);
  document.querySelector("#upsideValue").textContent = money.format(upside);
  document.querySelector("#valueRows").innerHTML = cards
    .sort((a, b) => b.rawValue - a.rawValue)
    .map((card) => {
      const maxSource = Math.max(...Object.values(card.sources));
      return `
      <article class="value-row">
        <div><h3>${card.name}</h3><p>${card.category} &middot; ${card.set}</p></div>
        <strong>${money.format(card.rawValue)}</strong>
        <div class="source-bars">
          ${Object.entries(card.sources).map(([source, value]) => `
            <span><small>${source}</small><b style="width:${value ? Math.max(8, (value / maxSource) * 100) : 0}%"></b><em>${value ? money.format(value) : "n/a"}</em></span>
          `).join("")}
        </div>
      </article>`;
    })
    .join("");
  initTcgLookup();
  initCatalogSearch();
}

function initTcgLookup() {
  const form = document.querySelector("#tcgLookupForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = document.querySelector("#tcgLookupInput").value.trim();
    const results = document.querySelector("#tcgLookupResults");
    if (!query) return;
    results.innerHTML = `<div class="ai-panel">Searching Pokemon TCG API for "${escapeHtml(query)}"...</div>`;
    try {
      const found = await searchPokemonTcg(query);
      if (!found.length) {
        results.innerHTML = `<div class="empty-state">No Pokemon TCG API matches found. Try a simpler name.</div>`;
        return;
      }
      results.innerHTML = found.map(tcgResultCard).join("");
    } catch (error) {
      results.innerHTML = `<div class="empty-state">Lookup failed: ${escapeHtml(error.message)}</div>`;
    }
  });
}

async function searchPokemonTcg(query) {
  const params = new URLSearchParams({
    q: `name:"${query.replace(/"/g, "")}"`,
    pageSize: "8",
    orderBy: "-set.releaseDate",
  });
  const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params.toString()}`);
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const payload = await response.json();
  return payload.data || [];
}

function tcgResultCard(card) {
  const prices = card.tcgplayer?.prices || {};
  const priceRows = Object.entries(prices)
    .flatMap(([variant, values]) => Object.entries(values || {}).map(([label, value]) => ({ variant, label, value })))
    .filter((row) => typeof row.value === "number");
  const best = priceRows.find((row) => row.label === "market") || priceRows[0];
  return `
    <article class="tcg-result">
      <img src="${card.images?.small || ""}" alt="${escapeAttribute(card.name)}" />
      <div>
        <h3>${escapeHtml(card.name)}</h3>
        <p>${escapeHtml(card.set?.name || "Unknown set")} &middot; ${escapeHtml(card.number || "")} &middot; ${escapeHtml(card.rarity || "Unknown rarity")}</p>
        <div class="chip-row">
          <span>Source: Pokemon TCG API</span>
          <span>TCGPlayer ${best ? money.format(best.value) : "n/a"}</span>
        </div>
        <div class="source-list">
          ${priceRows.slice(0, 8).map((row) => `<span>${escapeHtml(row.variant)} ${escapeHtml(row.label)}: <strong>${money.format(row.value)}</strong></span>`).join("") || "<span>No price fields available for this card.</span>"}
        </div>
        ${card.tcgplayer?.url ? `<a class="secondary-button tiny-link" href="${card.tcgplayer.url}" target="_blank" rel="noreferrer">Open TCGPlayer source</a>` : ""}
      </div>
    </article>
  `;
}

function initCatalogSearch() {
  const form = document.querySelector("#catalogSearchForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const api = window.CardCortexSupabase;
    const query = document.querySelector("#catalogSearchInput").value.trim();
    const results = document.querySelector("#catalogResults");
    if (!api) {
      results.innerHTML = `<div class="empty-state">Supabase client is not available.</div>`;
      return;
    }
    if (!query) return;
    results.innerHTML = `<div class="ai-panel">Searching your synced Supabase catalog for "${escapeHtml(query)}"...</div>`;
    try {
      const rows = await api.searchCatalog(query);
      if (!rows.length) {
        results.innerHTML = `<div class="empty-state">No synced catalog records found yet. Run the sync function for this card or wait for the daily job.</div>`;
        return;
      }
      const cardsWithPrices = await Promise.all(rows.map(async (row) => ({
        row,
        prices: await api.latestPrices(row.id),
      })));
      results.innerHTML = cardsWithPrices.map(catalogResultCard).join("");
    } catch (error) {
      results.innerHTML = `<div class="empty-state">Catalog search failed: ${escapeHtml(error.message)}</div>`;
    }
  });
}

function catalogResultCard({ row, prices }) {
  const latest = prices[0];
  return `
    <article class="tcg-result catalog-result">
      <img src="${row.image_url || ""}" alt="${escapeAttribute(row.name)}" />
      <div>
        <h3>${escapeHtml(row.name)}</h3>
        <p>${escapeHtml(row.category)} &middot; ${escapeHtml(row.set_name || "Unknown set")} &middot; ${escapeHtml(row.card_number || "")} &middot; ${escapeHtml(row.rarity || "Unknown rarity")}</p>
        <div class="chip-row">
          <span>Catalog source: ${escapeHtml(row.source)}</span>
          <span>Synced ${new Date(row.last_synced_at).toLocaleDateString()}</span>
          <span>${prices.length} price snapshot${prices.length === 1 ? "" : "s"}</span>
        </div>
        <div class="source-list">
          ${prices.slice(0, 8).map((price) => `<span>${escapeHtml(price.variant || "price")} ${escapeHtml(price.price_label || "")}: <strong>${money.format(Number(price.price || 0))}</strong></span>`).join("") || "<span>No price snapshots saved yet for this catalog record.</span>"}
        </div>
        ${latest?.source_url ? `<a class="secondary-button tiny-link" href="${latest.source_url}" target="_blank" rel="noreferrer">Open source listing</a>` : ""}
      </div>
    </article>
  `;
}

function renderGrading() {
  const card = cards[0];
  document.querySelector("#certNumber").textContent = `CC-${new Date().getFullYear()}-${card.id.toUpperCase().slice(0, 8)}`;
  const metrics = [
    ["Centering", 0],
    ["Corners", 0],
    ["Edges", 0],
    ["Surface", 0],
    ["Print quality", 0],
    ["Back whitening", 0],
    ["Focus and lighting", 0],
    ["AI confidence", 0],
  ];
  renderGradeMetrics(metrics);
  initGradePhotoLab();
}

function renderGradeMetrics(metrics) {
  document.querySelector("#gradeBreakdown").innerHTML = metrics.map(([label, score]) => `
    <article>
      <div><strong>${label}</strong><span>${Math.round(score)}%</span></div>
      <b><i style="width:${Math.max(0, Math.min(100, score))}%"></i></b>
    </article>`).join("");
}

function initGradePhotoLab() {
  const inputs = document.querySelectorAll("[data-grade-photo]");
  const preview = document.querySelector("#gradePhotoPreview");
  const status = document.querySelector("#gradePhotoStatus");
  const report = document.querySelector("#gradeReport");
  const uploaded = new Map();
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      uploaded.set(input.dataset.gradePhoto, { file, url: URL.createObjectURL(file) });
      preview.innerHTML = [...uploaded.entries()].map(([label, item]) => `<figure><img src="${item.url}" alt="${label} card view" /><figcaption>${label}</figcaption></figure>`).join("");
      status.textContent = uploaded.size === 2 ? "Front and back are ready. Run automatic grade." : "Add the back photo to unlock automatic grading.";
    });
  });
  document.querySelector("#runGradeButton")?.addEventListener("click", async () => {
    if (!uploaded.has("front") || !uploaded.has("back")) {
      status.textContent = "Upload both the front and back before running automatic grading.";
      return;
    }
    status.textContent = "Running centering, corners, edges, surface, print, whitening, and photo-quality mechanisms...";
    try {
      const front = await analyzeCardImage(uploaded.get("front").file);
      const back = await analyzeCardImage(uploaded.get("back").file);
      const result = buildGradeReport(front, back);
      renderAutomaticGrade(result, report, status);
    } catch (error) {
      status.textContent = `Automatic grading failed: ${error.message}`;
    }
  });
}

function renderAutomaticGrade(result, report, status) {
  document.querySelector("#gradeScore").textContent = result.grade.toFixed(1);
  document.querySelector("#gradeConfidence").textContent = `AI confidence ${Math.round(result.confidence)}%`;
  document.querySelector("#certNumber").textContent = result.certNumber;
  renderGradeMetrics(result.metrics);
  report.hidden = false;
  report.innerHTML = `
    <div>
      <h2>Automatic grading report</h2>
      <p>${escapeHtml(result.summary)}</p>
    </div>
    <div class="grade-report-grid">
      ${result.notes.map((note) => `<article><strong>${escapeHtml(note.label)}</strong><span>${escapeHtml(note.value)}</span><p>${escapeHtml(note.detail)}</p></article>`).join("")}
    </div>
    <div class="grade-flags">
      ${result.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}
    </div>
  `;
  status.textContent = `Automatic grade complete: ${result.grade.toFixed(1)} with ${Math.round(result.confidence)}% confidence.`;
}

async function analyzeCardImage(file) {
  const image = await loadImageFromFile(file);
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  const saturation = new Float32Array(width * height);
  let total = 0;
  let totalSq = 0;
  let totalSat = 0;
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[pixel] = lum;
    saturation[pixel] = max ? (max - min) / max : 0;
    total += lum;
    totalSq += lum * lum;
    totalSat += saturation[pixel];
  }
  const count = luminance.length;
  const brightness = total / count;
  const contrast = Math.sqrt(Math.max(0, totalSq / count - brightness * brightness));
  const edge = edgeProfile(luminance, width, height);
  const box = detectCardBox(edge.map, width, height);
  const quality = scorePhotoQuality(brightness, contrast, edge.average);
  const centering = scoreCentering(box, width, height);
  const corners = scoreCorners(luminance, edge.map, width, height, box);
  const edges = scoreEdges(luminance, edge.map, width, height, box);
  const surface = scoreSurface(luminance, edge.map, width, height, box);
  const print = clamp(72 + contrast * 0.38 + (totalSat / count) * 24 - Math.abs(brightness - 132) * 0.1, 45, 99);
  const whitening = scoreWhitening(luminance, width, height, box);
  return { width, height, brightness, contrast, edgeAverage: edge.average, box, quality, centering, corners, edges, surface, print, whitening };
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the image."));
    image.src = URL.createObjectURL(file);
  });
}

function edgeProfile(luminance, width, height) {
  const map = new Float32Array(width * height);
  let total = 0;
  let samples = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx = Math.abs(luminance[index + 1] - luminance[index - 1]);
      const gy = Math.abs(luminance[index + width] - luminance[index - width]);
      const value = gx + gy;
      map[index] = value;
      total += value;
      samples += 1;
    }
  }
  return { map, average: total / Math.max(1, samples) };
}

function detectCardBox(edgeMap, width, height) {
  const threshold = 26;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (edgeMap[y * width + x] > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (minX >= maxX || minY >= maxY) {
    return { x: width * 0.08, y: height * 0.06, right: width * 0.92, bottom: height * 0.94 };
  }
  return { x: minX, y: minY, right: maxX, bottom: maxY };
}

function scorePhotoQuality(brightness, contrast, edgeAverage) {
  const brightnessScore = 100 - Math.min(55, Math.abs(brightness - 132) * 0.75);
  const contrastScore = clamp(contrast * 2.4, 45, 100);
  const focusScore = clamp(edgeAverage * 5.2, 35, 100);
  return clamp(brightnessScore * 0.3 + contrastScore * 0.25 + focusScore * 0.45, 35, 99);
}

function scoreCentering(box, width, height) {
  const left = Math.max(1, box.x);
  const right = Math.max(1, width - box.right);
  const top = Math.max(1, box.y);
  const bottom = Math.max(1, height - box.bottom);
  const horizontal = Math.min(left, right) / Math.max(left, right);
  const vertical = Math.min(top, bottom) / Math.max(top, bottom);
  return {
    score: clamp(55 + horizontal * 25 + vertical * 20, 45, 99),
    horizontal: `${Math.round((left / (left + right)) * 100)}/${Math.round((right / (left + right)) * 100)}`,
    vertical: `${Math.round((top / (top + bottom)) * 100)}/${Math.round((bottom / (top + bottom)) * 100)}`,
  };
}

function scoreCorners(luminance, edgeMap, width, height, box) {
  const size = Math.max(12, Math.round(Math.min(box.right - box.x, box.bottom - box.y) * 0.1));
  const regions = [
    sampleRegion(luminance, edgeMap, width, box.x, box.y, size, size),
    sampleRegion(luminance, edgeMap, width, box.right - size, box.y, size, size),
    sampleRegion(luminance, edgeMap, width, box.x, box.bottom - size, size, size),
    sampleRegion(luminance, edgeMap, width, box.right - size, box.bottom - size, size, size),
  ];
  const roughness = average(regions.map((region) => region.edge));
  const brightnessVariance = standardDeviation(regions.map((region) => region.lum));
  return clamp(98 - roughness * 0.22 - brightnessVariance * 0.18, 45, 99);
}

function scoreEdges(luminance, edgeMap, width, height, box) {
  const band = Math.max(8, Math.round(Math.min(width, height) * 0.035));
  const regions = [
    sampleRegion(luminance, edgeMap, width, box.x, box.y, box.right - box.x, band),
    sampleRegion(luminance, edgeMap, width, box.x, box.bottom - band, box.right - box.x, band),
    sampleRegion(luminance, edgeMap, width, box.x, box.y, band, box.bottom - box.y),
    sampleRegion(luminance, edgeMap, width, box.right - band, box.y, band, box.bottom - box.y),
  ];
  const roughness = average(regions.map((region) => region.edge));
  const whitening = average(regions.map((region) => region.brightRatio));
  return clamp(99 - roughness * 0.18 - whitening * 34, 42, 99);
}

function scoreSurface(luminance, edgeMap, width, height, box) {
  const insetX = Math.round((box.right - box.x) * 0.16);
  const insetY = Math.round((box.bottom - box.y) * 0.16);
  const region = sampleRegion(luminance, edgeMap, width, box.x + insetX, box.y + insetY, box.right - box.x - insetX * 2, box.bottom - box.y - insetY * 2);
  const glarePenalty = region.brightRatio * 28;
  const scratchPenalty = region.edge * 0.16;
  return clamp(99 - glarePenalty - scratchPenalty, 40, 99);
}

function scoreWhitening(luminance, width, height, box) {
  const band = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const regions = [
    sampleRegion(luminance, null, width, box.x, box.y, box.right - box.x, band),
    sampleRegion(luminance, null, width, box.x, box.bottom - band, box.right - box.x, band),
    sampleRegion(luminance, null, width, box.x, box.y, band, box.bottom - box.y),
    sampleRegion(luminance, null, width, box.right - band, box.y, band, box.bottom - box.y),
  ];
  const whitening = average(regions.map((region) => region.brightRatio));
  return clamp(99 - whitening * 44, 45, 99);
}

function sampleRegion(luminance, edgeMap, width, x, y, regionWidth, regionHeight) {
  const startX = Math.max(0, Math.round(x));
  const startY = Math.max(0, Math.round(y));
  const endX = Math.min(width - 1, Math.round(x + regionWidth));
  const endY = Math.min(Math.floor(luminance.length / width) - 1, Math.round(y + regionHeight));
  let lum = 0;
  let edge = 0;
  let bright = 0;
  let count = 0;
  for (let yy = startY; yy <= endY; yy += 1) {
    for (let xx = startX; xx <= endX; xx += 1) {
      const index = yy * width + xx;
      lum += luminance[index];
      edge += edgeMap ? edgeMap[index] : 0;
      if (luminance[index] > 214) bright += 1;
      count += 1;
    }
  }
  return { lum: lum / Math.max(1, count), edge: edge / Math.max(1, count), brightRatio: bright / Math.max(1, count) };
}

function buildGradeReport(front, back) {
  const centeringScore = front.centering.score;
  const corners = average([front.corners, back.corners]);
  const edges = average([front.edges, back.edges]);
  const surface = average([front.surface, back.surface]);
  const print = front.print;
  const whitening = back.whitening;
  const photoQuality = average([front.quality, back.quality]);
  const weighted = centeringScore * 0.18 + corners * 0.18 + edges * 0.18 + surface * 0.18 + print * 0.12 + whitening * 0.1 + photoQuality * 0.06;
  const grade = clamp(Math.round((weighted / 10) * 10) / 10, 1, 10);
  const confidence = clamp(photoQuality * 0.68 + Math.min(front.width, back.width) * 0.04 + 18, 40, 97);
  const metrics = [
    ["Centering", centeringScore],
    ["Corners", corners],
    ["Edges", edges],
    ["Surface", surface],
    ["Print quality", print],
    ["Back whitening", whitening],
    ["Focus and lighting", photoQuality],
    ["AI confidence", confidence],
  ];
  const flags = [
    centeringScore < 82 ? "Centering needs review" : "Centering looks balanced",
    corners < 82 ? "Corner wear detected" : "Corners look clean",
    edges < 82 ? "Edge roughness detected" : "Edges look consistent",
    surface < 82 ? "Surface/glare risk detected" : "Surface looks stable",
    photoQuality < 75 ? "Retake with stronger lighting for higher confidence" : "Photo quality acceptable",
  ];
  return {
    grade,
    confidence,
    metrics,
    certNumber: `CC-AI-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    summary: `Estimated digital grade ${grade.toFixed(1)} from front/back computer-vision checks. This is a CardCortex AI estimate, not an official third-party slab grade.`,
    flags,
    notes: [
      { label: "Centering", value: `${front.centering.horizontal} H / ${front.centering.vertical} V`, detail: "Measured from detected border balance on the front image." },
      { label: "Corners", value: `${Math.round(corners)}%`, detail: "Looks for corner roughness, asymmetry, and brightness changes." },
      { label: "Edges", value: `${Math.round(edges)}%`, detail: "Samples all four border bands for chipping, whitening, and edge noise." },
      { label: "Surface", value: `${Math.round(surface)}%`, detail: "Checks interior glare, scratch-like contrast, and uneven surface signals." },
      { label: "Back whitening", value: `${Math.round(whitening)}%`, detail: "Weights bright edge wear from the back photo." },
      { label: "Photo confidence", value: `${Math.round(confidence)}%`, detail: "Based on focus, contrast, lighting, and image resolution." },
    ],
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function standardDeviation(values) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function renderMarketplace() {
  document.querySelector("#marketRoutes").innerHTML = marketplaces.map((market) => `
    <article class="market-card">
      <h2>${market.name}</h2>
      <p>${market.bestFor}</p>
      <div class="chip-row"><span>${market.fee}</span><span>${market.confidence}% route fit</span></div>
      <button class="secondary-button" type="button" data-market="${market.name}">Prepare listing</button>
    </article>`).join("");
  document.querySelectorAll("[data-market]").forEach((button) => {
    button.addEventListener("click", () => {
      button.textContent = "Listing draft prepared";
      button.classList.add("prepared");
    });
  });
  initListingStudio();
}

function initListingStudio() {
  const form = document.querySelector("#listingForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#listingCardName").value.trim() || "Trading card";
    const condition = document.querySelector("#listingCondition").value.trim() || "reviewed condition with clear front and back photos";
    const price = Number(document.querySelector("#listingPrice").value || 0);
    document.querySelector("#listingOutput").value = `${name} - CardCortex listing draft\n\nCondition: ${condition}.\nTarget price: ${price ? money.format(price) : "set after reviewing comps"}.\n\nInclude front photo, back photo, corner inspection, surface/glare notes, storage history, and CardCortex pre-grade notes.\n\nRecommended strategy: honest condition-first title, sold-comps price range, clear shipping terms, and no official grading claim unless the card is graded by a recognized grading company.`;
  });
}

function initAssistant() {
  const log = document.querySelector("#chatLog");
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  addMessage("assistant", "I found your highest upside card: Son Goku, Awakened Power. Consider grading before selling because the graded spread is strong.");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage("user", question);
    input.value = "";
    const answer = question.toLowerCase().includes("sell")
      ? "For selling, start with high-liquidity cards on eBay or TCGPlayer-style markets, then route niche Marvel, Bakugan, and Buddyfight cards to collector communities."
      : "I would scan front and back photos, verify set number, compare sold comps, estimate condition, and decide whether grading raises the expected return.";
    setTimeout(() => addMessage("assistant", answer), 350);
  });
  document.querySelectorAll(".prompt-rail button").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.textContent;
      form.requestSubmit();
    });
  });
  function addMessage(role, text) {
    log.insertAdjacentHTML("beforeend", `<article class="${role}">${text}</article>`);
    log.scrollTop = log.scrollHeight;
  }
}

function initPwaInstall() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  let pendingInstall = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingInstall = event;
    document.querySelectorAll("#installAppButton").forEach((button) => {
      button.hidden = false;
    });
  });
  document.addEventListener("click", async (event) => {
    if (!event.target.matches("#installAppButton") || !pendingInstall) return;
    pendingInstall.prompt();
    await pendingInstall.userChoice;
    pendingInstall = null;
    event.target.hidden = true;
  });
}
