# Lake Brawl: a cartoon summit fighting game

Add Lake Brawl at `/lake-brawl/`, a one-on-one 2D fighting game with a cabinet in the Cottage Arcade. Fourteen caricatured world leaders argue over who gets to rename a frozen lake. It is slapstick satire: a knocked-out fighter is launched off screen, and there is no blood or gore.

## Scope

- One static page in `public/lake-brawl/` with no build step. It draws on two stacked 2D canvases.
- Fourteen fighters. Each has eight generated pose sprites (stance, walk, punch, kick, special, block, hit, victory) and a portrait.
- Five generated stages: the ice, a summit hall, an airport tarmac, a debate studio and a tower top.
- A campaign of five chapters with a story card before each fight, a prologue and an epilogue. Opponents get stronger and quicker each chapter. Progress is saved in the browser.
- A versus mode against the computer on a random stage.
- Keyboard play, and touch play in landscape and portrait.
- A cabinet, a Switch game entry, and a cabinet line that reads the game's save.

## Out of scope

- Two-player play, online play, and props held during special moves.
- A place in one of the arcade's named groups. The cabinet shows under **More** until the group lists and their checks are updated.
