# Decisions

## Style files
A style is JSON in `higgsfield/styles/`, named for the game: `game`, `about`, `prompt` and `references`. `about` is required and says where the repository recorded the look, so a style cannot be invented without a source. Reference paths are relative to the repository root, because the art they point at lives under `public/` and `games/`. `loadStyle()` checks every reference before anything is sent.

`applyStyle()` adds `Style: <prompt>` after the request's own prompt, so the subject leads. It appends the references after the request's own `image_urls`, so an image the request edits stays first. The references go in as `"@path"` strings, which the existing upload step in `gen.ts` already handles. Models that take references under another key are not covered; the README says so.

The prompt text is taken from the recorded sources and joined with as few new words as possible:
- Shore of the Ancients: `public/tidebreak/models/sources.json` and the `shore-grand-arena` proposal.
- In Full Swing: the cutscene credits, `rooms-sources.json` and the `swing-facades-2` spec. The anchor is `keyart.webp`, named in `cityview.js`.
- Breath of the Lake: the cartoon direction in `docs/botl-art.md`.
- River Rush: the shared start of its world art prompts. Its later tree and rider prompts asked for photorealism; the style file keeps the stylized direction.
- Reel It In: `public/fish/art/README.md`.
- Olympus: the shared start of the six prompts in `public/olympus/art/sources.json`.

Crimson Rogue, Down the Drain, Get Plunger'd and the arcade key art have no committed prompt, so they have no style file.

## Dry run and request record
`--dry-run` prints the input after the style is applied and exits 0 before any upload or API call. It does not create the `--out` folder. With `--out`, `gen.ts` saves `<name>.request.json`. The record holds the input as given (local paths, not upload URLs), the whole style that was applied, the model, the request id, and each output URL with its saved file. Saved after a paid request, it uses the same no-overwrite naming as the outputs (`saveNew()` in `lib.ts`).

## Tiling step
Sources checked:
- The offset-and-heal workflow: shift the image by half, then paint out the cross-shaped seam ([medialoot](https://medialoot.com/blog/how-to-make-a-seamless-texture-in-photoshop-redux/), [Hive Workshop](https://www.hiveworkshop.com/threads/creating-seamless-textures.286368)).
- Image quilting, which stitches patches along a minimum-error boundary cut (Efros and Freeman, SIGGRAPH 2001, [project page](https://people.eecs.berkeley.edu/~efros/research/quilting.html)).
- Inigo Quilez's [texture repetition](https://iquilezles.org/articles/texturerepetition) techniques, which hide repeats at render time with a random offset and rotation per tile.

The kit keeps River Rush's edge crossfade as the default: pixel k from an edge mixes with pixel k from the opposite edge by 0.5·(1 − k/band)². It is the step already used in the shipped game, it needs no new dependencies, and its output stays byte for byte the same. Its known weakness is the one the other methods address: a strongly structured swatch, such as brick courses, shows a doubled band near the seams. The 2 by 2 preview is the check. Hiding repetition at render time belongs in a game's shader and is out of scope here.

### Repeat-aligned crop (`--repeat`)
The paid brick run showed the weakness, so the kit adds a second path for regular patterns. It is a narrow form of finding a texture's repeat from the peaks of its autocorrelation (Liu, Collins and Tsin, "A computational model for periodic pattern perception based on frieze and wallpaper groups", IEEE TPAMI 2004):
- Only axis-aligned shifts are tried, and the crop is square: one size serves both axes, each with its own best offset. The brick run showed why square matters: width barely changed the score (24.80 at the best width against 24.97 at the height's 1040 px), so a free width would only have stretched the tile by 13%.
- The size runs from half the shorter side up to the shorter side less twice the band.
- The score is the mean absolute grey difference between the lines on both sides of each seam and the lines one size further on, which are the lines the blend touches. The experiment scored a thin band on one side of the seam only, and it chose 5 courses, an odd count where running bond needs an even one. A band on both sides also keeps a plain stripe, such as a mortar line, from deciding the size alone; the synthetic running-bond test checks that case.
- The search runs on a copy at most 512 px on its longer side, scaled the same on both axes. On the 2048 px brick it takes under 3 seconds and chose a 1044 px crop (4 courses).

After the crop, the mirror crossfade would blend each edge with the tile's own opposite edge, which on an aligned crop smears a mirror image across the seam. `wrapTile` instead blends each edge with the image just past the opposite edge, which is the overlap the crop came from. That is the overlap blend of image quilting without its boundary cut. An exact repeat passes through unchanged. A minimum-error boundary cut would also remove the remaining joint that steps sideways at a seam; it is left out until a swatch needs it.

## Dependencies
`sharp` ^0.35.5 is added to `higgsfield/package.json`. The 0.34 line has a high-severity libvips advisory (GHSA-f88m-g3jw-g9cj). `higgsfield/.npmrc` sets `ignore-scripts=true`, because sharp's install script tries to build from source, and fails, when a global libvips is installed (this machine has 8.18.6). The prebuilt binary does not need the script. River Rush keeps its own `sharp` ^0.34.5 devDependency for `pack-ground.mjs` and `pack-tree-textures.mjs`; updating it is left to that game.
