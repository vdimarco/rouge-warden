# Decisions

The simulation stays deterministic and browser independent. It records facts: a kill feed with streak and multi-kill counts, team pings, and skirmish timers on heroes. Presentation modules read these facts. `team-chat.js` writes bot chat, `announcer.js` maps events to sound and banners, and the renderer draws minimap markers.

`createMatch(kind, seed, lineup)` accepts a lineup of ally and enemy kits. Without a lineup the old picks stay, so seeded tests keep their matches. `assignIdentities` accepts an ordered list of identities so the draft names match the battle.

Draft picks are a pure function of the player's hero and a seed. Bots fill missing roles first (front line, mage, support, carry), avoid a kit already on their team, and never take an identity already picked. The board is skippable with Enter or a tap.

Assist: a healthy bot with no target in sight moves toward an allied hero who fought an enemy hero in the last three seconds, within 1900 units. A team rally point holds for 12 seconds and draws healthy bots within 3200 units. This uses the existing `combatDecision` order: danger and retreat still win.

Multi-kills use a 12 second window per killer. Streaks count kills without a death. Ending a streak of three or more is a shutdown. A tower alarm fires when an enemy damages a ward, at most once per ward per 14 seconds.

Sound uses Web Audio only: a master compressor, a generated reverb, noise and oscillator voices. Sounds from world positions pan by screen offset from the camera and fade with distance. The announcer voice uses the device speech engine when it has an English voice. Each call also has a musical stinger, so the cue works when speech is off or missing. The player can turn the voice off in settings. No audio files or new dependencies are added.

No fal key is present in this environment, so the existing skill atlases are kept for every hero.
