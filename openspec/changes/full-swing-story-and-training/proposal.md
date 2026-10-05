# In Full Swing: a story told in comic scenes, a clear mission card and a training checklist

## Why

The player said:
- "Make the missions more clear."
- "Why is the toilet god King at the top of the tower? It's really not clear. There should be maybe some kind of opening cutscene."
- "Maybe if you cut scenes throughout the game, with each mission."
- "It's really not clear what the controls are early on. I get it that the F is used to pull, but I didn't realize that you have to continue to press it to pull throughout the game. Maybe guide the user a bit more with the controls during the initial few minutes. And with checkboxes or something to guide them through the onboarding process."

The game never said why the King sits on the Needle or what a clog is. The only goal on screen was a clog count. The tutorial was eight spoken lines in a fixed order, with nothing on screen to show which step was next or that F must be pressed again and again to pump a clog.

## What changes

- **Comic scenes (flat play):** an opening of five panels after the hand-off: the Needle is the city's water tower; the Porcelain King sits in its tank; he has backed up twelve rooftop drains; the hero with a plunger; the "Mission 1" card. A short briefing the first time the player comes near a district's clogs. The King waking ("Mission 2"). The finale ("All clear"). Each panel is a slow camera push over the live city, in an inked frame, with a caption box, a speech balloon pinned to its speaker or a title card. A click, a tap, Space, Enter or Esc skips it. Each scene plays once per save. A headset plays none and shows a toast.
- **Mission card:** one line at the head of the score row: "FLUSH THE CLOGS 3/12 · Next: Market clog, 240 m"; then "FLUSH THE KING 1/3" with the pipes; then "ALL CLEAR". On a phone or a small window it is a short label (the district, or the pipes).
- **Training checklist:** on a first run in flat play, a card lists the moves to learn with their keys for the input in use (mouse and keys, a pad, or touch). Rows tick in any order when the player does the move. The next row is lit, and its line is said. The last row is to plunge a clog, and the first flush ends the training whatever rows are still open, as it ended the spoken tutorial. On a phone or a small window the card is a chip in the score row (a box and the rows done), and the spoken line names the step. A headset keeps the spoken tutorial.
- **Pump sticker:** while a rope holds a clog or one of the King's pipes, a sticker by the crosshair shows the key ("F", "RB" or a tap) and "PUMP" with a dot for each press, so the player sees that each press counts.
- The tests use `?nocut` (added by lib.mjs unless a test asks for `cut`).
- Version 1.8.0 (Quest APK code 8). cutscene.js is in the offline cache.

## Out of scope

Generated video. There is no Fal key in this environment. The scenes use the game's own city, so they need no download and stay in the offline cache. Street life (change full-swing-street-life).
