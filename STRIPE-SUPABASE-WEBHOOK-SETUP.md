# CardCortex Stripe + Supabase Paid Access Setup

This turns Stripe checkout into real CardCortex entitlements.

## What is already in the files

- `billing.js` now adds a Stripe `client_reference_id` to checkout.
- `upgrade.html` now loads Supabase before checkout.
- `supabase/functions/stripe-webhook/index.ts` receives Stripe webhook events.
- `SUPABASE-BILLING-SCHEMA.sql` creates `user_entitlements` and `billing_events`.

## Step 1: Run the billing database SQL

1. Open Supabase.
2. Open the `CardCortex` project.
3. Click `SQL Editor` in the left sidebar.
4. Click `New query`.
5. Open this local file:

   `C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex\SUPABASE-BILLING-SCHEMA.sql`

6. Copy all of it.
7. Paste it into the Supabase SQL Editor.
8. Click `Run`.

You should now have:

- `user_entitlements`
- `billing_events`

## Step 2: Deploy the Stripe webhook Edge Function

The function file is here:

`C:\Users\tierr\Documents\Codex\2026-05-03\i-want-to-create-a-factory\CardCortex\supabase\functions\stripe-webhook\index.ts`

### Dashboard path

1. In Supabase, click `Edge Functions`.
2. Click `Create a new function`.
3. Name it:

   `stripe-webhook`

4. Open the code editor for the function.
5. Replace the sample code with the full contents of:

   `supabase/functions/stripe-webhook/index.ts`

6. Deploy the function.

### CLI path, if you use Supabase CLI

From the `CardCortex` folder:

```powershell
supabase link --project-ref niqmgpgzffwujvacpgzy
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Step 3: Add Supabase Edge Function secrets

In Supabase:

1. Click `Project Settings`.
2. Click `Edge Functions`.
3. Open `Secrets`.
4. Confirm or add these secrets:

```text
SUPABASE_URL=https://niqmgpgzffwujvacpgzy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your Supabase service_role key
STRIPE_WEBHOOK_SECRET=you will paste this after Step 4
```

Never paste the service role key into GitHub Pages, browser files, chat, or frontend code.

## Step 4: Create the Stripe webhook endpoint

In Stripe:

1. Open Stripe Dashboard.
2. Make sure `Test mode` is ON while testing.
3. Click `Developers`.
4. Click `Webhooks`.
5. Click `Add endpoint`.
6. Paste this endpoint URL:

```text
https://niqmgpgzffwujvacpgzy.supabase.co/functions/v1/stripe-webhook
```

7. Select these events:

```text
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

8. Click `Add endpoint`.
9. Open the new webhook endpoint.
10. Click `Reveal signing secret`.
11. Copy the value that starts with `whsec_`.
12. Go back to Supabase `Edge Functions` secrets.
13. Set:

```text
STRIPE_WEBHOOK_SECRET=whsec_your_value_here
```

## Step 5: Set each Stripe Payment Link redirect

For each Payment Link in Stripe:

1. Open `Payment Links`.
2. Click the link.
3. Click `Edit`.
4. Find `After payment`.
5. Set the success redirect URL to:

```text
https://tierralinn.github.io/CardCortex/auth.html?checkout=success
```

6. Save.

## Step 6: Test the whole paid-access loop

1. Open:

   `https://tierralinn.github.io/CardCortex/auth.html`

2. Sign in or create a CardCortex account.
3. Open:

   `https://tierralinn.github.io/CardCortex/upgrade.html`

4. Click one paid plan or one grading credit add-on.
5. Use Stripe test card:

```text
4242 4242 4242 4242
Any future date
Any CVC
Any ZIP
```

6. Finish checkout.
7. Open Supabase `Table Editor`.
8. Open `user_entitlements`.
9. Confirm your user row changed:

- Paid subscription should set `plan_id` to `collector`, `pro`, or `dealer`.
- Add-on checkout should increase `grade_credit_balance`.

## If it does not update

Check these in order:

1. Stripe `Developers` -> `Webhooks` -> your endpoint -> recent delivery status.
2. Supabase `Edge Functions` -> `stripe-webhook` -> `Logs`.
3. Confirm you signed in before checkout.
4. Confirm the checkout URL includes `client_reference_id`.
5. Confirm `STRIPE_WEBHOOK_SECRET` starts with `whsec_`.
6. Confirm `SUPABASE_SERVICE_ROLE_KEY` is the secret service role key, not the publishable key.
