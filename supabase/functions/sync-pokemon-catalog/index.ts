import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PokemonCard = {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  images?: { small?: string; large?: string };
  set?: { name?: string; releaseDate?: string };
  tcgplayer?: {
    url?: string;
    prices?: Record<string, Record<string, number>>;
  };
};

type SyncSummary = {
  pagesRead: number;
  cardsUpserted: number;
  pricesInserted: number;
  errors: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cardcortex-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  const payload = await safeJson(request);
  const configuredSecret = (Deno.env.get("CARD_CORTEX_SYNC_SECRET") || "").trim();
  if (configuredSecret) {
    const providedSecret = (
      request.headers.get("x-cardcortex-sync-secret") ||
      request.headers.get("X-CardCortex-Sync-Secret") ||
      payload.syncSecret ||
      ""
    ).trim();
    if (providedSecret !== configuredSecret) {
      return json({
        error: "Unauthorized sync request",
        hint: "Send x-cardcortex-sync-secret header or syncSecret in the JSON body.",
        receivedSecret: providedSecret ? "present-but-not-matching" : "missing",
      }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const maxPages = clamp(Number(payload.maxPages || 2), 1, 20);
  const pageSize = clamp(Number(payload.pageSize || 100), 1, 250);
  const query = String(payload.query || "").trim();
  const apiKey = Deno.env.get("POKEMON_TCG_API_KEY") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const summary: SyncSummary = { pagesRead: 0, cardsUpserted: 0, pricesInserted: 0, errors: [] };

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL("https://api.pokemontcg.io/v2/cards");
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("orderBy", "-set.releaseDate");
    if (query) url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: apiKey ? { "X-Api-Key": apiKey } : {},
    });

    if (!response.ok) {
      summary.errors.push(`Pokemon TCG API page ${page} returned ${response.status}`);
      break;
    }

    const body = await response.json();
    const pokemonCards = (body.data || []) as PokemonCard[];
    if (!pokemonCards.length) break;

    summary.pagesRead += 1;

    for (const card of pokemonCards) {
      try {
        const catalogRecord = {
          source: "pokemon_tcg_api",
          source_card_id: card.id,
          name: card.name,
          category: "Pokemon",
          game_or_sport: "Pokemon TCG",
          set_name: card.set?.name || "",
          card_number: card.number || "",
          rarity: card.rarity || "",
          release_date: card.set?.releaseDate || null,
          image_url: card.images?.large || card.images?.small || "",
          source_url: card.tcgplayer?.url || "",
          raw_payload: card,
          last_synced_at: new Date().toISOString(),
        };

        const { data: upserted, error: upsertError } = await supabase
          .from("card_catalog")
          .upsert(catalogRecord, { onConflict: "source,source_card_id" })
          .select("id")
          .single();

        if (upsertError) throw upsertError;
        summary.cardsUpserted += 1;

        const priceRows = buildPriceRows(upserted.id, card);
        if (priceRows.length) {
          const { error: priceError } = await supabase.from("price_snapshots").insert(priceRows);
          if (priceError) throw priceError;
          summary.pricesInserted += priceRows.length;
        }
      } catch (error) {
        summary.errors.push(`${card.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return json({ ok: summary.errors.length === 0, summary });
});

function buildPriceRows(catalogCardId: string, card: PokemonCard) {
  const prices = card.tcgplayer?.prices || {};
  const rows = [];
  for (const [variant, values] of Object.entries(prices)) {
    for (const [priceLabel, price] of Object.entries(values || {})) {
      if (typeof price !== "number") continue;
      rows.push({
        catalog_card_id: catalogCardId,
        source: "tcgplayer_via_pokemon_tcg_api",
        variant,
        price_label: priceLabel,
        currency: "USD",
        price,
        source_url: card.tcgplayer?.url || "",
        observed_at: new Date().toISOString(),
        raw_payload: { pokemon_tcg_card_id: card.id, variant, priceLabel, price },
      });
    }
  }
  return rows;
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
