# CardCortex

CardCortex is an AI trading card vault prototype. It stores card collections, shows category-level portfolio value, simulates camera scanning, compares value signals, previews AI condition grading, and prepares marketplace selling routes.

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
- `scanner.html` - camera/upload scanner demo
- `pricing.html` - value intelligence
- `grading.html` - AI pre-grading lab
- `marketplace.html` - selling route planner
- `assistant.html` - AI advisor demo
- `privacy.html` - launch privacy draft
- `terms.html` - launch terms draft

## Deploy

See `DEPLOYMENT-LAUNCH.md`.

## Real intelligence engine

Run these SQL files in Supabase:

1. `SUPABASE-SCHEMA.sql`
2. `SUPABASE-INTELLIGENCE-SCHEMA.sql`

The second file adds catalog, price snapshot, scan job, and detailed grading report tables. Daily automatic updates require Supabase Cron plus Edge Functions or another backend scheduler; GitHub Pages alone cannot run daily import jobs.

The first sync function is in `supabase/functions/sync-pokemon-catalog`. Deployment instructions are in `SUPABASE-EDGE-FUNCTION-DEPLOY.md`.
