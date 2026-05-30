-- CardCortex catalog source registry repair
-- Run this in the Supabase SQL Editor for project niqmgpgzffwujvacpgzy.

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

grant usage on schema public to anon, authenticated;
grant select on public.catalog_sources to anon, authenticated;
grant select on public.source_sync_runs to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
