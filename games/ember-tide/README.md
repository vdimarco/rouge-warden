# Ember Tide: sources and tools

The game is served from `public/ember-tide/`. This folder holds what that copy is built from.

- `forge-src/` is the Forge fragment as downloaded (https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24). Leave it unchanged. Its licence has not been checked.
- `tools/build_engine.py` writes `public/ember-tide/src/` from it, with the campaign's patches:

  ```
  python3 -I games/ember-tide/tools/build_engine.py games/ember-tide/forge-src public/ember-tide
  ```

  Each patch is an exact text replacement and the script stops if one does not match. Change the scene by editing the script, not the files in `public/ember-tide/src/`.
- `tools/build-vendor.mjs` bundles React into `public/ember-tide/vendor/`. In an empty folder: `npm install react@19.2.8 react-dom@19.2.8 esbuild`, then `node build-vendor.mjs <repo>/public/ember-tide/vendor`.
- `public/ember-tide/tailwind.css` is the Tailwind 4.1.0 output for the classes in `public/ember-tide/src/`: a CSS file with `@import "tailwindcss" source(none);` and `@source "<repo>/public/ember-tide/src";`, compiled by `npx @tailwindcss/cli -i in.css -o tailwind.css --minify`.

The campaign itself is hand-written in `public/ember-tide/`: `campaign.js` (screens, objectives, cutscene player, save), `missions.js` (sorties and balance), `cutscenes.js` (shots, lines, portraits) and `campaign.css`. The spec is `openspec/specs/ember-tide/spec.md`.
