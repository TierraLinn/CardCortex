-- CardCortex intelligence engine setup
-- Paste into Supabase SQL Editor after SUPABASE-SCHEMA.sql.

create table if not exists public.card_catalog (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_card_id text not null,
  name text not null,
  category text not null,
  game_or_sport text default '',
  set_name text default '',
  card_number text default '',
  rarity text default '',
  release_date date,
  image_url text default '',
  source_url text default '',
  raw_payload jsonb default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  unique (source, source_card_id)
);

create index if not exists card_catalog_search_idx
on public.card_catalog using gin (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(set_name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(game_or_sport,''))
);

create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  catalog_card_id uuid references public.card_catalog(id) on delete cascade,
  source text not null,
  variant text default '',
  price_label text default '',
  currency text default 'USD',
  price numeric not null default 0,
  source_url text default '',
  observed_at timestamptz not null default now(),
  raw_payload jsonb default '{}'::jsonb
);

create index if not exists price_snapshots_card_date_idx
on public.price_snapshots (catalog_card_id, observed_at desc);

create table if not exists public.catalog_sources (
  id text primary key,
  display_name text not null,
  coverage text not null,
  source_kind text not null default 'public_api',
  base_url text default '',
  auth_required boolean not null default false,
  status text not null default 'planned',
  notes text default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text references public.catalog_sources(id) on delete cascade,
  status text not null default 'queued',
  records_seen integer not null default 0,
  records_imported integer not null default 0,
  error_message text default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.catalog_sources enable row level security;
alter table public.source_sync_runs enable row level security;

drop policy if exists "Anyone can read catalog sources" on public.catalog_sources;
create policy "Anyone can read catalog sources"
on public.catalog_sources for select
to public
using (true);

drop policy if exists "Anyone can read source sync runs" on public.source_sync_runs;
create policy "Anyone can read source sync runs"
on public.source_sync_runs for select
to public
using (true);

insert into public.catalog_sources (id, display_name, coverage, source_kind, base_url, auth_required, status, notes)
values
  ('pokemon-tcg-api', 'Pokemon TCG API', 'Pokemon cards, sets, images, and TCGPlayer/Cardmarket price fields where available', 'public_api', 'https://api.pokemontcg.io/v2', false, 'active', 'Used for live scanner lookup and catalog sync. API key optional for higher limits.'),
  ('scryfall', 'Scryfall', 'Magic: The Gathering cards, printings, images, collector numbers, and USD/EUR price fields', 'public_api', 'https://api.scryfall.com', false, 'active', 'Used for live Magic scanner lookup.'),
  ('pricecharting', 'PriceCharting', 'Paid/token API for product search and prices across games, trading cards, comics, coins, and toys', 'paid_api', 'https://www.pricecharting.com', true, 'available_with_key', 'Use /api/products or /api/product with a paid API token. Photo recognition is a PriceCharting app feature, not a public image-recognition API.'),
  ('tcgcsv', 'TCGCSV / TCGplayer cache', 'TCGplayer categories, groups, products, and market price collections across many trading card games', 'public_cache', 'https://tcgcsv.com/tcgplayer', false, 'planned', 'Best broad public source for expanding beyond one game. Requires category/group import jobs.'),
  ('card-hedge', 'Card Hedge', 'Sports, TCG, and pop-culture card categories with search, pricing, and computer vision', 'partner_api', 'https://api.cardhedger.com', true, 'available_with_key', 'Enterprise/partner key required before live ingestion.'),
  ('manual-vault', 'Manual vault entries', 'Any card a user enters or corrects after scanner review', 'user_input', '', false, 'active', 'Keeps CardCortex usable for cards that do not have a public API connector yet.')
on conflict (id) do update set
  display_name = excluded.display_name,
  coverage = excluded.coverage,
  source_kind = excluded.source_kind,
  base_url = excluded.base_url,
  auth_required = excluded.auth_required,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  status text not null default 'queued',
  best_catalog_card_id uuid references public.card_catalog(id),
  confidence numeric default 0,
  candidate_matches jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.scan_jobs enable row level security;

drop policy if exists "Users can read own scan jobs" on public.scan_jobs;
create policy "Users can read own scan jobs"
on public.scan_jobs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own scan jobs" on public.scan_jobs;
create policy "Users can insert own scan jobs"
on public.scan_jobs for insert
to authenticated
with check (auth.uid() = user_id);

create table if not exists public.grade_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  front_image_url text default '',
  back_image_url text default '',
  corners_image_url text default '',
  surface_image_url text default '',
  centering_score numeric default 0,
  corners_score numeric default 0,
  edges_score numeric default 0,
  surface_score numeric default 0,
  print_alignment_score numeric default 0,
  color_integrity_score numeric default 0,
  glare_risk_score numeric default 0,
  overall_pregrade numeric default 0,
  confidence numeric default 0,
  micro_findings jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.grade_reports enable row level security;

drop policy if exists "Users can read own grade reports" on public.grade_reports;
create policy "Users can read own grade reports"
on public.grade_reports for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own grade reports" on public.grade_reports;
create policy "Users can insert own grade reports"
on public.grade_reports for insert
to authenticated
with check (auth.uid() = user_id);
