const seedCards = window.CardCortexData.cards;
const { marketplaces } = window.CardCortexData;
let cards = [...seedCards];
let activeVaultRender = null;
let activeVaultId = "";
let lastScanCard = null;
let lastScanImageUrl = "";
let lastScanSearchHint = "";
let lastScanAnalysis = null;
let lastScanDataUrl = "";
let activeGradeResult = null;
const page = document.body.dataset.page;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CERTIFICATE_STORE_KEY = "cardcortex-certificates";
const storage = createStorage();
window.CardCortexStorage = storage;

function createStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const testKey = "cardcortex-storage-test";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    // Some embedded browsers disable storage. Keep the app usable with in-memory storage.
  }
  const memory = new Map();
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
}

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
if (page === "reports") renderReports();
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
  const vaultDraft = storage.getItem("cardcortex-vault-draft");
  if (vaultDraft) {
    try {
      const draft = JSON.parse(vaultDraft);
      document.querySelector("#quickName").value = draft.name || "";
      document.querySelector("#quickCategory").value = draft.category || "";
      document.querySelector("#quickValue").value = draft.rawValue || "";
      if (commandStatus) commandStatus.textContent = `${draft.certNumber || "Certificate"} loaded as a vault draft. Add a value and save when you are signed in.`;
      storage.removeItem("cardcortex-vault-draft");
    } catch {
      storage.removeItem("cardcortex-vault-draft");
    }
  }
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
    if (!activeVaultId || !sorted.some((card) => card.id === activeVaultId)) {
      activeVaultId = sorted[0]?.id || cards[0]?.id || "";
    }
    document.querySelector("#vaultTotal").textContent = money.format(totalValue(sorted));
    const grid = document.querySelector("#cardGrid");
    grid.classList.toggle("binder-mode", binderMode);
    grid.innerHTML = sorted.map(cardTile).join("");
    renderStats(sorted);
    renderVaultLanes(sorted);
    renderVaultDetail(sorted.find((card) => card.id === activeVaultId) || sorted[0] || null);
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
    const grade = event.target.closest("[data-grade-card]");
    const sell = event.target.closest("[data-sell-card]");
    const select = event.target.closest("[data-select-card]");
    if (manage) {
      activeVaultId = manage.dataset.manageCard;
      openVaultEditor(manage.dataset.manageCard);
      rerender();
      return;
    }
    if (remove) {
      await deleteVaultCard(remove.dataset.deleteCard);
      return;
    }
    if (grade) {
      sendVaultCardToGrading(grade.dataset.gradeCard);
      return;
    }
    if (sell) {
      sendVaultCardToMarketplace(sell.dataset.sellCard);
      return;
    }
    if (select) {
      activeVaultId = select.dataset.selectCard;
      rerender();
    }
  });
  document.querySelector("#vaultDetail")?.addEventListener("click", (event) => {
    const grade = event.target.closest("[data-grade-card]");
    const sell = event.target.closest("[data-sell-card]");
    const manage = event.target.closest("[data-manage-card]");
    if (grade) sendVaultCardToGrading(grade.dataset.gradeCard);
    if (sell) sendVaultCardToMarketplace(sell.dataset.sellCard);
    if (manage) openVaultEditor(manage.dataset.manageCard);
  });
  document.querySelector("#vaultLanes")?.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-card]");
    if (!select) return;
    activeVaultId = select.dataset.selectCard;
    rerender();
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
  const upside = items.reduce((sum, card) => sum + gradedUpside(card), 0);
  const averageGrade = average(items.map((card) => Number(card.grade || 0)).filter(Boolean));
  const readyToSell = items.filter((card) => card.rawValue >= 100 || card.confidence >= 85).length;
  document.querySelector("#categoryStats").innerHTML = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => `<article><small>${category}</small><strong>${money.format(value)}</strong></article>`)
    .join("") + `
      <article><small>Graded upside</small><strong>${money.format(upside)}</strong></article>
      <article><small>Average AI grade</small><strong>${averageGrade ? averageGrade.toFixed(1) : "n/a"}</strong></article>
      <article><small>Sell-ready cards</small><strong>${readyToSell}</strong></article>`;
  const top = [...items].sort((a, b) => b.rawValue - a.rawValue)[0];
  const topUpside = [...items].sort((a, b) => gradedUpside(b) - gradedUpside(a))[0];
  const pulse = document.querySelector("#portfolioPulse");
  const next = document.querySelector("#nextMove");
  const insurance = document.querySelector("#insuranceSnapshot");
  if (pulse) pulse.textContent = `${items.length} tracked cards across ${Object.keys(grouped).length} categories, ${money.format(totalValue(items))} raw value, and ${money.format(upside)} possible graded spread.`;
  if (next) next.textContent = topUpside && gradedUpside(topUpside) ? `Grade-review ${topUpside.name}; it has ${money.format(gradedUpside(topUpside))} projected upside.` : top ? `Focus on ${top.name}; it carries the highest current value signal at ${money.format(top.rawValue)}.` : "Add cards to unlock recommendations.";
  if (insurance) insurance.textContent = `Insurance snapshot estimate: ${money.format(totalValue(items))}. Potential graded upside: ${money.format(upside)}.`;
}

function cardTile(card) {
  const active = card.id === activeVaultId;
  const readiness = cardReadiness(card);
  return `
    <article class="collection-card ${active ? "active-card" : ""}" style="--card-accent:${card.color}" data-select-card="${card.id}">
      <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.set} &middot; ${card.number} &middot; ${card.rarity}</p>
        <div class="chip-row"><span>${card.category}</span><span>${card.storage}</span><span>AI ${card.grade}</span><span>${readiness.label}</span></div>
      </div>
      <div class="card-actions">
        <strong>${money.format(card.rawValue)}</strong>
        <button class="secondary-button tiny-button" data-grade-card="${card.id}" type="button">Grade</button>
        <button class="secondary-button tiny-button" data-sell-card="${card.id}" type="button">Sell</button>
        ${card.saved ? `<button class="secondary-button tiny-button" data-manage-card="${card.id}" type="button">Manage</button><button class="danger-button tiny-button" data-delete-card="${card.id}" type="button">Delete</button>` : ""}
      </div>
    </article>`;
}

function renderVaultDetail(card) {
  const target = document.querySelector("#vaultDetail");
  if (!target) return;
  if (!card) {
    target.innerHTML = `<div class="empty-state">Select a card to open command details.</div>`;
    return;
  }
  const readiness = cardReadiness(card);
  const route = bestSellRoute(card);
  const upside = gradedUpside(card);
  const sourceRows = Object.entries(card.sources || {}).map(([name, value]) => `<span><small>${escapeHtml(name)}</small><strong>${money.format(Number(value || 0))}</strong></span>`).join("");
  target.innerHTML = `
    <div class="vault-detail-hero" style="--card-accent:${card.color}">
      <div class="mini-card holo-card"><span>${escapeHtml(card.category)}</span><strong>${escapeHtml(card.name.slice(0, 2).toUpperCase())}</strong></div>
      <div>
        <small>Selected card</small>
        <h2>${escapeHtml(card.name)}</h2>
        <p>${escapeHtml(card.set)} &middot; ${escapeHtml(card.number)} &middot; ${escapeHtml(card.rarity)}</p>
      </div>
    </div>
    <div class="detail-metrics">
      <article><small>Raw value</small><strong>${money.format(card.rawValue)}</strong></article>
      <article><small>Graded value</small><strong>${money.format(card.gradedValue || card.rawValue)}</strong></article>
      <article><small>Upside</small><strong>${money.format(upside)}</strong></article>
      <article><small>AI grade</small><strong>${card.grade || "n/a"}</strong></article>
    </div>
    <div class="vault-action-plan">
      <h3>${escapeHtml(readiness.label)}</h3>
      <p>${escapeHtml(readiness.detail)}</p>
      <div class="readiness-meter"><i style="width:${readiness.score}%"></i></div>
    </div>
    <div class="detail-source-list">
      ${sourceRows || "<span><small>Source</small><strong>Pending</strong></span>"}
    </div>
    <div class="vault-detail-actions">
      <button class="primary-button" data-grade-card="${card.id}" type="button">Send to grading</button>
      <button class="secondary-button" data-sell-card="${card.id}" type="button">Prepare sale</button>
      ${card.saved ? `<button class="secondary-button" data-manage-card="${card.id}" type="button">Edit record</button>` : ""}
    </div>
    <p class="vault-route-note">Best current route: ${escapeHtml(route.name)} for ${escapeHtml(route.reason)}.</p>
  `;
}

