# Tasks

- [x] Point the BREAKTHROUGH cabinet `data-url` at `/breakthrough2/`.
- [x] Confirm no other homepage link, anchor, or URL builder still opens `/breakthrough/` for this cabinet.
- [x] Serve `public/`, open the homepage at 390px, start the cabinet, and confirm `/breakthrough2/` loads.
- [x] Capture 390px screenshots of the cabinet and the landing page.
- [x] Run existing homepage QA (`qa/lab/hidden.mjs`).
- [ ] Validate the spec with the OpenSpec CLI when it is available.

## Checks

Homepage search found one cabinet destination: `data-url` on `article.cab.breakthrough`. `boot()` uses that attribute. No anchor, sitemap, or other homepage URL builder pointed at `/breakthrough/`. The marquee still reads BREAKTHROUGH and 2026 to 2100. The aria label is unchanged. The older page still responds at `/breakthrough/`.

At 390 by 844, selecting BREAKTHROUGH and tapping the marquee dropped a token and opened `http://127.0.0.1:8765/breakthrough2/`. The title, trajectory chart, map, energy race, and technology pathways were present. No page errors. The cabinet canvas showed sky, sun, hills, water, trees, buildings, and the turbine.

`node qa/lab/hidden.mjs` failed three checks that already fail on the current homepage: `public/index.html` and `public/arcade/switch.js` mention `/lab/`, and `public/lab/worlds/index.html` has no `noindex`. This change does not touch those lines.

`NODE_PATH=qa/browser/node_modules node qa/fish/screens.mjs` covers the homepage cabinet in its last section. Every cabinet check passed. The script still exits 1 because ten fish fight-prompt lines expect the words "rod pad" and the game says "rod". Those lines are in the fishing game, not this cabinet link.

OpenSpec CLI is not installed, so `openspec validate` did not run.
