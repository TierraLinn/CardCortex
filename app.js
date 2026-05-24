const seedCards = window.CardCortexData.cards;
const { marketplaces } = window.CardCortexData;
let cards = [...seedCards];
let activeVaultRender = null;
let lastScanCard = null;
let lastScanImageUrl = "";
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

function totalValue(items = cards) {
  return items.reduce((sum, card) => sum + card.rawValue, 0);
}

function renderVault() {
  const search = document.querySelector("#vaultSearch");
  const filter = document.querySelector("#categoryFilter");
  const sort = document.querySelector("#sortSelect");
  const quickAddForm = document.querySelector("#quickAddForm");
  const vaultMode = document.querySelector("#vaultMode");
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
    document.querySelector("#cardGrid").innerHTML = sorted.map(cardTile).join("");
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
  loadSupabaseCards(vaultMode).then(rerender);
  rerender();
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
        <p>${card.set} · ${card.number} · ${card.rarity}</p>
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

function simulateScan(result, status) {
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
    </article>`;

  document.querySelector("#newGuessButton")?.addEventListener("click", () => simulateScan(result, status));
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
        <div><h3>${card.name}</h3><p>${card.category} · ${card.set}</p></div>
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
    results.innerHTML = `<div class="ai-panel">Searching Pokémon TCG API for "${escapeHtml(query)}"...</div>`;
    try {
      const found = await searchPokemonTcg(query);
      if (!found.length) {
        results.innerHTML = `<div class="empty-state">No Pokémon TCG API matches found. Try a simpler name.</div>`;
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
        <p>${escapeHtml(card.set?.name || "Unknown set")} · ${escapeHtml(card.number || "")} · ${escapeHtml(card.rarity || "Unknown rarity")}</p>
        <div class="chip-row">
          <span>Source: Pokémon TCG API</span>
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

function renderGrading() {
  const card = cards[0];
  document.querySelector("#certNumber").textContent = `CC-${new Date().getFullYear()}-${card.id.toUpperCase().slice(0, 8)}`;
  const metrics = [
    ["Centering", 91],
    ["Corners", 88],
    ["Edges", 86],
    ["Surface", 92],
    ["Print alignment", 89],
    ["Color integrity", 94],
    ["Glare risk", 73],
    ["Photo confidence", card.confidence],
  ];
  document.querySelector("#gradeBreakdown").innerHTML = metrics.map(([label, score]) => `
    <article>
      <div><strong>${label}</strong><span>${score}%</span></div>
      <b><i style="width:${score}%"></i></b>
    </article>`).join("");
  initGradePhotoLab(metrics);
}

function initGradePhotoLab(baseMetrics) {
  const inputs = document.querySelectorAll("[data-grade-photo]");
  const preview = document.querySelector("#gradePhotoPreview");
  const status = document.querySelector("#gradePhotoStatus");
  const uploaded = new Map();
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      uploaded.set(input.dataset.gradePhoto, URL.createObjectURL(file));
      preview.innerHTML = [...uploaded.entries()].map(([label, url]) => `<figure><img src="${url}" alt="${label} card view" /><figcaption>${label}</figcaption></figure>`).join("");
      status.textContent = `${uploaded.size} grading photo${uploaded.size === 1 ? "" : "s"} ready.`;
    });
  });
  document.querySelector("#runGradeButton")?.addEventListener("click", () => {
    const completeness = uploaded.size / 4;
    const adjustment = Math.round(completeness * 9);
    const metrics = baseMetrics.map(([label, score], index) => [label, Math.min(98, score + adjustment - (index % 3))]);
    document.querySelector("#gradeBreakdown").innerHTML = metrics.map(([label, score]) => `
      <article>
        <div><strong>${label}</strong><span>${score}%</span></div>
        <b><i style="width:${score}%"></i></b>
      </article>`).join("");
    const grade = (7.2 + completeness * 2.5).toFixed(1);
    document.querySelector("#gradeScore").textContent = grade;
    status.textContent = completeness === 1
      ? "AI pre-grade complete with front, back, corners, and surface photos."
      : "AI pre-grade complete, but more photo angles will improve confidence.";
  });
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
