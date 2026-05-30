(function initCatalogSources() {
  const sourceGrid = document.querySelector("#catalogSourceGrid");
  const categoryList = document.querySelector("#tcgCategoryList");
  const status = document.querySelector("#sourceCoverageStatus");
  const filterInput = document.querySelector("#sourceFilterInput");
  const refreshButton = document.querySelector("#refreshSourcesButton");
  const priceChartingForm = document.querySelector("#priceChartingTokenForm");
  const priceChartingInput = document.querySelector("#priceChartingTokenInput");
  const priceChartingStatus = document.querySelector("#priceChartingTokenStatus");
  const clearPriceChartingButton = document.querySelector("#clearPriceChartingTokenButton");
  const priceChartingKey = "cardcortex-pricecharting-token";
  const builtInSources = [
    {
      name: "PriceCharting",
      status: "Token ready",
      coverage: "Paid product search and prices for trading cards, comics, games, coins, toys, and related collectibles.",
      url: "https://www.pricecharting.com/api-documentation",
    },
    {
      name: "Pokemon TCG API",
      status: "Live",
      coverage: "Pokemon cards, sets, images, rarities, and price fields from TCGPlayer/Cardmarket where available.",
      url: "https://docs.pokemontcg.io/",
    },
    {
      name: "Scryfall",
      status: "Live",
      coverage: "Magic: The Gathering printings, collector numbers, images, oracle data, and USD/EUR prices.",
      url: "https://scryfall.com/docs/api",
    },
    {
      name: "TCGCSV",
      status: "Expansion",
      coverage: "TCGplayer category, group, product, and price feeds for broad TCG catalog imports.",
      url: "https://tcgcsv.com/",
    },
    {
      name: "Manual vault",
      status: "Live",
      coverage: "Any trading card a user enters, scans, or corrects by hand remains searchable in their vault.",
      url: "./vault.html",
    },
  ];
  const fallbackCategories = [
    { categoryId: 1, displayName: "Magic: The Gathering", name: "Magic", isScannable: true },
    { categoryId: 2, displayName: "Yu-Gi-Oh!", name: "YuGiOh", isScannable: true },
    { categoryId: 3, displayName: "Pokemon", name: "Pokemon", isScannable: true },
    { categoryId: 13, displayName: "World of Warcraft TCG", name: "WoW", isScannable: true },
    { categoryId: 16, displayName: "Cardfight Vanguard", name: "Cardfight Vanguard", isScannable: true },
    { categoryId: 19, displayName: "Future Card BuddyFight", name: "Future Card BuddyFight", isScannable: true },
    { categoryId: 20, displayName: "Weiss Schwarz", name: "Weiss Schwarz", isScannable: true },
    { categoryId: 24, displayName: "Dragon Ball Super", name: "Dragon Ball Super", isScannable: true },
    { categoryId: 27, displayName: "Flesh and Blood TCG", name: "Flesh and Blood TCG", isScannable: true },
    { categoryId: 63, displayName: "Digimon Card Game", name: "Digimon Card Game", isScannable: true },
    { categoryId: 68, displayName: "One Piece Card Game", name: "One Piece Card Game", isScannable: true },
    { categoryId: 71, displayName: "Disney Lorcana", name: "Lorcana TCG", isScannable: true },
    { categoryId: 73, displayName: "Shadowverse: Evolve", name: "Shadowverse Evolve", isScannable: true },
    { categoryId: 79, displayName: "Star Wars: Unlimited", name: "Star Wars Unlimited", isScannable: false },
    { categoryId: 80, displayName: "Dragon Ball Super: Fusion World", name: "Dragon Ball Super Fusion World", isScannable: false },
    { categoryId: 85, displayName: "Pokemon Japan", name: "Pokemon Japan", isScannable: false },
    { categoryId: 86, displayName: "Gundam Card Game", name: "Gundam Card Game", isScannable: false },
    { categoryId: 89, displayName: "Riftbound: League of Legends Trading Card Game", name: "Riftbound", isScannable: false },
  ];
  let categories = [];

  renderSources();
  renderPriceChartingTokenStatus();
  void loadTcgCategories();

  refreshButton?.addEventListener("click", () => loadTcgCategories());
  filterInput?.addEventListener("input", renderCategories);
  priceChartingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = String(priceChartingInput?.value || "").trim();
    if (!token) {
      if (priceChartingStatus) priceChartingStatus.textContent = "Paste a PriceCharting API token before saving.";
      return;
    }
    localStorage.setItem(priceChartingKey, token);
    if (priceChartingInput) priceChartingInput.value = "";
    renderPriceChartingTokenStatus();
  });
  clearPriceChartingButton?.addEventListener("click", () => {
    localStorage.removeItem(priceChartingKey);
    renderPriceChartingTokenStatus();
  });

  function renderSources() {
    if (!sourceGrid) return;
    sourceGrid.innerHTML = builtInSources.map((source) => `
      <article class="plan-usage-card current-plan">
        <small>${escapeHtml(source.status)}</small>
        <strong>${escapeHtml(source.name)}</strong>
        <span>${escapeHtml(source.coverage)}</span>
        <a class="secondary-button tiny-link" href="${source.url}" target="${source.url.startsWith("http") ? "_blank" : "_self"}" rel="noreferrer">Open source</a>
      </article>
    `).join("");
  }

  function renderPriceChartingTokenStatus() {
    if (!priceChartingStatus) return;
    const token = localStorage.getItem(priceChartingKey);
    priceChartingStatus.textContent = token
      ? "PriceCharting token saved locally. Scanner searches will include PriceCharting product matches."
      : "No PriceCharting token saved yet. Scanner will use Pokemon, Scryfall, Supabase, and manual review until you add one.";
  }

  async function loadTcgCategories() {
    if (!categoryList) return;
    categoryList.innerHTML = `<div class="ai-panel">Loading TCGCSV category coverage...</div>`;
    if (status) status.textContent = "Checking TCGCSV categories...";
    try {
      const response = await fetch("https://tcgcsv.com/tcgplayer/categories");
      if (!response.ok) throw new Error(`TCGCSV returned ${response.status}`);
      const payload = await response.json();
      categories = Array.isArray(payload.results) ? payload.results : Array.isArray(payload) ? payload : [];
      if (status) status.textContent = `${categories.length.toLocaleString()} TCGplayer categories visible through TCGCSV.`;
      renderCategories();
    } catch (error) {
      categories = fallbackCategories;
      if (status) status.textContent = "Showing built-in TCGCSV coverage map. Server import can read the live 89-category feed.";
      renderCategories();
    }
  }

  function renderCategories() {
    if (!categoryList) return;
    const filter = String(filterInput?.value || "").trim().toLowerCase();
    const shown = categories
      .filter((category) => !filter || category.name?.toLowerCase().includes(filter) || String(category.categoryId || "").includes(filter))
      .slice(0, 60);
    if (!shown.length) {
      categoryList.innerHTML = `<div class="empty-state">No categories match that filter.</div>`;
      return;
    }
    categoryList.innerHTML = shown.map((category) => {
      const id = category.categoryId || category.id || "";
      const groupUrl = id ? `https://tcgcsv.com/tcgplayer/${id}/groups` : "https://tcgcsv.com/";
      return `
        <article class="catalog-match-card">
          <div>
            <h3>${escapeHtml(category.name || "Unnamed category")}</h3>
            <p>TCGplayer category ${escapeHtml(id || "unknown")}</p>
            <div class="chip-row">
              <span>${category.isScannable ? "Scanner-supported category" : "Catalog import category"}</span>
              <span>Prices via TCGCSV feeds</span>
            </div>
          </div>
          <a class="secondary-button tiny-link" href="${groupUrl}" target="_blank" rel="noreferrer">Open feed</a>
        </article>
      `;
    }).join("");
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
