-- Rune-final · Phase 1 schema for projects card data.
-- Run this once in Supabase Studio (SQL Editor) against the mainnet project
-- (mefjuecwawmjfmeofnck). Idempotent — safe to re-run.
--
-- This mirrors the Drizzle schema in lib/db/src/schema/projects.ts so the
-- seed data from the live api-server can be copied 1:1.

create table if not exists public.projects (
  id              bigserial primary key,
  name            text          not null,
  symbol          text          not null,
  category        text          not null,
  description     text          not null,
  rating          real          not null default 0,
  risk_level      text          not null default 'medium',
  apy             real          not null default 0,
  tvl             text          not null default '$0',
  market_cap      text          not null default '$0',
  website         text,
  tags            text[]        not null default array[]::text[],
  is_recommended  boolean       not null default false,
  trending        boolean       not null default false,
  archived        boolean       not null default false,
  created_at      timestamptz   not null default now()
);

create index if not exists projects_category_idx on public.projects(category);
create index if not exists projects_trending_idx on public.projects(apy desc) where archived = false;

-- RLS — public read (anon key), no public writes. Admin writes go through
-- the service_role key via the admin-panel.
alter table public.projects enable row level security;

drop policy if exists "projects_anon_read" on public.projects;
create policy "projects_anon_read"
  on public.projects for select
  to anon, authenticated
  using (archived = false);

-- Seed step (manual):
--   1. With crypto-analyzer's api-server running on Railway, fetch:
--        curl https://workspaceapi-server-production-963b.up.railway.app/api/projects > /tmp/projects.json
--   2. Convert JSON to INSERT statements (jq one-liner below) and paste into
--      this editor. Or use Supabase Studio's "Import data" UI for the table.
--
--   jq -r '.[] | "insert into public.projects (name,symbol,category,description,rating,risk_level,apy,tvl,market_cap,website,tags,is_recommended,trending,archived) values (" +
--     (.name|tojson) + "," + (.symbol|tojson) + "," + (.category|tojson) + "," + (.description|tojson) + "," +
--     (.rating|tostring) + "," + (.riskLevel|tojson) + "," + (.apy|tostring) + "," + (.tvl|tojson) + "," + (.marketCap|tojson) + "," +
--     (.website // null | tostring) + ",array[" + ([.tags[]|tojson] | join(",")) + "]::text[]," +
--     (.isRecommended|tostring) + "," + (.trending|tostring) + "," + (.archived|tostring) + ");"' /tmp/projects.json
