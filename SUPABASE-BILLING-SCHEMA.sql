-- CardCortex billing and entitlement setup
-- Run this in Supabase SQL Editor after the main CardCortex schema.
-- Do not paste Stripe secret keys into this file.

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free',
  billing_status text not null default 'inactive',
  stripe_customer_id text default '',
  stripe_subscription_id text default '',
  current_period_end timestamptz,
  card_limit integer default 75,
  scan_limit integer default 20,
  grade_limit integer default 5,
  sell_kit_limit integer default 3,
  grade_credit_balance integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_event_id text unique,
  event_type text not null,
  plan_id text default '',
  billing_status text default '',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  scans_used integer not null default 0 check (scans_used >= 0),
  grades_used integer not null default 0 check (grades_used >= 0),
  sell_kits_used integer not null default 0 check (sell_kits_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create index if not exists user_entitlements_stripe_customer_id_idx
on public.user_entitlements (stripe_customer_id)
where stripe_customer_id <> '';

create index if not exists user_entitlements_stripe_subscription_id_idx
on public.user_entitlements (stripe_subscription_id)
where stripe_subscription_id <> '';

create index if not exists billing_events_user_id_idx
on public.billing_events (user_id);

create index if not exists usage_counters_user_month_idx
on public.usage_counters (user_id, month desc);

alter table public.user_entitlements enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_counters enable row level security;

drop policy if exists "Users can read own entitlement" on public.user_entitlements;
create policy "Users can read own entitlement"
on public.user_entitlements for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own billing events" on public.billing_events;
create policy "Users can read own billing events"
on public.billing_events for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own usage counters" on public.usage_counters;
create policy "Users can read own usage counters"
on public.usage_counters for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage counters" on public.usage_counters;
create policy "Users can insert own usage counters"
on public.usage_counters for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage counters" on public.usage_counters;
create policy "Users can update own usage counters"
on public.usage_counters for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- The service role should update these records from a secure webhook function.
-- The client app should not be allowed to grant itself a paid plan.
drop policy if exists "Block client entitlement writes" on public.user_entitlements;
create policy "Block client entitlement writes"
on public.user_entitlements for all
to authenticated
using (false)
with check (false);

create or replace function public.ensure_free_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_free_entitlement on auth.users;
create trigger create_free_entitlement
after insert on auth.users
for each row execute function public.ensure_free_entitlement();
