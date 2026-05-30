# CardCortex Deployment and Launch Plan

## Current launch status

CardCortex is ready to publish as a static multi-user web app backed by Supabase Auth, Supabase database rows, Supabase Storage, Stripe Payment Links, and a Supabase Stripe webhook.

Scanner, pricing, AI grading, and assistant flows are decision-support tools. Public copy should not claim live marketplace sale guarantees, official PSA/BGS/CGC grading, or official marketplace posting until those partner APIs are approved and tested.

## Free public deployment options

The recommended free path is now Cloudflare Pages or GitHub Pages. See `CLOUDFLARE-GITHUB-FREE-LAUNCH.md`.

## Fastest public deployment

Use Netlify Drop for the fastest no-cost public preview:

1. Open `https://app.netlify.com/drop`.
2. Drag this folder into the upload area:

   `C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex`

3. Netlify will give a public URL.
4. Open the URL and test these pages:

   - `/`
   - `/vault`
   - `/scanner`
   - `/sources`
   - `/values`
   - `/grading`
   - `/sell`
   - `/assistant`
   - `/account`
   - `/backend-status`
   - `/privacy.html`
   - `/terms.html`

## Better launch deployment

Use GitHub plus Vercel or Netlify for a cleaner launch:

1. Create a GitHub repository named `cardcortex`.
2. Upload the `CardCortex` folder contents.
3. Connect the repo to Vercel or Netlify.
4. Use the project root as the publish directory.
5. Add a custom domain when ready.

## Before public announcement

- Confirm OCR scanner copy remains clear about AI-assisted matches and manual review.
- Test real account creation with the deployed site URL in Supabase Auth redirects.
- Add a support email.
- Add screenshots or a short product walkthrough video.
- Decide whether the first public version is a landing beta, closed alpha, or live usable app.
- Confirm marketplace/API permission requirements before connecting eBay, TCGPlayer, Cardmarket, or other pricing sources.
- Confirm legal language with a qualified professional before accepting payments, user uploads, official grading claims, or seller payouts.

## Production backend roadmap

1. User accounts and collection storage.
2. Image upload storage for front/back card photos.
3. OCR-assisted card identification with live source matching.
4. Price aggregation from approved APIs and sold-comps sources.
5. AI condition pre-grade report with confidence scoring.
6. Marketplace listing generator.
7. Exportable collection reports for insurance, sale lots, and inventory.
8. Payment/subscription layer if offering paid plans.