function renderVaultLanes(items) {
  const target = document.querySelector("#vaultLanes");
  if (!target) return;
  const gradeCandidates = [...items].sort((a, b) => gradedUpside(b) - gradedUpside(a)).slice(0, 3);
  const sellCandidates = [...items].sort((a, b) => (b.rawValue + b.confidence) - (a.rawValue + a.confidence)).slice(0, 3);
  const cleanupCandidates = items.filter((card) => /unassigned|inbox|box/i.test(card.storage || "") || !card.storage).slice(0, 3);
  target.innerHTML = [
    vaultLane("Grade candidates", gradeCandidates, (card) => `${money.format(gradedUpside(card))} upside`),
    vaultLane("Sell-ready watchlist", sellCandidates, (card) => `${money.format(card.rawValue)} raw`),
    vaultLane("Storage cleanup", cleanupCandidates.length ? cleanupCandidates : items.slice(0, 3), (card) => card.storage || "Unassigned"),
  ].join("");
}

function vaultLane(title, laneCards, meta) {
  return `
    <article class="vault-lane">
      <h2>${title}</h2>
      ${laneCards.map((card) => `
        <button type="button" data-select-card="${card.id}" class="${card.id === activeVaultId ? "active-lane-card" : ""}">
          <span>${escapeHtml(card.name)}</span>
          <small>${escapeHtml(meta(card))}</small>
        </button>
      `).join("") || `<p class="empty-state">No cards in this lane yet.</p>`}
    </article>`;
}

function gradedUpside(card) {
  return Math.max(0, Number(card.gradedValue || 0) - Number(card.rawValue || 0));
}

function cardReadiness(card) {
  const confidence = Number(card.confidence || 0);
  const grade = Number(card.grade || 0);
  const upside = gradedUpside(card);
  const score = clamp(confidence * 0.4 + grade * 6 + Math.min(35, upside / 30), 12, 100);
  if (score >= 82) return { score, label: "Ready for action", detail: "High confidence, strong grade signal, or meaningful value spread. Good candidate for grading review or listing prep." };
  if (score >= 58) return { score, label: "Needs verification", detail: "Worth reviewing with fresh front/back photos and current comps before deciding to grade, hold, or sell." };
  return { score, label: "Needs research", detail: "Add better scans, confirm set number, and check values before making a selling or grading decision." };
}

function bestSellRoute(card) {
  const category = String(card.category || "").toLowerCase();
  if (/pokemon|magic|yu-gi|dragon/.test(category)) return { name: "TCGPlayer-style route", reason: "TCG demand and set-specific buyers" };
  if (/sports/.test(category)) return { name: "eBay or consignment", reason: "sold-comps visibility and graded-card demand" };
  if (/marvel|spider|bakugan|buddy|minecraft/.test(category)) return { name: "Collector community plus eBay", reason: "niche buyers and broader search demand" };
  return { name: "eBay", reason: "broad collector discovery" };
}

function sendVaultCardToGrading(id) {
  const card = cards.find((item) => item.id === id);
  if (!card) return;
  storage.setItem("cardcortex-grade-source-name", card.name);
  window.location.href = "./grading.html?from=vault";
}

