-- Extend the existing adventure's distance bound from 10,800 to 16,200 m.
-- Existing 5,400 / 10,800 m scores and run IDs remain untouched.
-- Apply with a database owner; no grants, roles, or read policy change.
begin;

alter table public.river_rush_scores
  drop constraint river_rush_distance_bounds;
alter table public.river_rush_scores
  add constraint river_rush_distance_bounds check (distance between 0 and 16200);

alter policy river_rush_guest_submit on public.river_rush_scores
  with check (
    char_length(name) between 1 and 20
    and name ~ '^[[:alnum:] _.''-]+$'
    and name = regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')
    and score between 1 and 1000000
    and coins between 0 and 5000
    and level_index between 0 and 2
    and levels_cleared between 0 and 3
    and levels_cleared <= level_index + 1
    and distance between 0 and 16200
  );

commit;
