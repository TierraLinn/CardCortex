# CardCortex Deployment and Launch Plan

## Current launch status

CardCortex is ready to publish as a static prototype. It includes the landing page, vault, scanner demo, valuation dashboard, AI grading demo, marketplace route planner, AI advisor page, privacy page, and terms page.

The current scanner, pricing, AI grading, and assistant flows are demo/simulated. Public copy should not claim live marketplace pricing, official card grading, or real AI certification until those backends are connected and tested.

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
   - `/values`
   - `/grading`
   - `/sell`
   - `/assistant`
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

- Replace simulated scanner copy with a clear beta label.
- Add real account creation or waitlist capture.
- Add a support email.
- Add screenshots or a short demo video.
- Decide whether the first public version is a landing beta, closed alpha, or live usable app.
- Confirm marketplace/API permission requirements before connecting eBay, TCGPlayer, Cardmarket, or other pricing sources.
- Confirm legal language with a qualified professional before accepting payments, user uploads, official grading claims, or seller payouts.

## Production backend roadmap

1. User accounts and collection storage.
2. Image upload storage for front/back card photos.
3. Vision AI card identification.
4. Price aggregation from approved APIs and sold-comps sources.
5. AI condition pre-grade report with confidence scoring.
6. Marketplace listing generator.
7. Exportable collection reports for insurance, sale lots, and inventory.
8. Payment/subscription layer if offering paid plans.
