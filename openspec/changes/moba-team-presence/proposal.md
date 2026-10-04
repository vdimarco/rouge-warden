# Team presence in Shore of the Ancients

Make the bot match feel like a game with other people. The player sees the other five heroes chosen, sees every teammate on the minimap, and hears the fight across the whole battlefield. Teammates answer fights and calls.

## Scope
- A draft board after Play. Teammate and enemy bots pick one at a time under player-like handles, with short chat lines. The picks set the match lineup.
- Minimap hero markers in hero colours, last-seen enemy ghosts, team pings and structure alarms.
- A team chat feed and kill feed in the HUD.
- Bots rotate to nearby team fights. The player can call the team to a point (G or the Rally button). Both teams use the same rules.
- A new synthesized sound engine and announcer: first blood, multi-kills, streaks, shutdowns, towers and rift under attack, wards falling, the Wild Hunt, realm shifts, victory and defeat. Off-screen events pan by direction and fade with distance.
- Fixes in the same PR: HUD skill icons render for every hero, and the match pauses when the mouse leaves the window and resumes when it returns.

## Capabilities
- Modify `moba-ui` and `moba-combat`. Add `moba-audio`.
