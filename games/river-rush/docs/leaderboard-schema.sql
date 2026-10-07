-- Isolated, public guest leaderboard for the finite River Rush adventure.
-- Apply with a database owner. The deployed API uses only a publishable/anon key.
-- No authentication, email address, IP address or other player account is stored.
begin;

create table public.river_rush_scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  coins integer not null,
  levels_cleared smallint not null,
  level_index smallint not null,
  distance integer not null,
  run_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint river_rush_name_length check (char_length(name) between 1 and 20),
  constraint river_rush_name_characters check (name ~ '^[[:alnum:] _.''-]+$'),
  constraint river_rush_name_spacing check (name = regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
  constraint river_rush_score_bounds check (score between 1 and 1000000),
  constraint river_rush_coin_bounds check (coins between 0 and 5000),
  constraint river_rush_level_bounds check (level_index between 0 and 2 and levels_cleared between 0 and 3 and levels_cleared <= level_index + 1),
  constraint river_rush_distance_bounds check (distance between 0 and 10800)
);

create index river_rush_scores_ranking on public.river_rush_scores
  (score desc, levels_cleared desc, distance desc, created_at asc, id asc);

alter table public.river_rush_scores enable row level security;
revoke all on public.river_rush_scores from public, anon, authenticated;
grant select on public.river_rush_scores to anon, authenticated;
-- Timestamp/ID always come from database defaults, including direct REST writes.
grant insert (name, score, coins, levels_cleared, level_index, distance, run_id)
  on public.river_rush_scores to anon, authenticated;

create policy river_rush_public_read on public.river_rush_scores
  for select to anon, authenticated using (true);
create policy river_rush_guest_submit on public.river_rush_scores
  for insert to anon, authenticated with check (
    char_length(name) between 1 and 20
    and name ~ '^[[:alnum:] _.''-]+$'
    and name = regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')
    and score between 1 and 1000000
    and coins between 0 and 5000
    and level_index between 0 and 2
    and levels_cleared between 0 and 3
    and levels_cleared <= level_index + 1
    and distance between 0 and 10800
  );

comment on table public.river_rush_scores is
  'Public guest-submitted finite River Rush scores. Bounded, not gameplay-attested; guest rows cannot be edited or deleted.';

commit;
