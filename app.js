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
  };
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
      <strong>${money.format(card.rawValue)}</strong>
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
    if (!lastScanCard) return;
    status.textContent = "Saving scan to your real vault...";
    try {
      await api.createCard({
        name: lastScanCard.name,
        category: lastScanCard.category,
        set_name: lastScanCard.set,
        card_number: lastScanCard.number,
        rarity: lastScanCard.rarity,
        storage_location: "Scanned inbox",
        raw_value: lastScanCard.rawValue,
        graded_value: lastScanCard.gradedValue,
        ai_grade: lastScanCard.grade,
        ai_confidence: lastScanCard.confidence,
        image_url: lastScanImageUrl,
      });
      status.textContent = `${lastScanCard.name} saved to your Supabase vault.`;
    } catch (error) {
      status.textContent = `Save failed: ${error.message}`;
    }
  });
}

function simulateScan(result, status) {
  const card = cards[Math.floor(Math.random() * cards.length)];
  lastScanCard = card;
  status.textContent = `AI matched ${card.name} with ${card.confidence}% confidence.`;
  result.innerHTML = `
    <article class="scan-card collection-card" style="--card-accent:${card.color}">
      <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.set} · ${card.number} · ${card.rarity}</p>
        <div class="chip-row"><span>Raw ${money.format(card.rawValue)}</span><span>Graded ${money.format(card.gradedValue)}</span><span>AI ${card.grade}</span></div>
        <button id="saveScanButton" class="primary-button save-scan-button" type="button">Save scan to vault</button>
      </div>
    </article>`;
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
  function addMessage(role, text) {
    log.insertAdjacentHTML("beforeend", `<article class="${role}">${text}</article>`);
    log.scrollTop = log.scrollHeight;
  }
}
