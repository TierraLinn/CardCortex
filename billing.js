(function () {
  const PLAN_KEY = "cardcortex-active-plan";
  const BILLING_INTERVAL_KEY = "cardcortex-billing-interval";
  const USAGE_KEY = "cardcortex-monthly-usage";
  const STRIPE_LINK_KEY = "cardcortex-stripe-payment-links";
  const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
  let remoteEntitlement = null;
  let remoteUsage = null;

  const CHECKOUT_LINKS = {
    collector: {
      monthly: "https://buy.stripe.com/7sY9AS0uG2Haa2W3jp9oc00",
      yearly: "https://buy.stripe.com/7sYfZg6T4epSgrkaLR9oc01",
    },
    pro: {
      monthly: "https://buy.stripe.com/aFa4gy5P0dlOcb49HN9oc02",
      yearly: "https://buy.stripe.com/bJe00idhs81ugrk9HN9oc03",
    },
    dealer: {
      monthly: "https://buy.stripe.com/3cIcN4gtE81ucb4f279oc04",
      yearly: "https://buy.stripe.com/eVq7sK0uG81ufng5rx9oc05",
    },
    grade10: { once: "https://buy.stripe.com/9B64gy3GS5Tma2Wg6b9oc06" },
    grade50: { once: "https://buy.stripe.com/5kQ28q0uGdlOcb41bh9oc07" },
    grade200: { once: "https://buy.stripe.com/aFadR8fpA0z26QKf279oc08" },
  };

  const plans = [
    {
      id: "free",
      name: "Free Vault",
      badge: "Start here",
      audience: "New collectors testing the vault",
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialDays: 0,
      cardLimit: 75,
      scanLimit: 20,
      gradeLimit: 5,
      sellKits: 3,
      reports: "Preview reports",
      catalogRefresh: "Daily public catalog signals",
      features: [
        "75 stored cards",
        "20 scanner matches per month",
        "5 AI pre-grade runs per month",
        "Basic value lookup and vault export",
      ],
    },
    {
      id: "collector",
      name: "Collector",
      badge: "Most affordable",
      audience: "Personal collections and serious hobbyists",
      monthlyPrice: 4.99,
      yearlyPrice: 49,
      trialDays: 7,
      cardLimit: 1500,
      scanLimit: 200,
      gradeLimit: 30,
      sellKits: 25,
      reports: "Full collector reports",
      catalogRefresh: "Daily catalog and value refresh",
      features: [
        "1,500 stored cards",
        "30 AI pre-grade runs per month",
        "Insurance, seller, and grading reports",
        "Marketplace listing kits and CSV exports",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      badge: "Best value",
      audience: "Large collections and active sellers",
      monthlyPrice: 9.99,
      yearlyPrice: 89,
      trialDays: 7,
      cardLimit: 15000,
      scanLimit: 1000,
      gradeLimit: 150,
      sellKits: 150,
      reports: "Advanced portfolio reports",
      catalogRefresh: "Daily catalog, value, and opportunity refresh",
      features: [
        "15,000 stored cards",
        "150 AI pre-grade runs per month",
        "Advanced sell-route and risk reports",
        "Priority collection cleanup and grading queues",
      ],
    },
    {
      id: "dealer",
      name: "Dealer",
      badge: "Highest ceiling",
      audience: "Shops, breakers, and high-volume sellers",
      monthlyPrice: 19.99,
      yearlyPrice: 199,
      trialDays: 7,
      cardLimit: Infinity,
      scanLimit: 4000,
      gradeLimit: 500,
      sellKits: 800,
      reports: "Dealer command reports",
      catalogRefresh: "Daily high-volume catalog and pricing refresh",
      features: [
        "Unlimited stored cards",
        "500 AI pre-grade runs per month",
        "High-volume seller launch kits",
        "Dealer inventory, audit, and portfolio workflows",
      ],
    },
  ];

  const addOns = [
    { id: "grade10", name: "10 AI grading credits", price: 1.99, credits: 10, checkout: CHECKOUT_LINKS.grade10 },
    { id: "grade50", name: "50 AI grading credits", price: 7.99, credits: 50, checkout: CHECKOUT_LINKS.grade50 },
    { id: "grade200", name: "200 AI grading credits", price: 24.99, credits: 200, checkout: CHECKOUT_LINKS.grade200 },
  ];

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in embedded browsers.
    }
  }

  function getPlan(planId) {
    const plan = plans.find((item) => item.id === planId) || plans[0];
    if (remoteEntitlement && remoteEntitlement.plan_id === plan.id) {
      return {
        ...plan,
        cardLimit: normalizeLimit(remoteEntitlement.card_limit, plan.cardLimit),
        scanLimit: normalizeLimit(remoteEntitlement.scan_limit, plan.scanLimit),
        gradeLimit: normalizeLimit(remoteEntitlement.grade_limit, plan.gradeLimit) + Number(remoteEntitlement.grade_credit_balance || 0),
        sellKits: normalizeLimit(remoteEntitlement.sell_kit_limit, plan.sellKits),
      };
    }
    return plan;
  }

  function getActivePlanId() {
    if (remoteEntitlement?.plan_id && ["active", "trialing", "paid"].includes(String(remoteEntitlement.billing_status || "").toLowerCase())) {
      return remoteEntitlement.plan_id;
    }
    const stored = window.localStorage?.getItem(PLAN_KEY);
    return plans.some((plan) => plan.id === stored) ? stored : "free";
  }

  function getActivePlan() {
    return getPlan(getActivePlanId());
  }

  function setActivePlan(planId) {
    const plan = getPlan(planId);
    try {
      window.localStorage?.setItem(PLAN_KEY, plan.id);
    } catch {
      // Ignore storage failures.
    }
    return plan;
  }

  function getBillingInterval() {
    const interval = window.localStorage?.getItem(BILLING_INTERVAL_KEY);
    return interval === "yearly" ? "yearly" : "monthly";
  }

  function setBillingInterval(interval) {
    const safe = interval === "yearly" ? "yearly" : "monthly";
    try {
      window.localStorage?.setItem(BILLING_INTERVAL_KEY, safe);
    } catch {
      // Ignore storage failures.
    }
    return safe;
  }

  function getStripeOverrides() {
    return readJson(STRIPE_LINK_KEY, {});
  }

  function setStripeOverrides(overrides) {
    writeJson(STRIPE_LINK_KEY, overrides || {});
  }

  function stripeKey(planId, interval) {
    return `${planId}:${interval}`;
  }

  function getCheckoutUrl(planId, interval = getBillingInterval()) {
    const overrides = getStripeOverrides();
    const override = overrides[stripeKey(planId, interval)];
    if (override) return override;
    const plan = getPlan(planId);
    return plan.id === "free" ? "" : CHECKOUT_LINKS[plan.id]?.[interval] || "";
  }

  function getAddOnCheckoutUrl(addOnId) {
    const overrides = getStripeOverrides();
    const override = overrides[stripeKey(addOnId, "once")];
    if (override) return override;
    return CHECKOUT_LINKS[addOnId]?.once || "";
  }

  function withCheckoutReference(url, reference, email = "") {
    if (!url || !reference) return url || "";
    try {
      const checkoutUrl = new URL(url, window.location.href);
      checkoutUrl.searchParams.set("client_reference_id", reference);
      if (email) checkoutUrl.searchParams.set("prefilled_email", email);
      return checkoutUrl.toString();
    } catch {
      return url;
    }
  }

  function priceFor(plan, interval = getBillingInterval()) {
    if (plan.id === "free") return "$0";
    const amount = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    const suffix = interval === "yearly" ? "/year" : "/month";
    return `$${amount}${suffix}`;
  }

  function formatLimit(value, noun) {
    if (value === Infinity) return `Unlimited ${noun}`;
    return `${Number(value).toLocaleString()} ${noun}`;
  }

  function getUsageStore() {
    if (remoteUsage?.month === CURRENT_MONTH) {
      return {
        month: CURRENT_MONTH,
        scans: Number(remoteUsage.scans_used || 0),
        grades: Number(remoteUsage.grades_used || 0),
        sellKits: Number(remoteUsage.sell_kits_used || 0),
      };
    }
    const usage = readJson(USAGE_KEY, {});
    if (usage.month !== CURRENT_MONTH) return { month: CURRENT_MONTH, scans: 0, grades: 0, sellKits: 0 };
    return { month: CURRENT_MONTH, scans: 0, grades: 0, sellKits: 0, ...usage };
  }

  function recordUsage(kind, amount = 1) {
    const usage = getUsageStore();
    usage[kind] = Number(usage[kind] || 0) + amount;
    writeJson(USAGE_KEY, usage);
    return usage;
  }

  function resetUsage() {
    const usage = { month: CURRENT_MONTH, scans: 0, grades: 0, sellKits: 0 };
    writeJson(USAGE_KEY, usage);
    return usage;
  }

  function setRemoteEntitlement(entitlement) {
    remoteEntitlement = entitlement || null;
    if (remoteEntitlement?.plan_id) setActivePlan(remoteEntitlement.plan_id);
  }

  function setRemoteUsage(usage) {
    remoteUsage = usage || null;
  }

  function normalizeLimit(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return fallback;
    return number >= 2147483647 ? Infinity : number;
  }

  function remaining(limit, used) {
    if (limit === Infinity) return Infinity;
    return Math.max(0, Number(limit || 0) - Number(used || 0));
  }

  function percentUsed(limit, used) {
    if (limit === Infinity) return 14;
    return Math.max(3, Math.min(100, (Number(used || 0) / Math.max(1, Number(limit || 0))) * 100));
  }

  function getUsageSummary(cardCount = 0) {
    const plan = getActivePlan();
    const usage = getUsageStore();
    return {
      plan,
      month: usage.month,
      cards: {
        used: Number(cardCount || 0),
        limit: plan.cardLimit,
        remaining: remaining(plan.cardLimit, cardCount),
        percent: percentUsed(plan.cardLimit, cardCount),
      },
      scans: {
        used: Number(usage.scans || 0),
        limit: plan.scanLimit,
        remaining: remaining(plan.scanLimit, usage.scans),
        percent: percentUsed(plan.scanLimit, usage.scans),
      },
      grades: {
        used: Number(usage.grades || 0),
        limit: plan.gradeLimit,
        remaining: remaining(plan.gradeLimit, usage.grades),
        percent: percentUsed(plan.gradeLimit, usage.grades),
      },
      sellKits: {
        used: Number(usage.sellKits || 0),
        limit: plan.sellKits,
        remaining: remaining(plan.sellKits, usage.sellKits),
        percent: percentUsed(plan.sellKits, usage.sellKits),
      },
    };
  }

  function canUse(kind, cardCount = 0) {
    const summary = getUsageSummary(cardCount);
    if (kind === "cards") return summary.cards.remaining > 0 || summary.cards.limit === Infinity;
    if (kind === "scans") return summary.scans.remaining > 0 || summary.scans.limit === Infinity;
    if (kind === "grades") return summary.grades.remaining > 0 || summary.grades.limit === Infinity;
    if (kind === "sellKits") return summary.sellKits.remaining > 0 || summary.sellKits.limit === Infinity;
    return true;
  }

  window.CardCortexBilling = {
    plans,
    addOns,
    getPlan,
    getActivePlan,
    getActivePlanId,
    setActivePlan,
    getBillingInterval,
    setBillingInterval,
    getCheckoutUrl,
    getAddOnCheckoutUrl,
    withCheckoutReference,
    getStripeOverrides,
    setStripeOverrides,
    stripeKey,
    priceFor,
    formatLimit,
    getUsageSummary,
    canUse,
    recordUsage,
    resetUsage,
    setRemoteEntitlement,
    setRemoteUsage,
  };
})();
