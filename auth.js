const api = window.CardCortexSupabase;
const authForm = document.querySelector("#authForm");
const signUpButton = document.querySelector("#signUpButton");
const signOutButton = document.querySelector("#signOutButton");
const authStatus = document.querySelector("#authStatus");
const sessionStatus = document.querySelector("#sessionStatus");

async function refreshSession() {
  if (!api) {
    sessionStatus.textContent = "Supabase is not configured yet.";
    return;
  }
  const user = await api.getUser();
  sessionStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in.";
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
