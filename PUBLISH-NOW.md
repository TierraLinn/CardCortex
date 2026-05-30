# CardCortex Publish Now

## Current deploy package

Use this zip for a manual upload deploy:

```text
C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex-Production-Deploy.zip
```

It contains the current production-ready static app files and excludes local secrets, logs, git metadata, and generated zip files.

Use this folder for GitHub web upload or any host that wants loose files:

```text
C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex-GitHub-Upload-Folder
```

## Verified local production routes

The local server returns `200` for:

- `/`
- `/vault`
- `/scanner`
- `/sources`
- `/catalog-sources`
- `/values`
- `/grading`
- `/sell`
- `/assistant`
- `/account`
- `/backend-status`
- `/privacy`
- `/terms`

## Verified Supabase REST tables

The live Supabase REST API returns `200` for:

- `cards`
- `card_catalog`
- `catalog_sources`
- `source_sync_runs`
- `scan_jobs`
- `grade_reports`
- `user_entitlements`
- `usage_counters`
- `billing_events`

You can re-run this from the local project with:

```powershell
npm run verify:publish
npm run verify:live
npm run wait:live
npm run supabase:check
npm run supabase:admin-check
```

If an admin key is needed for future backend work, create `.env.admin.local` from `.env.example`. That file is ignored by git and excluded from the deploy zip.

## Fastest publish path without GitHub write access

Upload `CardCortex-Production-Deploy.zip` to one of:

- Cloudflare Pages: use **Upload assets**
- Netlify Drop: drag the zip or the `CardCortex` folder into the upload area

No build command is required. The app is static.

## GitHub Pages publish blocker

The connected GitHub app can read `TierraLinn/CardCortex`, but it currently has no push/admin permission:

```text
admin: false
push: false
pull: true
```

To let Codex publish directly to GitHub Pages, update the GitHub app installation for `TierraLinn/CardCortex` so it has repository contents write access, or provide a local git/GitHub CLI environment that can push to `main`.

The upload folder includes `.github/workflows/pages.yml`. After the repository is updated and GitHub Pages is configured for GitHub Actions, pushes to `main` can deploy automatically.

## Token-based GitHub publish helper

If a GitHub fine-grained token with `TierraLinn/CardCortex` **Contents: Read and write** permission is available locally, set it as an environment variable and run:

```powershell
$env:GITHUB_TOKEN="paste_token_here"
npm run github:check
npm run github:publish
```

The fastest guided version is:

```powershell
npm run github:publish:prompt
```

Or double-click this file:

```text
C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex\CLICK-TO-PUBLISH-CARDCORTEX.bat
```

That command prompts for the token securely, runs syntax checks, verifies Supabase, publishes to GitHub, waits for GitHub Pages, and re-checks the live site with a hard live-current gate. The publish helper removes stale remote files too, so GitHub Pages matches the prepared production package instead of keeping old leftovers.

Do not commit or upload the token. The helper excludes `.env.admin.local`, logs, zips, `node_modules`, and local deploy metadata.
