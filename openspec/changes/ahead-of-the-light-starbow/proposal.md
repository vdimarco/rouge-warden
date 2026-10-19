# Ahead of the Light: the starbow, in ascii

## Why

After the canyon run (a Null Range look) merged, the user said: "it looks way too similar to that other game. Make it
feel celestial. Make it feel like I'm flying through a galaxy... stars that I'm moving through at light speed that I
need to avoid... change the menu style and the hero page". We sent three samples (Star Atlas, Starbow, Nebula). The
user chose: "2 but make it more ascii", then "use ascii librarie".

## What Changes

- **The world** is a tube of stars 30 m across that runs home through the same eight sectors. Stars in your path are
  hits; a close pass charges your boost; spectral rings give charge and speed. The canyon, its walls, spires, gates
  and sonar are gone.
- **The view** is drawn in characters with ascii.rest (bas3line/ascii, MIT), vendored in `vendor/ascii-rest/`: its
  canvas renderer (`mount`), its block-letter `banner` and its `galaxy` piece. The game is one ascii.rest piece sized
  to the window, coloured by the starbow: blue ahead, a rainbow ring round the way ahead, red at the edges.
- **The screens** are plain monospace text: a velocity line, the title in the library's block letters with LIGHT in
  the spectrum, a rainbow rule, and a menu of lines with a dot that lights. The HUD is lines of text.
- **Controls:** steer with A D W S, the arrows, a drag or a stick; boost with SHIFT, SPACE, the BOOST button, RT or A.
- **Kept:** the light behind you, hull and shield, the eight sectors, the score, the machine.
- **Removed:** three.js from this game, the canyon's view and HUD, and the old change
  `openspec/changes/ahead-of-the-light-canyon/` (merged in #419; its game is gone).

## Impact

`public/ahead-of-the-light/` (core, render, ui, vendor, page), `qa/ahead-of-the-light/`, the cabinet's screen art and
lines in `public/index.html`, README and AGENTS.md.
