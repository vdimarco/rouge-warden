# Arcade cabinet groups

The Cottage Arcade shows 23 machines in one row. That is too many to browse, especially on a phone, where you see one machine at a time. Upstream already sorts the machines into groups (`GROUPS` in `public/index.html`: Cottage, Action, Strategy, Lab), lists them by group in the machine picker, and has collection buttons under the sign that jump along the single row.

This change turns those groups into a hall. The arcade opens on one group cabinet per group; playing one opens a row of only that group's machines, with a way back. The groups and their members are upstream's, unchanged:

- **Cottage**: Get Plunger'd, Down the Drain, Cottage Brawl, Breath of the Lake, Reel It In, In Full Swing
- **Action**: Olympus, Crimson Rogue, Monster Mash, Moonwell, Primordia, River Rush
- **Strategy**: BREAKTHROUGH, Follow Suit
- **Lab**: The Lab, Small Worlds, Neon Ronin, Loon Echo, Tell Me, Take the Plunge, Up the Creek, Full Tilt, House Rules

An earlier local draft of this change (2026-10-02) used five groups of its own (Get Plunger'd, Loon Lake, Action, Pinball, Small Worlds). It was never published; upstream's grouping landed first, so the hall now uses it.

Keep the existing cabinets, their attract screens, high scores, tokens, credits, and power-on unchanged. Keep every way of choosing a machine: arrows, swipe, drag, wheel, keys, Tab, and the machine picker. Out of scope: the in-game Switch game list (`public/arcade/switch.js`) and the Lab page.
