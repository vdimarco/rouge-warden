# Design

## Where the control lives

All Games is the scoreboard in `public/arcade/switch.js`, opened on `/`. New and Updated are two more buttons in the existing rank row, with the same pressed-gold treatment as Featured. The home stylesheet already forces those buttons to a 44px box and 12px type. On viewports 700px and narrower the rank row wraps, and the search field takes the next line, so the buttons stay on screen at 390px.

The in-game switcher is the same script with `home` false. It does not gain these buttons, date labels, or a different order.

No paint or shader technique is involved. Nothing outside this catalog layout was adapted.

## Dates

`qa/arcade/game-dates.mjs` reads `GameSwitch.GAMES` and, for each game, the folder `public` plus its route (`/fish/` → `public/fish`). That is the deployed game. Source trees such as `games/olympus` and `follow-suit/` are not the cabinet the home page opens.

For that folder, git supplies the committer timestamp (`%cI`):

- `added` is the oldest commit that touches the folder (`git rev-list --reverse`).
- `updated` is the newest (`git log -1`).

The calendar day on the card is the `YYYY-MM-DD` in that timestamp, which is the committer's date, not a conversion to UTC. The script writes `public/arcade/game-dates.json`. Vercel serves `public/` with no build step, so the page fetches that file. `node qa/arcade/game-dates.mjs` regenerates it. The check test fails if the file disagrees with git.

The Lab's route is `/lab/`, so its folder is `public/lab`, including the toys inside it. A toy with its own route, such as `/lab/tilt/`, uses `public/lab/tilt`.

## Order and memory

`rankGames` keeps the Featured, Plays, Views, Likes, and Time comparisons. `added` and `updated` sort by the parsed timestamps, newest first. A missing date sorts last. Equal timestamps keep catalog order (stable sort).

The home page reads `cottage-catalog-sort` before the first paint. The value must be one of the seven sort keys. Anything else, or an empty store, leaves Featured. Choosing a sort writes the key. Date labels use Added for every sort except Updated, which uses Updated, so the words match the order the visitor just asked for.

Activity counts still come from PostHog. A date sort does not wait on them, and a missing leaderboard does not drop the date order.

A failed read of the date file does not stick for the session. Selecting New or Updated while the dates are missing starts another read. Clicks during that read share one promise. When it finishes, the list renders again only if New or Updated is still selected. The unavailable line appears only when that read failed too. The failed promise is dropped, so a later click can try again.
