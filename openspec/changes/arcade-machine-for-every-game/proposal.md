# Give every game a machine in the arcade

The Cottage Arcade homepage showed 11 machines, but the site holds more games. The Lab, Small Worlds, Loon Echo, Neon Ronin and Tell Me had no machine, and the four Lab toys could only be reached from the Lab page. A player could not find them from the arcade.

## Scope

- Add a machine for each game that has none: The Lab, Small Worlds, Neon Ronin, Loon Echo, Tell Me, Take the Plunge, Up the Creek, Full Tilt and House Rules.
- List every game in the game switcher (`public/arcade/switch.js`), including Olympus, Moonwell and BREAKTHROUGH, which were missing.
- Retire the old rule that the arcade and the switcher never mention the Lab. Lab pages keep their `noindex` tag.
- Keep Crimson Rogue's end card usable. It builds its list of games from the switcher.
- Give Tell Me and BREAKTHROUGH a link back to the arcade.
- Add a test that fails when a game has no machine.
- Leave `/breakthrough/` (the older build) without a machine. The BREAKTHROUGH machine opens `/breakthrough2/`.

## Player-facing change

The arcade shows 20 machines. Each one has art from the real game, a high-score line from the game's own save, and the usual token and START flow that opens the game. The SWITCH GAME list shows the same 20 games.
