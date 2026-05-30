# CardCortex Launch Status

Final public URL:

```text
https://tierralinn.github.io/CardCortex/
```

## Current Launch Checks

- Public GitHub Pages is live but currently behind the local source updates; republish is required for the latest Sources, PriceCharting, and backend-status changes.
- Local source routes use cache versions `cortex8`, `production8`, `coverage3`, and service worker `cardcortex-shell-v36-backend-config`.
- Internal page links and local assets resolve.
- JavaScript syntax checks pass for `data.js`, `billing.js`, `supabase-client.js`, `auth.js`, `sw.js`, `app.js`, and `static-server.cjs`.
- Stripe live payment links are wired in `billing.js`.
- Supabase Stripe webhook endpoint is reachable and correctly rejects unsigned test requests.
- Signed-in users now see only their own Supabase vault rows; sample cards remain a signed-out preview only.
- Monthly usage counters can persist per user in Supabase through `usage_counters` instead of only browser storage.
- Catalog source registry and source sync run tables are live in Supabase REST and visible to the backend checker.
- Scanner matching now uses OCR text, Supabase catalog search, Pokemon TCG API, Scryfall, and an optional PriceCharting token connector.
- The requested visual system is implemented: cortex/universe background, synapse motion layer, floating vault-card constellation, spacewalk title bounce, brighter color system, and plasma/prism brand mark.

## Honest Production Notes

- CardCortex is launchable as a web app through GitHub Pages plus Supabase and Stripe.
- Digital grading is an AI-assisted condition estimate and certificate workflow, not an official PSA/BGS/CGC grade.
- Marketplace tools prepare seller copy and route planning; direct posting to eBay, TCGplayer, and other marketplaces would require each marketplace's seller API approval.
- Catalog/value coverage can keep expanding through daily Supabase sync jobs. Current automated sync work started with Pokemon catalog data and app-side fallback intelligence.