function sendVaultCardToMarketplace(id) {
  const card = cards.find((item) => item.id === id);
  if (!card) return;
  storage.setItem("cardcortex-listing-card", JSON.stringify({
    name: card.name,
    price: card.rawValue,
    condition: `AI grade ${card.grade || "pending"} with ${card.confidence || 0}% confidence. ${card.set} ${card.number}.`,
  }));
  window.location.href = "./marketplace.html?from=vault";
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

  document.querySelector("#captureButton").addEventListener("click", async () => {
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob) {
        const file = new File([blob], `cardcortex-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        lastScanDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        await prepareScanAnalysis(file, status);
      }
    } else {
      lastScanAnalysis = null;
      lastScanDataUrl = "";
      updateScanTelemetry();
    }
    simulateScan(result, status);
  });
  document.querySelector("#uploadInput").addEventListener("change", (event) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    lastScanSearchHint = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const image = new Image();
    image.onload = async () => {
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      lastScanDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      await prepareScanAnalysis(file, status);
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

    const gradeButton = event.target.closest("#sendToGradeButton");
    if (gradeButton) {
      if (lastScanDataUrl) {
        storage.setItem("cardcortex-grade-front", lastScanDataUrl);
        storage.setItem("cardcortex-grade-source-name", document.querySelector("#scanName")?.value || lastScanCard?.name || "scanned card");
      }
      window.location.href = "./grading.html?from=scanner";
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

async function simulateScan(result, status, forceRandom = false) {
  const card = chooseScanCandidate(forceRandom);
  lastScanCard = { ...card };
  const confidenceBoost = lastScanAnalysis ? Math.round(lastScanAnalysis.confidence) : card.confidence;
  status.textContent = `Scanner matched a best candidate: ${card.name}. Review and correct it before saving.`;
  result.innerHTML = `
    <article class="scan-review">
      <div class="scan-review-card" style="--card-accent:${card.color}">
        <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
        <div>
          <h2>Review scanner match</h2>
          <p>Correct anything that is wrong. CardCortex saves your reviewed version, not the raw match.</p>
        </div>
      </div>
      ${scanTelemetryCard()}
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
        <label>AI confidence<input id="scanConfidence" type="number" min="0" max="100" step="1" value="${Number(confidenceBoost || 0)}" /></label>
      </form>
      <div class="scan-review-actions">
        <button id="saveScanButton" class="primary-button save-scan-button" type="button">Save reviewed card to vault</button>
        <button id="sendToGradeButton" class="secondary-button" type="button">Send scan to grading</button>
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

  document.querySelector("#newGuessButton")?.addEventListener("click", () => simulateScan(result, status, true));
  await loadScanCatalogMatches(lastScanSearchHint || card.name, status);
}

async function prepareScanAnalysis(file, status) {
  try {
    const analysis = await analyzeCardImage(file);
    const borderConfidence = scanBorderConfidence(analysis.box, analysis.width, analysis.height);
    lastScanAnalysis = {
      ...analysis,
      borderConfidence,
      confidence: clamp(analysis.quality * 0.54 + borderConfidence * 0.3 + analysis.centering.score * 0.16, 35, 98),
    };
    updateScanTelemetry();
    if (status) status.textContent = `Image analyzed: ${Math.round(lastScanAnalysis.confidence)}% scan confidence. Review match candidates before saving.`;
  } catch (error) {
    lastScanAnalysis = null;
    updateScanTelemetry();
    if (status) status.textContent = `Image analysis could not run: ${error.message}`;
  }
}

function chooseScanCandidate(forceRandom = false) {
  if (forceRandom) return cards[Math.floor(Math.random() * cards.length)];
  const hint = lastScanSearchHint.toLowerCase().trim();
  if (hint) {
    const scored = cards.map((card) => {
      const text = `${card.name} ${card.category} ${card.set} ${card.number}`.toLowerCase();
      const words = hint.split(/\s+/).filter(Boolean);
      const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
      return { card, score };
    }).sort((a, b) => b.score - a.score);
    if (scored[0]?.score) return scored[0].card;
  }
  return cards[Math.floor(Math.random() * cards.length)];
}

function scanBorderConfidence(box, width, height) {
  const boxWidth = Math.max(1, box.right - box.x);
  const boxHeight = Math.max(1, box.bottom - box.y);
  const coverage = (boxWidth * boxHeight) / Math.max(1, width * height);
  const cardRatio = boxHeight / boxWidth;
  const ratioScore = 100 - Math.min(55, Math.abs(cardRatio - 1.4) * 42);
  const coverageScore = clamp(coverage * 115, 35, 100);
  return clamp(ratioScore * 0.45 + coverageScore * 0.55, 35, 99);
}

function updateScanTelemetry() {
  const frame = document.querySelector("#scanFrameScore");
  const border = document.querySelector("#scanBorderScore");
  const focus = document.querySelector("#scanFocusScore");
  if (!frame || !border || !focus) return;
  if (!lastScanAnalysis) {
    frame.textContent = "Waiting";
    border.textContent = "Waiting";
    focus.textContent = "Waiting";
    return;
  }
  frame.textContent = `${Math.round(lastScanAnalysis.confidence)}%`;
  border.textContent = `${Math.round(lastScanAnalysis.borderConfidence)}%`;
  focus.textContent = `${Math.round(lastScanAnalysis.quality)}%`;
}

function scanTelemetryCard() {
  if (!lastScanAnalysis) {
    return `
      <div class="scan-telemetry">
        <article><small>Scan confidence</small><strong>Manual review</strong></article>
        <article><small>Border lock</small><strong>Not measured</strong></article>
        <article><small>Focus signal</small><strong>Not measured</strong></article>
      </div>`;
  }
  return `
    <div class="scan-telemetry">
      <article><small>Scan confidence</small><strong>${Math.round(lastScanAnalysis.confidence)}%</strong></article>
      <article><small>Border lock</small><strong>${Math.round(lastScanAnalysis.borderConfidence)}%</strong></article>
      <article><small>Focus signal</small><strong>${Math.round(lastScanAnalysis.quality)}%</strong></article>
    </div>`;
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
  activeGradeResult = null;
  document.querySelector("#certNumber").textContent = "Pending scan";
  document.querySelector("#gradeScore").textContent = "--";
  document.querySelector("#gradeConfidence").textContent = "No grade generated yet";
  document.querySelector("#gradeName").textContent = "Upload front and back";
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
  updateGradeMethods();
  initGradePhotoLab();
  initCertificateLibrary();
}

function renderGradeMetrics(metrics) {
  document.querySelector("#gradeBreakdown").innerHTML = metrics.map(([label, score]) => `
    <article>
      <div><strong>${label}</strong><span>${score ? `${Math.round(score)}%` : "Waiting"}</span></div>
      <b><i style="width:${Math.max(0, Math.min(100, score))}%"></i></b>
    </article>`).join("");
}

function initGradePhotoLab() {
  const inputs = document.querySelectorAll("[data-grade-photo]");
  const preview = document.querySelector("#gradePhotoPreview");
  const status = document.querySelector("#gradePhotoStatus");
  const report = document.querySelector("#gradeReport");
  const handoff = document.querySelector("#gradeHandoffNotice");
  const uploaded = new Map();
  const scannerFront = storage.getItem("cardcortex-grade-front");
  const scannerName = storage.getItem("cardcortex-grade-source-name") || "scanned card";
  if (scannerFront && handoff) {
    const file = dataUrlToFile(scannerFront, `cardcortex-${scannerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-front.jpg`);
    uploaded.set("front", { file, url: scannerFront, dataUrl: scannerFront });
    handoff.hidden = false;
    handoff.innerHTML = `<strong>Scanner handoff loaded.</strong> Front image from ${escapeHtml(scannerName)} is ready. Add the back photo to run the full two-sided grade.`;
    preview.innerHTML = `<figure><img src="${scannerFront}" alt="front card view from scanner" /><figcaption>front from scanner</figcaption></figure>`;
    updateGradeMethods({ front: true, back: false });
    status.textContent = "Front scan loaded from scanner. Add the back photo to unlock automatic grading.";
  }
  inputs.forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const dataUrl = await imageFileToDisplayDataUrl(file);
      uploaded.set(input.dataset.gradePhoto, { file, url: dataUrl, dataUrl });
      preview.innerHTML = [...uploaded.entries()].map(([label, item]) => `<figure><img src="${item.url}" alt="${label} card view" /><figcaption>${label}</figcaption></figure>`).join("");
      resetGradeResult();
      updateGradeMethods({ front: uploaded.has("front"), back: uploaded.has("back") });
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
      result.sourceName = storage.getItem("cardcortex-grade-source-name") || "";
      result.frontUrl = uploaded.get("front").dataUrl || uploaded.get("front").url;
      result.backUrl = uploaded.get("back").dataUrl || uploaded.get("back").url;
      renderAutomaticGrade(result, report, status);
    } catch (error) {
      status.textContent = `Automatic grading failed: ${error.message}`;
    }
  });
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, content] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const binary = atob(content || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], filename, { type: mime });
}

async function imageFileToDisplayDataUrl(file, maxWidth = 760) {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#071228";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

function resetGradeResult() {
  activeGradeResult = null;
  document.querySelector("#certNumber").textContent = "Pending scan";
  document.querySelector("#gradeName").textContent = "Ready for image analysis";
  document.querySelector("#gradeScore").textContent = "--";
  document.querySelector("#gradeConfidence").textContent = "No grade generated yet";
  const report = document.querySelector("#gradeReport");
  if (report) {
    report.hidden = true;
    report.innerHTML = "";
  }
}

function renderAutomaticGrade(result, report, status) {
  activeGradeResult = certificateFromGradeResult(result);
  document.querySelector("#gradeScore").textContent = result.grade.toFixed(1);
  document.querySelector("#gradeConfidence").textContent = `AI confidence ${Math.round(result.confidence)}%`;
  document.querySelector("#certNumber").textContent = result.certNumber;
  document.querySelector("#gradeName").textContent = `CardCortex certified estimate ${result.grade.toFixed(1)}`;
  renderGradeMetrics(result.metrics);
  updateGradeMethods({
    centering: result.metricsByKey.centering,
    corners: result.metricsByKey.corners,
    edges: result.metricsByKey.edges,
    surface: result.metricsByKey.surface,
    print: result.metricsByKey.print,
    whitening: result.metricsByKey.whitening,
    confidence: result.confidence,
    certificate: result.score1000,
  });
  report.hidden = false;
  report.innerHTML = `
    <div class="cert-slab">
      <div class="slab-media">
        <img src="${result.frontUrl || ""}" alt="Front card scan used for grading" />
        <img src="${result.backUrl || ""}" alt="Back card scan used for grading" />
      </div>
      <div class="slab-label">
        <span>CardCortex AI Certified</span>
        <strong>${result.grade.toFixed(1)}</strong>
        <p>${escapeHtml(result.certNumber)}</p>
        <div class="slab-code" aria-hidden="true">${result.qrCells.map((on) => `<i class="${on ? "on" : ""}"></i>`).join("")}</div>
      </div>
    </div>
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
    <div class="grade-report-actions">
      <button class="primary-button" type="button" data-cert-action="save">Save certificate</button>
      <button class="secondary-button" type="button" data-cert-action="export">Export report</button>
      <button class="secondary-button" type="button" data-cert-action="vault">Add to vault</button>
      <button class="secondary-button" type="button" data-cert-action="sell">Prepare listing</button>
    </div>
  `;
  if (status) status.textContent = `Automatic grade complete: ${result.grade.toFixed(1)} with ${Math.round(result.confidence)}% confidence.`;
}

function initCertificateLibrary() {
  renderCertificateLibrary();
  document.querySelector("#gradeReport")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-cert-action]")?.dataset.certAction;
    if (!action || !activeGradeResult) return;
    if (action === "save") saveActiveCertificate();
    if (action === "export") exportCertificate(activeGradeResult);
    if (action === "vault") sendCertificateToVault(activeGradeResult);
    if (action === "sell") sendCertificateToMarketplace(activeGradeResult);
  });
  document.querySelector("#certificateLibrary")?.addEventListener("click", (event) => {
    const certNumber = event.target.closest("[data-cert-id]")?.dataset.certId;
    const action = event.target.closest("[data-cert-library-action]")?.dataset.certLibraryAction;
    if (!certNumber || !action) return;
    const cert = getCertificates().find((item) => item.certNumber === certNumber);
    if (!cert) return;
    if (action === "view") {
      const report = document.querySelector("#gradeReport");
      const status = document.querySelector("#gradePhotoStatus");
      renderAutomaticGrade(cert, report, status);
      report.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (action === "export") exportCertificate(cert);
    if (action === "sell") sendCertificateToMarketplace(cert);
    if (action === "delete") {
      persistCertificates(getCertificates().filter((item) => item.certNumber !== certNumber));
      renderCertificateLibrary();
    }
  });
  document.querySelector("#exportCertificatesButton")?.addEventListener("click", () => {
    exportJson(getCertificates(), `cardcortex-certificates-${new Date().toISOString().slice(0, 10)}.json`);
  });
  document.querySelector("#clearCertificatesButton")?.addEventListener("click", () => {
    if (!getCertificates().length) return;
    if (!window.confirm("Clear all saved CardCortex certificates from this browser?")) return;
    persistCertificates([]);
    renderCertificateLibrary();
  });
}

