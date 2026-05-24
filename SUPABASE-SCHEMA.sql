-- CardCortex Supabase setup
-- Paste this into Supabase SQL Editor and run it once.

create extension if not exists "pgcrypto";

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  set_name text default '',
  card_number text default '',
  rarity text default '',
  storage_location text default '',
  raw_value numeric default 0,
  graded_value numeric default 0,
  ai_grade numeric default 0,
  ai_confidence numeric default 0,
  image_url text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cards enable row level security;

drop policy if exists "Users can read own cards" on public.cards;
create policy "Users can read own cards"
on public.cards for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own cards" on public.cards;
create policy "Users can insert own cards"
on public.cards for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards"
on public.cards for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards"
on public.cards for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload own card images" on storage.objects;
create policy "Users can upload own card images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read card images" on storage.objects;
create policy "Users can read card images"
on storage.objects for select
to public
using (bucket_id = 'card-images');

drop policy if exists "Users can update own card images" on storage.objects;
create policy "Users can update own card images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own card images" on storage.objects;
create policy "Users can delete own card images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
