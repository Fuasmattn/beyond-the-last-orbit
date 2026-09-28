-- Beyond the Last Orbit global leaderboard (M11).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  mode       text        not null check (mode in ('rogue', 'rhythm')),
  initials   text        not null check (initials ~ '^[A-Z0-9]{3}$'),
  score      integer     not null check (score between 1 and 100000000),
  world      smallint    not null check (world between 0 and 9),
  stage      smallint    not null check (stage between 1 and 20),
  loop       smallint    not null check (loop between 0 and 99),
  created_at timestamptz not null default now()
);

create index if not exists scores_top_idx on public.scores (mode, score desc, created_at);

alter table public.scores enable row level security;

-- Anyone may read the board and add a row. No update or delete policies: rows are append-only for clients.
drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores for select to anon using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score" on public.scores for insert to anon with check (true);

-- Column-level grants: clients cannot set id or created_at, and cannot update or delete.
revoke all on public.scores from anon, authenticated;
grant select on public.scores to anon;
grant insert (mode, initials, score, world, stage, loop) on public.scores to anon;