function certificateFromGradeResult(result) {
  return {
    id: result.certNumber,
    certNumber: result.certNumber,
    sourceName: result.sourceName || storage.getItem("cardcortex-grade-source-name") || "Uploaded card",
    grade: Number(result.grade || 0),
    score1000: Number(result.score1000 || 0),
    confidence: Number(result.confidence || 0),
    createdAt: result.createdAt || new Date().toISOString(),
    frontUrl: result.frontUrl || "",
    backUrl: result.backUrl || "",
    metrics: result.metrics || [],
    metricsByKey: result.metricsByKey || {},
    notes: result.notes || [],
    flags: result.flags || [],
    summary: result.summary || "",
    qrCells: result.qrCells || pseudoQrCells(result.certNumber || String(Date.now())),
  };
}

function getCertificates() {
  try {
    const parsed = JSON.parse(storage.getItem(CERTIFICATE_STORE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCertificates(certificates) {
  storage.setItem(CERTIFICATE_STORE_KEY, JSON.stringify(certificates.slice(0, 24)));
}

function saveActiveCertificate() {
  const certificates = getCertificates().filter((item) => item.certNumber !== activeGradeResult.certNumber);
  persistCertificates([activeGradeResult, ...certificates]);
  renderCertificateLibrary();
  const status = document.querySelector("#gradePhotoStatus");
  if (status) status.textContent = `${activeGradeResult.certNumber} saved to the CardCortex certification library.`;
}

function renderCertificateLibrary() {
  const target = document.querySelector("#certificateLibrary");
  if (!target) return;
  const certificates = getCertificates();
  if (!certificates.length) {
    target.innerHTML = `
      <article class="certificate-empty">
        <strong>No certificates saved yet.</strong>
        <p>Run a front/back automatic grade, then save the certificate here for export, vault entry, or listing prep.</p>
      </article>
    `;
    return;
  }
  target.innerHTML = certificates.map(certificateCard).join("");
}

function certificateCard(cert) {
  return `
    <article class="certificate-card" data-cert-id="${escapeAttribute(cert.certNumber)}">
      <div class="certificate-card-media">
        <img src="${cert.frontUrl || ""}" alt="Saved certificate front scan" />
        <img src="${cert.backUrl || ""}" alt="Saved certificate back scan" />
      </div>
      <div>
        <small>${escapeHtml(cert.certNumber)}</small>
        <h3>${escapeHtml(cert.sourceName || "CardCortex certificate")}</h3>
        <div class="chip-row">
          <span>AI grade ${Number(cert.grade || 0).toFixed(1)}</span>
          <span>${Math.round(cert.confidence || 0)}% confidence</span>
          <span>${Math.round(cert.score1000 || 0)}/1000</span>
        </div>
      </div>
      <div class="certificate-card-actions">
        <button class="secondary-button tiny-button" type="button" data-cert-library-action="view">View</button>
        <button class="secondary-button tiny-button" type="button" data-cert-library-action="export">Export</button>
        <button class="secondary-button tiny-button" type="button" data-cert-library-action="sell">Sell</button>
        <button class="danger-button tiny-button" type="button" data-cert-library-action="delete">Delete</button>
      </div>
    </article>
  `;
}

function exportCertificate(cert) {
  exportJson(cert, `${cert.certNumber || "cardcortex-certificate"}.json`);
}

function exportJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sendCertificateToMarketplace(cert) {
  storage.setItem("cardcortex-listing-card", JSON.stringify({
    name: cert.sourceName || "AI graded trading card",
    condition: `CardCortex AI certificate ${cert.certNumber}: estimated grade ${Number(cert.grade || 0).toFixed(1)}, score ${Math.round(cert.score1000 || 0)}/1000, confidence ${Math.round(cert.confidence || 0)}%. ${cert.flags?.join("; ") || ""}`,
    price: "",
  }));
  window.location.href = "./marketplace.html?from=certificate";
}

function sendCertificateToVault(cert) {
  storage.setItem("cardcortex-vault-draft", JSON.stringify({
    name: cert.sourceName || "AI graded card",
    category: "AI graded",
    rawValue: "",
    grade: Number(cert.grade || 0).toFixed(1),
    certNumber: cert.certNumber,
  }));
  window.location.href = "./vault.html?from=certificate";
}

function updateGradeMethods(scores = {}) {
  const labels = {
    centering: scores.centering ? `${Math.round(scores.centering)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    corners: scores.corners ? `${Math.round(scores.corners)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    edges: scores.edges ? `${Math.round(scores.edges)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    surface: scores.surface ? `${Math.round(scores.surface)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    print: scores.print ? `${Math.round(scores.print)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    whitening: scores.whitening ? `${Math.round(scores.whitening)}%` : scores.front || scores.back ? "Queued" : "Waiting",
    confidence: scores.confidence ? `${Math.round(scores.confidence)}%` : scores.front && scores.back ? "Ready" : "Waiting",
    certificate: scores.certificate ? `${Math.round(scores.certificate)}/1000` : scores.front && scores.back ? "Ready" : "Waiting",
  };
  Object.entries(labels).forEach(([key, value]) => {
    const target = document.querySelector(`[data-grade-method="${key}"] span`);
    if (target) target.textContent = value;
  });
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
  const fingerprint = imageFingerprint(luminance, width, height);
  const defects = detectDefects(luminance, edge.map, width, height, box);
  return { width, height, brightness, contrast, edgeAverage: edge.average, box, quality, centering, corners, edges, surface, print, whitening, fingerprint, defects };
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
  const defectPenalty = Math.min(14, (front.defects.hotspots + back.defects.hotspots) * 0.9 + (front.defects.scratchSignals + back.defects.scratchSignals) * 0.18);
  const weighted = centeringScore * 0.17 + corners * 0.19 + edges * 0.19 + surface * 0.18 + print * 0.11 + whitening * 0.1 + photoQuality * 0.06 - defectPenalty;
  const score1000 = clamp(Math.round(weighted * 10), 100, 990);
  const grade = clamp(Math.round((score1000 / 100) * 10) / 10, 1, 10);
  const confidence = clamp(photoQuality * 0.68 + Math.min(front.width, back.width) * 0.04 + 18, 40, 97);
  const certSeed = `${front.fingerprint}${back.fingerprint}${score1000}`;
  const certNumber = `CC-AI-${new Date().getFullYear()}-${hashString(certSeed).toString(36).toUpperCase().padStart(6, "0").slice(0, 8)}`;
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
    defectPenalty > 7 ? "Visible defect signals lowered the grade" : "No heavy defect cluster detected",
    photoQuality < 75 ? "Retake with stronger lighting for higher confidence" : "Photo quality acceptable",
  ];
  return {
    grade,
    score1000,
    confidence,
    metrics,
    metricsByKey: { centering: centeringScore, corners, edges, surface, print, whitening, confidence },
    certNumber,
    qrCells: pseudoQrCells(certSeed),
    summary: `Estimated digital grade ${grade.toFixed(1)} (${score1000}/1000) from front/back image processing: border detection, centering ratios, corner sampling, edge whitening, surface-glare/scratch signals, print contrast, and photo confidence. This is a CardCortex AI certificate, not an official third-party slab grade.`,
    flags,
    notes: [
      { label: "Centering", value: `${front.centering.horizontal} H / ${front.centering.vertical} V`, detail: "Measured from detected border balance on the front image." },
      { label: "Corners", value: `${Math.round(corners)}%`, detail: "Looks for corner roughness, asymmetry, and brightness changes." },
      { label: "Edges", value: `${Math.round(edges)}%`, detail: "Samples all four border bands for chipping, whitening, and edge noise." },
      { label: "Surface", value: `${Math.round(surface)}%`, detail: "Checks interior glare, scratch-like contrast, and uneven surface signals." },
      { label: "Back whitening", value: `${Math.round(whitening)}%`, detail: "Weights bright edge wear from the back photo." },
      { label: "Defect scan", value: `${front.defects.hotspots + back.defects.hotspots} clusters`, detail: "Counts bright wear clusters and scratch-like edge signals that lower the score." },
      { label: "Score scale", value: `${score1000}/1000`, detail: "Converts the weighted inspection score into a collector-style 1000-point precision score." },
      { label: "Photo confidence", value: `${Math.round(confidence)}%`, detail: "Based on focus, contrast, lighting, and image resolution." },
    ],
  };
}

function imageFingerprint(luminance, width, height) {
  const cells = 8;
  const bits = [];
  const overall = average(Array.from(luminance));
  for (let cy = 0; cy < cells; cy += 1) {
    for (let cx = 0; cx < cells; cx += 1) {
      const region = sampleRegion(luminance, null, width, (cx / cells) * width, (cy / cells) * height, width / cells, height / cells);
      bits.push(region.lum > overall ? "1" : "0");
    }
  }
  return parseInt(bits.join("").slice(0, 31), 2).toString(36) + parseInt(bits.join("").slice(31), 2).toString(36);
}

function detectDefects(luminance, edgeMap, width, height, box) {
  const insetX = Math.round((box.right - box.x) * 0.08);
  const insetY = Math.round((box.bottom - box.y) * 0.08);
  const region = sampleRegion(luminance, edgeMap, width, box.x + insetX, box.y + insetY, box.right - box.x - insetX * 2, box.bottom - box.y - insetY * 2);
  const hotspots = Math.round(region.brightRatio * 80);
  const scratchSignals = Math.round(region.edge);
  return { hotspots, scratchSignals };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pseudoQrCells(seed) {
  const hash = hashString(seed);
  return Array.from({ length: 49 }, (_, index) => ((hash >> (index % 24)) + index * 7) % 3 !== 0);
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

function renderReports() {
  const typeSelect = document.querySelector("#reportType");
  const scopeSelect = document.querySelector("#reportScope");
  const status = document.querySelector("#reportStatus");
  const exportButton = document.querySelector("#exportReportButton");
  const csvButton = document.querySelector("#exportReportCsvButton");
  const copyButton = document.querySelector("#copyReportButton");
  const printButton = document.querySelector("#printReportButton");
  if (!typeSelect || !scopeSelect) return;
  let activeReport = null;

  const draw = () => {
    populateReportScope(scopeSelect);
    const scopedCards = filterReportCards(cards, scopeSelect.value);
    activeReport = buildPortfolioReport(scopedCards, typeSelect.value);
    renderPortfolioReport(activeReport);
    storage.setItem("cardcortex-portfolio-report", JSON.stringify(activeReport));
  };

  [typeSelect, scopeSelect].forEach((control) => control.addEventListener("input", draw));
  exportButton?.addEventListener("click", () => {
    const report = activeReport || buildPortfolioReport(filterReportCards(cards, scopeSelect.value), typeSelect.value);
    exportJson(report, `cardcortex-${report.slug}-${report.createdDate}.json`);
  });
  csvButton?.addEventListener("click", () => {
    const report = activeReport || buildPortfolioReport(filterReportCards(cards, scopeSelect.value), typeSelect.value);
    exportReportCsv(report);
  });
  copyButton?.addEventListener("click", async () => {
    const text = document.querySelector("#reportPreviewText")?.textContent || "";
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied report";
    } catch {
      const preview = document.querySelector("#reportPreviewText");
      preview?.focus();
      copyButton.textContent = "Select preview text";
    }
  });
  printButton?.addEventListener("click", () => window.print());
  document.querySelector("#reportTables")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-report-card]");
    if (!row) return;
    const card = cards.find((item) => item.id === row.dataset.reportCard);
    if (!card) return;
    storage.setItem("cardcortex-listing-card", JSON.stringify({
      name: card.name,
      condition: `Portfolio report review: AI grade ${card.grade || "n/a"}, confidence ${Math.round(card.confidence || 0)}%, storage ${cleanText(card.storage)}.`,
      price: card.rawValue,
    }));
    if (status) status.textContent = `${cleanText(card.name)} staged for the Sell page. Open Sell to generate a launch kit.`;
  });

  populateReportScope(scopeSelect);
  loadSupabaseCards(status).then(() => {
    populateReportScope(scopeSelect);
    draw();
  });
  draw();
}

function populateReportScope(select) {
  if (!select) return;
  const current = select.value || "all";
  const categories = [...new Set(cards.map((card) => card.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const fixed = [
    ["all", "Whole collection"],
    ["high-value", "High-value cards"],
    ["grade-candidates", "Grade candidates"],
    ["sell-ready", "Sell-ready cards"],
    ["storage-review", "Storage review"],
  ];
  const options = [
    ...fixed,
    ...categories.map((category) => [`category:${category}`, `${category} category`]),
  ];
  select.innerHTML = options.map(([value, label]) => `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`).join("");
  select.value = options.some(([value]) => value === current) ? current : "all";
}

function filterReportCards(items, scope) {
  const source = [...items];
  if (!scope || scope === "all") return source;
  if (scope === "high-value") return source.filter((card) => Number(card.rawValue || 0) >= 100);
  if (scope === "grade-candidates") return source.filter((card) => gradedUpside(card) >= 40 || Number(card.grade || 0) >= 8.7);
  if (scope === "sell-ready") return source.filter((card) => cardReadiness(card).score >= 70 || Number(card.rawValue || 0) >= 150);
  if (scope === "storage-review") return source.filter((card) => needsStorageReview(card));
  if (scope.startsWith("category:")) return source.filter((card) => card.category === scope.slice(9));
  return source;
}

function buildPortfolioReport(items, type = "insurance") {
  const reportCards = [...items];
  const categories = reportCategoryExposure(reportCards);
  const rawTotal = reportCards.reduce((sum, card) => sum + Number(card.rawValue || 0), 0);
  const gradedTotal = reportCards.reduce((sum, card) => sum + Number(card.gradedValue || card.rawValue || 0), 0);
  const upside = Math.max(0, gradedTotal - rawTotal);
  const averageGrade = average(reportCards.map((card) => Number(card.grade || 0)).filter(Boolean));
  const averageConfidence = average(reportCards.map((card) => Number(card.confidence || 0)).filter(Boolean));
  const topCards = [...reportCards].sort((a, b) => Number(b.rawValue || 0) - Number(a.rawValue || 0)).slice(0, 8);
  const gradeCandidates = [...reportCards].sort((a, b) => gradedUpside(b) - gradedUpside(a)).slice(0, 8);
  const sellCandidates = [...reportCards].sort((a, b) => {
    const bScore = cardReadiness(b).score + Number(b.rawValue || 0) / 16;
    const aScore = cardReadiness(a).score + Number(a.rawValue || 0) / 16;
    return bScore - aScore;
  }).slice(0, 8);
  const certificates = getCertificates();
  const matchedCertificates = certificates.filter((cert) => reportCards.some((card) => cleanText(card.name).toLowerCase() === cleanText(cert.sourceName).toLowerCase()));
  const highValueCards = reportCards.filter((card) => Number(card.rawValue || 0) >= 250);
  const lowConfidenceCards = reportCards.filter((card) => Number(card.confidence || 0) && Number(card.confidence || 0) < 80);
  const storageReviewCards = reportCards.filter(needsStorageReview);
  const sourceNames = [...new Set(reportCards.flatMap((card) => Object.entries(card.sources || {}).filter((entry) => Number(entry[1] || 0) > 0).map((entry) => entry[0])))];
  const replacementEstimate = Math.round(rawTotal * 1.12 + Math.min(upside * 0.22, rawTotal * 0.35) + highValueCards.length * 20);
  const riskScore = clamp(highValueCards.length * 11 + lowConfidenceCards.length * 7 + storageReviewCards.length * 8 - sourceNames.length * 2, 8, 96);
  const riskLabel = riskScore >= 70 ? "High attention" : riskScore >= 42 ? "Managed watch" : "Stable";
  const topCard = topCards[0];
  const report = {
    type,
    slug: slugify(`${type}-portfolio-report`),
    createdAt: new Date().toISOString(),
    createdDate: new Date().toISOString().slice(0, 10),
    cards: reportCards,
    totals: {
      rawValue: rawTotal,
      gradedValue: gradedTotal,
      gradedUpside: upside,
      replacementEstimate,
      averageGrade,
      averageConfidence,
      sourceCount: sourceNames.length,
      categoryCount: categories.length,
      certificateCount: matchedCertificates.length,
      riskScore,
      riskLabel,
    },
    categories,
    sourceNames,
    topCards,
    gradeCandidates,
    sellCandidates,
    riskNotes: reportRiskNotes(highValueCards, lowConfidenceCards, storageReviewCards, sourceNames),
    actionPlan: reportActionPlan(type, topCards, gradeCandidates, sellCandidates, storageReviewCards, matchedCertificates),
    narrative: reportNarrative(type, reportCards, rawTotal, upside, replacementEstimate, topCard, categories),
  };
  return report;
}

function reportCategoryExposure(items) {
  const grouped = items.reduce((map, card) => {
    const key = card.category || "Uncategorized";
    if (!map[key]) map[key] = { category: key, count: 0, rawValue: 0, gradedValue: 0, highest: null, color: card.color || "#76f7ff" };
    map[key].count += 1;
    map[key].rawValue += Number(card.rawValue || 0);
    map[key].gradedValue += Number(card.gradedValue || card.rawValue || 0);
    if (!map[key].highest || Number(card.rawValue || 0) > Number(map[key].highest.rawValue || 0)) map[key].highest = card;
    return map;
  }, {});
  return Object.values(grouped).sort((a, b) => b.rawValue - a.rawValue);
}

function renderPortfolioReport(report) {
  renderReportStats(report);
  renderReportNarrative(report);
  renderReportExposure(report);
  renderReportTables(report);
  renderReportPreview(report);
}

function renderReportStats(report) {
  const target = document.querySelector("#reportStats");
  const hero = document.querySelector("#reportHeroMetric");
  if (hero) {
    hero.innerHTML = `<small>Replacement estimate</small><strong>${money.format(report.totals.replacementEstimate)}</strong><span>${escapeHtml(report.totals.riskLabel)} risk posture</span>`;
  }
  if (!target) return;
  const stats = [
    ["Tracked value", money.format(report.totals.rawValue), `${report.cards.length} cards in scope`],
    ["Graded upside", money.format(report.totals.gradedUpside), `${report.gradeCandidates.length} grade candidates`],
    ["Average grade", report.totals.averageGrade ? report.totals.averageGrade.toFixed(1) : "n/a", `${Math.round(report.totals.averageConfidence || 0)}% average confidence`],
    ["Source spread", String(report.totals.sourceCount), `${report.totals.categoryCount} categories covered`],
    ["Saved certificates", String(report.totals.certificateCount), "front/back evidence attached"],
    ["Risk score", `${Math.round(report.totals.riskScore)}/100`, report.totals.riskLabel],
  ];
  target.innerHTML = stats.map(([label, value, detail]) => `
    <article class="report-stat">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail)}</span>
    </article>
  `).join("");
}

function renderReportNarrative(report) {
  const target = document.querySelector("#reportNarrative");
  if (!target) return;
  target.innerHTML = `
    <article class="report-panel report-narrative-card">
      <h2>${escapeHtml(reportTitle(report.type))}</h2>
      <p>${escapeHtml(report.narrative)}</p>
      <div class="report-risk-radar">
        <span><small>High value</small><strong>${report.cards.filter((card) => Number(card.rawValue || 0) >= 250).length}</strong></span>
        <span><small>Storage review</small><strong>${report.cards.filter(needsStorageReview).length}</strong></span>
        <span><small>Market sources</small><strong>${report.sourceNames.length}</strong></span>
      </div>
    </article>
    <article class="report-panel">
      <h2>Next actions</h2>
      <ol class="report-action-list">
        ${report.actionPlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    </article>
  `;
}

function renderReportExposure(report) {
  const target = document.querySelector("#categoryExposure");
  if (!target) return;
  const max = Math.max(1, ...report.categories.map((category) => category.rawValue));
  target.innerHTML = report.categories.map((category) => `
    <article class="exposure-row" style="--card-accent:${category.color}; --exposure:${Math.max(6, (category.rawValue / max) * 100)}%">
      <div>
        <strong>${escapeHtml(category.category)}</strong>
        <span>${category.count} card${category.count === 1 ? "" : "s"} - top: ${escapeHtml(cleanText(category.highest?.name || "n/a"))}</span>
      </div>
      <div class="exposure-bar"><i></i></div>
      <small>${money.format(category.rawValue)}</small>
    </article>
  `).join("") || `<article class="empty-state">No category exposure yet.</article>`;
}

function renderReportTables(report) {
  const target = document.querySelector("#reportTables");
  if (!target) return;
  target.innerHTML = `
    ${reportTable("Top value cards", report.topCards, (card) => money.format(card.rawValue), (card) => `${card.category} - ${cleanText(card.storage)}`)}
    ${reportTable("Grade upside queue", report.gradeCandidates, (card) => money.format(gradedUpside(card)), (card) => `AI ${card.grade || "n/a"} - ${Math.round(card.confidence || 0)}% confidence`)}
    ${reportTable("Sell route queue", report.sellCandidates, (card) => bestSellRoute(card).name, (card) => `${cardReadiness(card).label} - ${money.format(card.rawValue)}`)}
    <article class="report-panel report-risk-panel">
      <h2>Risk notes</h2>
      <ul>${report.riskNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    </article>
  `;
}

function reportTable(title, rows, metric, detail) {
  return `
    <article class="report-panel report-table">
      <h2>${escapeHtml(title)}</h2>
      ${rows.map((card, index) => `
        <button type="button" class="report-card-row" data-report-card="${escapeAttribute(card.id)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(cleanText(card.name))}</strong>
          <em>${escapeHtml(detail(card))}</em>
          <small>${escapeHtml(metric(card))}</small>
        </button>
      `).join("") || `<p class="empty-state">No matching cards yet.</p>`}
    </article>
  `;
}

function renderReportPreview(report) {
  const target = document.querySelector("#reportPreviewText");
  if (!target) return;
  const preview = [
    `CardCortex ${reportTitle(report.type)}`,
    `Created: ${new Date(report.createdAt).toLocaleString()}`,
    `Cards in report: ${report.cards.length}`,
    `Tracked raw value: ${money.format(report.totals.rawValue)}`,
    `Replacement estimate: ${money.format(report.totals.replacementEstimate)}`,
    `Projected graded upside: ${money.format(report.totals.gradedUpside)}`,
    `Average AI grade: ${report.totals.averageGrade ? report.totals.averageGrade.toFixed(1) : "n/a"}`,
    `Average confidence: ${Math.round(report.totals.averageConfidence || 0)}%`,
    `Risk posture: ${report.totals.riskLabel} (${Math.round(report.totals.riskScore)}/100)`,
    "",
    "Executive summary:",
    report.narrative,
    "",
    "Top cards:",
    ...report.topCards.slice(0, 5).map((card, index) => `${index + 1}. ${cleanText(card.name)} - ${card.category} - ${money.format(card.rawValue)} - ${cleanText(card.storage)}`),
    "",
    "Recommended actions:",
    ...report.actionPlan.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Risk notes:",
    ...report.riskNotes.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");
  target.textContent = preview;
}

function reportNarrative(type, items, rawTotal, upside, replacementEstimate, topCard, categories) {
  const scope = `${items.length} card${items.length === 1 ? "" : "s"}`;
  const topCategory = categories[0]?.category || "uncategorized";
  if (type === "seller") {
    return `${scope} are prepared for selling review with ${money.format(rawTotal)} tracked value. The strongest current route begins with ${topCard ? cleanText(topCard.name) : "the highest-value card"}, while ${topCategory} carries the largest category exposure.`;
  }
  if (type === "grading") {
    return `${scope} show ${money.format(upside)} in projected graded upside. Prioritize clean front/back scans, confidence review, and certificate saving before sending anything to a paid grading route.`;
  }
  if (type === "audit") {
    return `${scope} are ready for a collection audit. The report checks storage gaps, low-confidence values, category concentration, saved certificates, and exportable evidence.`;
  }
  return `${scope} are summarized for insurance and replacement planning at ${money.format(replacementEstimate)} estimated coverage. ${topCard ? cleanText(topCard.name) : "The top card"} anchors the report, and ${topCategory} is the largest value category.`;
}

function reportActionPlan(type, topCards, gradeCandidates, sellCandidates, storageReviewCards, certificates) {
  const actions = [];
  if (type === "seller") {
    actions.push(sellCandidates[0] ? `Prepare a launch kit for ${cleanText(sellCandidates[0].name)} on ${bestSellRoute(sellCandidates[0]).name}.` : "Add values to unlock sell-route recommendations.");
    actions.push("Export listing kits for the top sell candidates before publishing.");
  } else if (type === "grading") {
    actions.push(gradeCandidates[0] ? `Run fresh two-photo grading evidence for ${cleanText(gradeCandidates[0].name)}.` : "Add graded value estimates to build a grading queue.");
    actions.push("Save a CardCortex certificate for every card you plan to sell or insure.");
  } else if (type === "audit") {
    actions.push(storageReviewCards[0] ? `Fix storage details for ${cleanText(storageReviewCards[0].name)} first.` : "Storage fields look organized for this report scope.");
    actions.push("Export CSV and JSON backups after every major vault cleanup.");
  } else {
    actions.push(topCards[0] ? `Photograph and verify ${cleanText(topCards[0].name)} because it carries the highest reported value.` : "Add high-value cards to create an insurance priority list.");
    actions.push("Export the report JSON and CSV, then keep a printed or PDF copy with collection photos.");
  }
  actions.push(certificates.length ? `${certificates.length} saved certificate${certificates.length === 1 ? "" : "s"} matched cards in this report.` : "Create front/back certificates for the top cards so the report has image evidence.");
  actions.push("Re-run values before selling or filing an insurance record because markets move.");
  return actions.slice(0, 4);
}

function reportRiskNotes(highValueCards, lowConfidenceCards, storageReviewCards, sourceNames) {
  const notes = [];
  if (highValueCards.length) notes.push(`${highValueCards.length} card${highValueCards.length === 1 ? "" : "s"} are above $250 and should have photos, storage location, and insured-shipping notes.`);
  if (lowConfidenceCards.length) notes.push(`${lowConfidenceCards.length} card${lowConfidenceCards.length === 1 ? "" : "s"} have lower confidence signals and need fresh comps or cleaner scans.`);
  if (storageReviewCards.length) notes.push(`${storageReviewCards.length} card${storageReviewCards.length === 1 ? "" : "s"} need storage cleanup before a serious insurance export.`);
  if (sourceNames.length < 2) notes.push("Add more pricing sources before relying on this report for a major sale or claim.");
  if (!notes.length) notes.push("No major report risk flags in this scope. Keep values refreshed and store photo evidence.");
  return notes;
}

function exportReportCsv(report) {
  const headers = ["Name", "Category", "Set", "Number", "Storage", "Raw Value", "Graded Value", "AI Grade", "Confidence", "Best Route"];
  const rows = report.cards.map((card) => [
    cleanText(card.name),
    card.category,
    card.set,
    card.number,
    cleanText(card.storage),
    card.rawValue,
    card.gradedValue,
    card.grade,
    card.confidence,
    bestSellRoute(card).name,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cardcortex-${report.slug}-${report.createdDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function needsStorageReview(card) {
  const storageText = String(card.storage || "");
  return !storageText.trim() || /unassigned|inbox|pending|unknown|loose/i.test(storageText);
}

function cleanText(value) {
  return String(value || "").replace(/&middot;/g, " - ").replace(/\s+/g, " ").trim();
}

function reportTitle(type) {
  return {
    insurance: "Insurance Report",
    seller: "Seller Readiness Report",
    grading: "Grading Priority Report",
    audit: "Collection Audit Report",
  }[type] || "Portfolio Report";
}

function renderMarketplace() {
  document.querySelector("#marketRoutes").innerHTML = marketplaces.map((market) => `
    <article class="market-card">
      <h2>${market.name}</h2>
      <p>${market.bestFor}</p>
      <div class="chip-row"><span>${market.fee}</span><span>${market.confidence}% route fit</span></div>
      <button class="secondary-button" type="button" data-market="${market.name}">Prepare listing</button>
    </article>`).join("");
  document.querySelector("#marketRoutes")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-market]");
    if (!button) return;
    const route = document.querySelector("#listingRoute");
    if (route) route.value = button.dataset.market;
    document.querySelectorAll("[data-market]").forEach((item) => {
      item.textContent = item === button ? "Route selected" : "Prepare listing";
      item.classList.toggle("prepared", item === button);
    });
    if (document.querySelector("#listingCardName")?.value.trim()) {
      document.querySelector("#listingForm")?.requestSubmit();
    } else {
      button.textContent = "Listing draft prepared";
      button.classList.add("prepared");
    }
  });
  initListingStudio();
}

function initListingStudio() {
  const form = document.querySelector("#listingForm");
  if (!form) return;
  let activeListingKit = null;
  const routeSelect = document.querySelector("#listingRoute");
  routeSelect.innerHTML = marketplaces.map((market) => `<option value="${escapeAttribute(market.name)}">${escapeHtml(market.name)}</option>`).join("");
  const handoff = storage.getItem("cardcortex-listing-card");
  if (handoff) {
    try {
      const card = JSON.parse(handoff);
      document.querySelector("#listingCardName").value = card.name || "";
      document.querySelector("#listingCondition").value = card.condition || "";
      document.querySelector("#listingPrice").value = card.price || "";
      const cert = /CC-AI-\d{4}-[A-Z0-9]+/.exec(card.condition || "");
      document.querySelector("#listingCert").value = cert?.[0] || "";
      const route = recommendedMarketForText(`${card.name || ""} ${card.condition || ""}`);
      if (routeSelect && route) routeSelect.value = route.name;
    } catch {}
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    activeListingKit = buildListingKit();
    renderListingLaunchKit(activeListingKit);
  });
  document.querySelector("#copyListingButton")?.addEventListener("click", async () => {
    const output = document.querySelector("#listingOutput");
    if (!output?.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      document.querySelector("#copyListingButton").textContent = "Copied";
    } catch {
      output.focus();
      output.select();
      document.querySelector("#copyListingButton").textContent = "Select and copy";
    }
  });
  document.querySelector("#exportListingButton")?.addEventListener("click", () => {
    const kit = activeListingKit || buildListingKit();
    exportJson(kit, `cardcortex-listing-kit-${slugify(kit.name)}.json`);
  });
  if (document.querySelector("#listingCardName").value.trim()) form.requestSubmit();
}

function buildListingKit() {
  const name = document.querySelector("#listingCardName").value.trim() || "Trading card";
  const condition = document.querySelector("#listingCondition").value.trim() || "reviewed condition with clear front and back photos";
  const targetPrice = Number(document.querySelector("#listingPrice").value || 0);
  const routeName = document.querySelector("#listingRoute").value || marketplaces[0].name;
  const format = document.querySelector("#listingFormat").value || "fixed";
  const cert = document.querySelector("#listingCert").value.trim();
  const route = marketplaces.find((market) => market.name === routeName) || marketplaces[0];
  const priceBand = listingPriceBand(targetPrice, format, route);
  const titleOptions = listingTitleOptions(name, cert, route, format);
  const photoChecklist = [
    "Front full card, straight and uncropped",
    "Back full card, straight and uncropped",
    "Four corner close-ups",
    "All four edge close-ups",
    "Surface/glare angle photo",
    "Certificate or pre-grade screenshot if included",
  ];
  const shippingChecklist = route.name.includes("COMC")
    ? ["Sleeve and top loader", "Team bag", "Submit with card inventory sheet", "Photograph package contents before shipping"]
    : ["Penny sleeve", "Top loader or semi-rigid holder", "Team bag", "Rigid mailer or box", "Tracking number", "Signature or insurance for higher value cards"];
  const riskNotes = listingRiskNotes(route, format, targetPrice, cert);
  const copy = `${titleOptions[0]}\n\nCondition: ${condition}.\n${cert ? `CardCortex certificate / grade note: ${cert}.\n` : ""}Target route: ${route.name} (${route.bestFor}).\nSuggested format: ${formatLabel(format)}.\nPricing band: ${priceBand.low ? `${money.format(priceBand.low)} - ${money.format(priceBand.high)}` : "set after reviewing sold comps"}.\n\nPhotos included/needed: ${photoChecklist.join("; ")}.\n\nShipping: ${shippingChecklist.join("; ")}.\n\nSeller note: Use honest condition language, show clear front/back photos, include any defects you can see, and avoid claiming an official third-party grade unless the card has one.`;
  const kit = {
    name,
    route: route.name,
    routeFit: route.confidence,
    saleFormat: formatLabel(format),
    targetPrice,
    priceBand,
    titleOptions,
    condition,
    certificate: cert,
    photoChecklist,
    shippingChecklist,
    riskNotes,
    listingCopy: copy,
    createdAt: new Date().toISOString(),
  };
  storage.setItem("cardcortex-listing-kit", JSON.stringify(kit));
  return kit;
}

function renderListingLaunchKit(kit) {
  document.querySelector("#listingOutput").value = kit.listingCopy;
  const target = document.querySelector("#listingLaunchKit");
  if (!target) return;
  target.innerHTML = `
    <article class="launch-summary">
      <small>Recommended route</small>
      <strong>${escapeHtml(kit.route)}</strong>
      <span>${kit.routeFit}% route fit</span>
    </article>
    <article class="launch-summary">
      <small>Price band</small>
      <strong>${kit.priceBand.low ? `${money.format(kit.priceBand.low)} - ${money.format(kit.priceBand.high)}` : "Research comps"}</strong>
      <span>${escapeHtml(kit.saleFormat)}</span>
    </article>
    <article class="launch-summary">
      <small>Launch readiness</small>
      <strong>${kit.certificate ? "Certificate-ready" : "Photo-ready"}</strong>
      <span>${kit.photoChecklist.length} photo checks</span>
    </article>
    <div class="launch-section">
      <h3>Title options</h3>
      ${kit.titleOptions.map((title) => `<button class="copy-chip" type="button" data-copy-text="${escapeAttribute(title)}">${escapeHtml(title)}</button>`).join("")}
    </div>
    <div class="launch-section">
      <h3>Photo checklist</h3>
      <ul>${kit.photoChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="launch-section">
      <h3>Shipping checklist</h3>
      <ul>${kit.shippingChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="launch-section">
      <h3>Risk notes</h3>
      <ul>${kit.riskNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
  target.querySelectorAll("[data-copy-text]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.dataset.copyText;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied title";
      } catch {
        document.querySelector("#listingOutput").value = text;
      }
    });
  });
}

function listingPriceBand(price, format, route) {
  if (!price) return { low: 0, high: 0, anchor: 0 };
  const feeDrag = route.confidence >= 90 ? 0.94 : route.confidence >= 80 ? 0.9 : 0.84;
  const formatSpread = { fixed: [0.94, 1.12], auction: [0.72, 1.18], offer: [0.88, 1.18], bundle: [0.78, 1.04] }[format] || [0.9, 1.1];
  return {
    low: Math.max(1, Math.round(price * formatSpread[0] * feeDrag)),
    high: Math.max(1, Math.round(price * formatSpread[1])),
    anchor: price,
  };
}

function listingTitleOptions(name, cert, route, format) {
  const gradeText = cert ? ` ${cert}` : "";
  const suffix = format === "auction" ? "Auction Ready" : format === "bundle" ? "Collector Lot" : "Clear Photos";
  return [
    `${name}${gradeText} - ${route.name} Listing - ${suffix}`,
    `${name}${cert ? ` | ${cert}` : ""} | Front/Back Photos | Condition Reviewed`,
    `${name} Trading Card ${route.name.includes("eBay") ? "Sold-Comps Ready" : "Collector Ready"}`,
  ];
}

function listingRiskNotes(route, format, price, cert) {
  const notes = [
    "Confirm latest sold comps before publishing the final price.",
    "Disclose visible defects plainly in the description and photos.",
    "Do not describe the card as officially graded unless it has an official third-party grade.",
  ];
  if (format === "auction") notes.push("Auction format can underperform without enough watchers; use a reserve or strong starting price for rare cards.");
  if (price >= 250) notes.push("Use insured tracked shipping and photograph the packaging process.");
  if (route.name.includes("Collector")) notes.push("Community sales need extra trust signals: timestamp photo, clear terms, and payment protection.");
  if (cert) notes.push("Include the CardCortex certificate as a condition-supporting estimate, not as an official slab replacement.");
  return notes;
}

function recommendedMarketForText(text) {
  const normalized = text.toLowerCase();
  if (/magic|pokemon|yu-gi|tcgplayer/.test(normalized)) return marketplaces.find((market) => market.name === "TCGPlayer");
  if (/sports|jordan|upper deck|panini|topps|consignment/.test(normalized)) return marketplaces.find((market) => market.name.includes("COMC"));
  if (/marvel|spider|bakugan|buddyfight|minecraft|community/.test(normalized)) return marketplaces.find((market) => market.name === "Collector communities");
  return marketplaces.find((market) => market.name === "eBay") || marketplaces[0];
}

function formatLabel(format) {
  return { fixed: "Fixed price", auction: "Auction", offer: "Best offer", bundle: "Bundle / lot" }[format] || format;
}

function slugify(value) {
  return String(value || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "card";
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
