const { cards, marketplaces } = window.CardCortexData;
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
  const categories = ["All categories", ...new Set(cards.map((card) => card.category))];
  filter.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join("");
  const rerender = () => {
    const query = search.value.toLowerCase();
    const category = filter.value;
    const sorted = cards
      .filter((card) => category === "All categories" || card.category === category)
      .filter((card) => `${card.name} ${card.category} ${card.set} ${card.storage}`.toLowerCase().includes(query))
      .sort((a, b) => sort.value === "name" ? a.name.localeCompare(b.name) : sort.value === "grade" ? b.grade - a.grade : b.rawValue - a.rawValue);
    document.querySelector("#vaultTotal").textContent = money.format(totalValue(sorted));
    document.querySelector("#cardGrid").innerHTML = sorted.map(cardTile).join("");
    renderStats(sorted);
  };
  [search, filter, sort].forEach((el) => el.addEventListener("input", rerender));
  rerender();
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
    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      simulateScan(result, status);
    };
    image.src = URL.createObjectURL(event.target.files[0]);
  });
}

function simulateScan(result, status) {
  const card = cards[Math.floor(Math.random() * cards.length)];
  status.textContent = `AI matched ${card.name} with ${card.confidence}% confidence.`;
  result.innerHTML = `
    <article class="scan-card collection-card" style="--card-accent:${card.color}">
      <div class="mini-card holo-card"><span>${card.category}</span><strong>${card.name.slice(0, 2).toUpperCase()}</strong></div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.set} · ${card.number} · ${card.rarity}</p>
        <div class="chip-row"><span>Raw ${money.format(card.rawValue)}</span><span>Graded ${money.format(card.gradedValue)}</span><span>AI ${card.grade}</span></div>
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
