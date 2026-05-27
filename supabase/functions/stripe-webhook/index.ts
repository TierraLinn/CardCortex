import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CheckoutSession = {
  id?: string;
  mode?: string;
  client_reference_id?: string;
  customer?: string | { id?: string };
  subscription?: string | { id?: string };
  payment_status?: string;
  customer_details?: { email?: string };
};

type StripeSubscription = {
  id?: string;
  status?: string;
  current_period_end?: number;
  customer?: string | { id?: string };
};

type Reference =
  | { kind: "plan"; userId: string; planId: "collector" | "pro" | "dealer"; interval: "monthly" | "yearly" }
  | { kind: "addon"; userId: string; addOnId: "grade10" | "grade50" | "grade200" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_LIMITS = {
  card_limit: 75,
  scan_limit: 20,
  grade_limit: 5,
  sell_kit_limit: 3,
};

const PLAN_LIMITS = {
  collector: {
    card_limit: 1500,
    scan_limit: 200,
    grade_limit: 30,
    sell_kit_limit: 25,
  },
  pro: {
    card_limit: 15000,
    scan_limit: 1000,
    grade_limit: 150,
    sell_kit_limit: 150,
  },
  dealer: {
    card_limit: 2147483647,
    scan_limit: 4000,
    grade_limit: 500,
    sell_kit_limit: 800,
  },
};

const ADD_ON_CREDITS = {
  grade10: 10,
  grade50: 50,
  grade200: 200,
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const signature = request.headers.get("stripe-signature") || "";
  const payload = await request.text();
  if (!webhookSecret) return json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, 500);

  const verified = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!verified.ok) return json({ error: verified.error }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const event = JSON.parse(payload);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as CheckoutSession;
      const reference = parseReference(session.client_reference_id || "");
      const firstSeen = await recordEvent(supabase, event.id, event.type, reference?.userId || null, reference, event);
      if (!firstSeen) return json({ ok: true, duplicate: true });
      if (!reference) return json({ ok: true, ignored: "missing_or_invalid_client_reference_id" });
      if (reference.kind === "plan") await applyPlanCheckout(supabase, reference, session);
      if (reference.kind === "addon") await applyAddOnCheckout(supabase, reference, session);
      return json({ ok: true, handled: reference.kind });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as StripeSubscription;
      await recordEvent(supabase, event.id, event.type, null, null, event);
      await applySubscriptionUpdate(supabase, subscription, event.type);
      return json({ ok: true, handled: event.type });
    }

    if (event.type === "invoice.payment_failed") {
      await recordEvent(supabase, event.id, event.type, null, null, event);
      const subscriptionId = objectId(event.data.object?.subscription);
      if (subscriptionId) {
        await supabase
          .from("user_entitlements")
          .update({ billing_status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
      }
      return json({ ok: true, handled: event.type });
    }

    return json({ ok: true, ignored: event.type });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function applyPlanCheckout(supabase: ReturnType<typeof createClient>, reference: Extract<Reference, { kind: "plan" }>, session: CheckoutSession) {
  const limits = PLAN_LIMITS[reference.planId];
  const { error } = await supabase.from("user_entitlements").upsert({
    user_id: reference.userId,
    plan_id: reference.planId,
    billing_status: session.payment_status === "unpaid" ? "trialing" : "active",
    stripe_customer_id: objectId(session.customer),
    stripe_subscription_id: objectId(session.subscription),
    ...limits,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

async function applyAddOnCheckout(supabase: ReturnType<typeof createClient>, reference: Extract<Reference, { kind: "addon" }>, session: CheckoutSession) {
  const credits = ADD_ON_CREDITS[reference.addOnId] || 0;
  const { data, error: readError } = await supabase
    .from("user_entitlements")
    .select("plan_id,billing_status,card_limit,scan_limit,grade_limit,sell_kit_limit,grade_credit_balance,stripe_subscription_id")
    .eq("user_id", reference.userId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await supabase.from("user_entitlements").upsert({
    user_id: reference.userId,
    plan_id: data?.plan_id || "free",
    billing_status: data?.billing_status || "active",
    stripe_customer_id: objectId(session.customer),
    stripe_subscription_id: data?.stripe_subscription_id || "",
    grade_credit_balance: Number(data?.grade_credit_balance || 0) + credits,
    card_limit: data?.card_limit || FREE_LIMITS.card_limit,
    scan_limit: data?.scan_limit || FREE_LIMITS.scan_limit,
    grade_limit: data?.grade_limit || FREE_LIMITS.grade_limit,
    sell_kit_limit: data?.sell_kit_limit || FREE_LIMITS.sell_kit_limit,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

async function applySubscriptionUpdate(supabase: ReturnType<typeof createClient>, subscription: StripeSubscription, eventType: string) {
  const subscriptionId = objectId(subscription.id);
  if (!subscriptionId) return;
  const updates: Record<string, unknown> = {
    billing_status: subscription.status || "unknown",
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (eventType === "customer.subscription.deleted" || subscription.status === "canceled") {
    updates.plan_id = "free";
    Object.assign(updates, FREE_LIMITS);
  }
  const { error } = await supabase
    .from("user_entitlements")
    .update(updates)
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw error;
}

async function recordEvent(
  supabase: ReturnType<typeof createClient>,
  stripeEventId: string,
  eventType: string,
  userId: string | null,
  reference: Reference | null,
  payload: unknown,
) {
  const { error } = await supabase.from("billing_events").insert({
    user_id: userId,
    stripe_event_id: stripeEventId,
    event_type: eventType,
    plan_id: reference?.kind === "plan" ? reference.planId : reference?.kind === "addon" ? reference.addOnId : "",
    billing_status: "received",
    payload,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

function parseReference(reference: string): Reference | null {
  const parts = reference.split("__");
  const userId = parts[0] || "";
  if (!isUuid(userId)) return null;
  if (parts[1] === "plan" && isPlanId(parts[2]) && isInterval(parts[3])) {
    return { kind: "plan", userId, planId: parts[2], interval: parts[3] };
  }
  if (parts[1] === "addon" && isAddOnId(parts[2])) {
    return { kind: "addon", userId, addOnId: parts[2] };
  }
  return null;
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const values = parseStripeSignatureHeader(header);
  if (!values.timestamp || !values.signatures.length) return { ok: false, error: "Missing Stripe signature parts" };
  const age = Math.abs(Date.now() / 1000 - Number(values.timestamp));
  if (age > 600) return { ok: false, error: "Stripe signature timestamp is too old" };
  const signedPayload = `${values.timestamp}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  const ok = values.signatures.some((signature) => timingSafeEqual(signature, expected));
  return ok ? { ok: true } : { ok: false, error: "Invalid Stripe signature" };
}

function parseStripeSignatureHeader(header: string) {
  const values = { timestamp: "", signatures: [] as string[] };
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") values.timestamp = value || "";
    if (key === "v1" && value) values.signatures.push(value);
  }
  return values;
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (!a || !b) return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= a.charCodeAt(index % a.length) ^ b.charCodeAt(index % b.length);
  }
  return mismatch === 0;
}

function objectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPlanId(value: string): value is "collector" | "pro" | "dealer" {
  return value === "collector" || value === "pro" || value === "dealer";
}

function isAddOnId(value: string): value is "grade10" | "grade50" | "grade200" {
  return value === "grade10" || value === "grade50" || value === "grade200";
}

function isInterval(value: string): value is "monthly" | "yearly" {
  return value === "monthly" || value === "yearly";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
