# Point the BREAKTHROUGH cabinet at the current game

The Cottage Arcade BREAKTHROUGH cabinet still opens `/breakthrough/`, the older build. Players should start the current game at `/breakthrough2/`, the one with the energy race, technology pathways, trajectory chart, and the new art pack.

## Scope

- Change the homepage cabinet destination from `/breakthrough/` to `/breakthrough2/`.
- Keep the marquee, the aria label, and the mini-game attract scene.
- Leave `public/breakthrough/` on disk so the older page still loads if someone opens it directly.
- Do not change `public/breakthrough/`, `public/breakthrough2/` game logic, or `public/tellme/`.

## Player-facing change

Tapping the BREAKTHROUGH cabinet, after a token if one is required, loads `/breakthrough2/` and the current game starts. The cabinet still reads BREAKTHROUGH, with the same century marquee and the same landscape on its screen.
