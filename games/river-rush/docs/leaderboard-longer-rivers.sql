-- Extend the existing adventure's distance bound from 5,400 to 10,800 m.
-- Apply with a database owner; existing scores, grants and policies are retained.
-- No authentication requirements or anonymous edit/delete permissions change.
begin;

alter table public.river_rush_scores
  drop constraint river_rush_distance_bounds;
alter table public.river_rush_scores
  add constraint river_rush_distance_bounds check (distance between 0 and 10800);

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
    and distance between 0 and 10800
  );

commit;
