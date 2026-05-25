# Deploy the CardCortex Daily Pokémon Sync Function

This function imports Pokémon card catalog data and available TCGPlayer price fields from the Pokémon TCG API into Supabase.

## What it does

- Reads Pokémon cards from `https://api.pokemontcg.io/v2/cards`
- Upserts records into `card_catalog`
- Inserts price observations into `price_snapshots`
- Can run manually or daily through Supabase Cron

## Required Supabase secrets

In Supabase, set these Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CARD_CORTEX_SYNC_SECRET`
- `POKEMON_TCG_API_KEY` optional, but recommended for better API reliability

Never put the service role key in GitHub Pages or browser code.

## Deploy from your computer

Install/login Supabase CLI, then run from the `CardCortex` folder:

```powershell
supabase login
supabase link --project-ref niqmgpgzffwujvacpgzy
supabase secrets set CARD_CORTEX_SYNC_SECRET="make-a-long-random-secret"
supabase secrets set POKEMON_TCG_API_KEY="optional-pokemon-tcg-api-key"
supabase functions deploy sync-pokemon-catalog
```

## Test manually

```powershell
Invoke-WebRequest -Method POST `
  -Uri "https://niqmgpgzffwujvacpgzy.supabase.co/functions/v1/sync-pokemon-catalog" `
  -Headers @{ "x-cardcortex-sync-secret" = "make-a-long-random-secret"; "Content-Type" = "application/json" } `
  -Body '{"maxPages":1,"pageSize":25}'
```

## Schedule daily

After deploy, run `SUPABASE-DAILY-SYNC-CRON.sql` in Supabase SQL Editor, or create a Cron job from the Supabase dashboard.
