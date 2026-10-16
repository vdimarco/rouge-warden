# Remove the painted title sequence

## Why
The painted cottage-dock film on the Reel It In title looked wrong on the page. The title goes back to the painted logo and menu.

## What changes
The title no longer plays or posters that film. The clips, the intro script, and the title-intro check are removed. In-engine cutscenes are unchanged.

## Capabilities
### Removed
- `fish-title-intro`: the title does not show the painted film.

## Impact
`public/fish/index.html`, `public/fish/style.css`, `public/fish/js/title-intro.js`, `public/fish/clips/title-*`, `qa/fish/title-intro.e2e.mjs`, and `openspec/specs/fish-title-intro/spec.md`.
