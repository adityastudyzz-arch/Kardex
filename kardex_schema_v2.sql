-- ============================================================
-- Kardex: granular storage migration
-- ============================================================
-- Replaces the old single-row-per-user "kardex_state" blob (entire app
-- state overwritten wholesale on every save) with separate tables, so
-- edits to different things can never clobber each other. Run this in
-- the Supabase SQL Editor for your project.
--
-- Safe to run even if you still have the old kardex_state table — this
-- doesn't touch or drop it. Your existing data stays put until you're
-- ready to migrate it over (see the migration function Kardex will run
-- automatically on first load after this update).
-- ============================================================

-- One row per user: just the folder/drawer hierarchy and where each
-- deck sits in it — NOT the cards inside those decks. This is small and
-- changes rarely (only when you create/rename/move/delete a drawer or
-- deck), so it stays a simple "whole blob" overwrite safely — there's
-- very little for two devices to actually collide on here.
create table if not exists kardex_tree (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skeleton jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row PER DECK. This is where almost all real write volume happens
-- (adding/editing/grading cards) — and because each deck is its own
-- row, editing Deck A on your laptop and Deck B on your phone can never
-- conflict, no matter how close together in time they happen.
create table if not exists kardex_decks (
  deck_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cards jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

-- One row PER REVIEW EVENT, append-only. Never updated after being
-- written, only ever inserted — which makes it structurally impossible
-- for two devices to conflict on this, ever, regardless of timing.
create table if not exists kardex_review_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  good boolean not null,
  ts bigint not null,
  question_seconds real,
  answer_seconds real
);

-- One row per unique image, keyed by its content hash. Set once when an
-- image is first uploaded, essentially never changed after — so this is
-- also naturally conflict-free.
create table if not exists kardex_image_urls (
  hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  primary key (hash, user_id)
);

-- ---------- Row Level Security: everyone can only touch their own rows ----------
alter table kardex_tree enable row level security;
alter table kardex_decks enable row level security;
alter table kardex_review_log enable row level security;
alter table kardex_image_urls enable row level security;

drop policy if exists "own tree" on kardex_tree;
create policy "own tree" on kardex_tree
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own decks" on kardex_decks;
create policy "own decks" on kardex_decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own review log" on kardex_review_log;
create policy "own review log" on kardex_review_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own image urls" on kardex_image_urls;
create policy "own image urls" on kardex_image_urls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful indexes for the common lookups (fetch everything for a user)
create index if not exists idx_kardex_decks_user on kardex_decks(user_id);
create index if not exists idx_kardex_review_log_user on kardex_review_log(user_id);
create index if not exists idx_kardex_image_urls_user on kardex_image_urls(user_id);
