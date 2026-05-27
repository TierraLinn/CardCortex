const api = window.CardCortexSupabase;
const authForm = document.querySelector("#authForm");
const signUpButton = document.querySelector("#signUpButton");
const signOutButton = document.querySelector("#signOutButton");
const authStatus = document.querySelector("#authStatus");
const sessionStatus = document.querySelector("#sessionStatus");
const accountPlanSummary = document.querySelector("#accountPlanSummary");
const billing = window.CardCortexBilling || null;

async function refreshSession() {
  if (!api) {
    sessionStatus.textContent = "Supabase is not configured yet.";
    return;
  }
  const user = await api.getUser();
  sessionStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in.";
  await renderAccountPlan(user);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  authStatus.textContent = "Signing in...";
  const { error } = await api.signIn(email, password);
  authStatus.textContent = error ? error.message : "Signed in. Your vault can now save real cards.";
  await refreshSession();
});

signUpButton.addEventListener("click", async () => {
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  authStatus.textContent = "Creating account...";
  const { error } = await api.signUp(email, password);
  authStatus.textContent = error ? error.message : "Account created. Check email confirmation if Supabase requires it.";
  await refreshSession();
});

signOutButton.addEventListener("click", async () => {
  await api.signOut();
  authStatus.textContent = "Signed out.";
  await refreshSession();
});

refreshSession();

async function renderAccountPlan(user) {
  if (!accountPlanSummary || !billing) return;
  let entitlement = null;
  if (user && api?.getEntitlement) {
    try {
      entitlement = await api.getEntitlement();
      if (entitlement?.plan_id && ["active", "trialing", "paid"].includes(String(entitlement.billing_status || "").toLowerCase())) {
        billing.setActivePlan(entitlement.plan_id);
      }
    } catch (error) {
      console.warn("Could not load entitlement:", error);
    }
  }
  const summary = billing.getUsageSummary(0);
  const plan = entitlement?.plan_id ? billing.getPlan(entitlement.plan_id) : summary.plan;
  const status = user ? "Signed in and ready for paid entitlement sync." : "Sign in before paid entitlements can be connected to your vault.";
  const billingStatus = entitlement?.billing_status ? `Billing status: ${entitlement.billing_status}` : "Billing status: local preview";
  const credits = Number(entitlement?.grade_credit_balance || 0);
  accountPlanSummary.innerHTML = `
    <div class="account-plan-badge">
      <span>${plan.badge}</span>
      <strong>${plan.name}</strong>
    </div>
    <p>${status}</p>
    <p>${billingStatus}${credits ? ` • ${credits} grading credits available` : ""}</p>
    <div class="chip-row">
      <span>${billing.formatLimit(plan.cardLimit, "cards")}</span>
      <span>${billing.formatLimit(plan.gradeLimit, "AI grades/month")}</span>
      <span>${billing.formatLimit(plan.scanLimit, "scans/month")}</span>
    </div>
  `;
}
