# Primordia: The Hunt (combat overhaul)

## Why

The user found Primordia "a bit boring" and asked to reference the mechanics of games with fun combat and apply them. They also asked for Primordia on the arcade cabinets; it already has one, so its screen now runs a live Lenia dish. Later the user said they did not understand the game and asked for a motion graphics intro, so the change adds How to play scenes on the real dish. They still called it boring, so a fun pass makes the first epochs busier and removes fake attacks (see design.md).

A design workflow diagnosed the problem with bot runs. Hunters moved at 8-9 cells/s against the player's 31 and only stung on contact. About 70% of them dissolved on their own. The player had no attack outside Frenzy, and a bot that never fought scored as well as one that did.

## What Changes

Hunters become opponents that stay until killed, wind up, show their lane, glint and lunge faster than the player can swim. One DASH button now cuts, dodges and parries. The mouth finishes staggered hunters. Frenzy becomes Burst, charged only by fighting.

References: Nuclear Throne snipers and Hollow Knight dashes (telegraphed lunge), Hades and Enter the Gungeon (dash-strike, i-frames), Doom Eternal (attack tokens, Glory Kills that drop health, Blood Punch charged by fighting), Bayonetta Witch Time (parry slow motion), Geometry Wars and Gungeon blanks (Burst), Left 4 Dead and Risk of Rain (wave director, relax beats), Hollow Knight and Hades bosses (Leviathan phases), Vlambeer "The Art of Screenshake" (hit-stop, kicks, chunks, scars).

## Scope

- Rules in `public/primordia/core.js`; Lenia helpers in `lenia.js` (whole-cell `roll`, `blobExtent`, `blobShape`, densest cell per blob); Discutium and Circium in `species.js`.
- Browser shell, shader marks and Stasis grade, sound cues, HUD (Burst meter, wave dots, dash pips) and touch layout.
- The arcade cabinet screen runs Primordia's demo dish while selected.
- A How to play intro (`intro.js`): scripted scenes on the real dish with animated captions, before the first run and from the title screen.
- Node tests, bot policies with acceptance metrics, browser smoke for desktop, phone portrait and phone landscape.

## Out of scope

Online scores, new input buttons, a portrait camera zoom, ranged weapons and organelle auto-attacks (see the cut list in design.md).
