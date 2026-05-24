# CardCortex Free Launch Options

This app can be built and launched without paying by using static hosting.

## Recommended: Cloudflare Pages

Cloudflare Pages is the best free option for CardCortex right now because it supports static web apps, custom routes, HTTPS, fast global hosting, and GitHub-based redeploys.

### Cloudflare Pages steps

1. Go to `https://pages.cloudflare.com/`.
2. Sign in or create a free Cloudflare account.
3. Choose **Create a project**.
4. Choose **Upload assets** if available, or connect a GitHub repository.
5. Upload this folder:

   `C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex`

   Or upload this zip:

   `C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex-Free-Deploy.zip`

6. Use these settings:

   - Framework preset: `None`
   - Build command: leave blank
   - Output directory: `/`

7. Deploy and copy the public URL.

## Alternative: GitHub Pages

GitHub Pages is also free for a static version of the app.

### GitHub Pages steps

1. Create a free GitHub repository named `cardcortex`.
2. Upload everything inside the `CardCortex` folder.
3. Go to repository **Settings**.
4. Open **Pages**.
5. Source: **Deploy from a branch**.
6. Branch: `main`.
7. Folder: `/root`.
8. Save.

GitHub will publish a URL like:

`https://YOUR-GITHUB-NAME.github.io/cardcortex/`

## What stays free

- Static landing page
- Vault UI
- Scanner demo UI
- AI grading demo UI
- Value dashboard demo UI
- Marketplace route planner UI
- AI advisor demo UI

## What may need a backend later

- User accounts
- Real card photo storage
- Live AI image recognition
- Live marketplace pricing APIs
- Selling/listing integrations
- Paid subscriptions
