# CardCortex Stripe Launch Checklist

Use this for the first revenue version.

## 1. Create products in Stripe

Create these products and prices:

- Collector monthly: $4.99/month, optional 7-day trial
- Collector yearly: $49/year, optional 7-day trial
- Pro monthly: $9.99/month, optional 7-day trial
- Pro yearly: $89/year, optional 7-day trial
- Dealer monthly: $19.99/month, optional 7-day trial
- Dealer yearly: $199/year, optional 7-day trial
- Add-on: 10 AI grading credits, $1.99 one-time
- Add-on: 50 AI grading credits, $7.99 one-time
- Add-on: 200 AI grading credits, $24.99 one-time

## 2. Create public Payment Links

Create one public Payment Link for each product/price above.

Safe to share with Codex:

- Payment Link URLs that start with `https://buy.stripe.com/`

Never share:

- Secret API keys
- Webhook signing secret
- Restricted keys
- Dashboard login codes

## 3. Test in CardCortex

Open:

`upgrade.html`

Paste public Payment Link URLs into the Stripe launch console and click Save test payment links.

## 4. Make it real after checkout

For real paid enforcement, add a secure webhook that listens for Stripe subscription and checkout events, then updates:

- `public.user_entitlements.plan_id`
- `public.user_entitlements.billing_status`
- `public.user_entitlements.stripe_customer_id`
- `public.user_entitlements.stripe_subscription_id`
- monthly limits and credit balances

The client app should only read entitlements. It should never grant itself a paid plan.
