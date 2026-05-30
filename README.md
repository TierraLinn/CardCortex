# CardCortex

CardCortex is an AI-powered trading card vault web app. It stores card collections, shows portfolio value, supports camera/upload scanning workflows, compares value signals, creates digital condition reports, prepares marketplace selling routes, and connects paid plans through Stripe and Supabase.

Live app:

```text
https://tierralinn.github.io/CardCortex/
```

## Run locally

```powershell
cd C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex
.\run-cardcortex.ps1
```

Open:

```text
http://localhost:4192/index.html
```

## Pages

- `index.html` - animated landing page
- `vault.html` - collection vault
- `backend-status.html` - production backend setup and Supabase table checks
- `scanner.html` - camera/upload scanner with OCR, Supabase catalog, Pokemon, Scryfall, and optional PriceCharting lookup
- `catalog-sources.html` - multi-source card catalog coverage map
- `pricing.html` - value intelligence
- `grading.html` - AI pre-grading lab
- `marketplace.html` - selling route planner
- `assistant.html` - collection advisor workspace
- `upgrade.html` - Stripe-powered plans and grading credits
- `auth.html` - Supabase account access
- `privacy.html` - launch privacy draft
- `terms.html` - launch terms draft

## Deploy

See `DEPLOYMENT-LAUNCH.md`.

## Real intelligence engine

Run these SQL files in Supabase:

1. `SUPABASE-SCHEMA.sql`
2. `SUPABASE-INTELLIGENCE-SCHEMA.sql`

The second file adds catalog, source registry, price snapshot, scan job, source sync run, and detailed grading report tables. Daily automatic updates require Supabase Cron plus Edge Functions or another backend scheduler; GitHub Pages alone cannot run daily import jobs.

The first sync function is in `supabase/functions/sync-pokemon-catalog`. Deployment instructions are in `SUPABASE-EDGE-FUNCTION-DEPLOY.md`.

## Catalog coverage

CardCortex is designed as a multi-source catalog instead of a single pretend "all cards" feed. Current live scanner sources include Pokemon TCG API, Scryfall, and an optional PriceCharting connector when the user adds a paid API token on `catalog-sources.html`. TCGCSV/TCGplayer category feeds are tracked as the broad expansion route for more trading card games. User-corrected manual vault entries keep unsupported cards usable until a connector is added.
