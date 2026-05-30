(function initCardCortexSupabase() {
  const config = window.CardCortexSupabaseConfig;
  if (!window.supabase || !config?.url || !config?.publishableKey) {
    window.CardCortexSupabase = null;
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.CardCortexSupabase = {
    client,
    async getUser() {
      const { data } = await client.auth.getUser();
      return data.user || null;
    },
    authRedirectUrl() {
      return `${window.location.origin}${window.location.pathname.includes("auth.html") ? window.location.pathname : "/auth.html"}`;
    },
    async signUp(email, password) {
      return client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: this.authRedirectUrl() },
      });
    },
    async resendConfirmation(email) {
      return client.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: this.authRedirectUrl() },
      });
    },
    async signIn(email, password) {
      return client.auth.signInWithPassword({ email, password });
    },
    async signOut() {
      return client.auth.signOut();
    },
    async listCards() {
      const { data, error } = await client
        .from("cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async createCard(card) {
      const user = await this.getUser();
      if (!user) throw new Error("Sign in before saving cards.");
      const { data, error } = await client
        .from("cards")
        .insert({ ...card, user_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async updateCard(id, updates) {
      const { data, error } = await client
        .from("cards")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async deleteCard(id) {
      const { error } = await client
        .from("cards")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    async uploadCardImage(file) {
      const user = await this.getUser();
      if (!user) throw new Error("Sign in before uploading card images.");
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error } = await client.storage.from("card-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = client.storage.from("card-images").getPublicUrl(path);
      return data.publicUrl;
    },
    async searchCatalog(query) {
      const clean = String(query || "").trim();
      if (!clean) return [];
      const { data, error } = await client
        .from("card_catalog")
        .select("*")
        .or(`name.ilike.%${clean}%,set_name.ilike.%${clean}%,category.ilike.%${clean}%,game_or_sport.ilike.%${clean}%`)
        .order("last_synced_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    async latestPrices(catalogCardId) {
      const { data, error } = await client
        .from("price_snapshots")
        .select("*")
        .eq("catalog_card_id", catalogCardId)
        .order("observed_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    async getEntitlement() {
      const user = await this.getUser();
      if (!user) return null;
      const { data, error } = await client
        .from("user_entitlements")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    async getUsage(month = new Date().toISOString().slice(0, 7)) {
      const user = await this.getUser();
      if (!user) return null;
      const { data, error } = await client
        .from("usage_counters")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data || { user_id: user.id, month, scans_used: 0, grades_used: 0, sell_kits_used: 0 };
    },
    async recordUsage(kind, amount = 1, month = new Date().toISOString().slice(0, 7)) {
      const user = await this.getUser();
      if (!user) throw new Error("Sign in before recording usage.");
      const allowed = new Set(["scans", "grades", "sellKits"]);
      if (!allowed.has(kind)) throw new Error("Unknown usage counter.");
      const column = kind === "sellKits" ? "sell_kits_used" : `${kind}_used`;
      const current = await this.getUsage(month);
      const next = {
        user_id: user.id,
        month,
        scans_used: Number(current?.scans_used || 0),
        grades_used: Number(current?.grades_used || 0),
        sell_kits_used: Number(current?.sell_kits_used || 0),
        updated_at: new Date().toISOString(),
      };
      next[column] = Number(next[column] || 0) + Number(amount || 1);
      const { data, error } = await client
        .from("usage_counters")
        .upsert(next, { onConflict: "user_id,month" })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  };
})();
