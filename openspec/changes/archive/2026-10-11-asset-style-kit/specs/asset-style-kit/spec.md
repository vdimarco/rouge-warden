## ADDED Requirements

### Requirement: Game style files
The Higgsfield tools SHALL keep one style file per game in `higgsfield/styles/<game>.json`, with the game's name, where the look is recorded in the repository, the style text and at least one committed reference image. A style SHALL fail to load when its source note is empty or a reference image is missing, before anything is uploaded or sent.
#### Scenario: Check the committed styles
- **WHEN** a developer runs `npm test --prefix higgsfield`
- **THEN** every style file loads, and each of its reference images exists in the repository.
#### Scenario: A reference image is missing
- **WHEN** a style lists an image path that is not in the repository and a request uses that style
- **THEN** the tool names the missing path and exits 1 without uploading or sending anything.

### Requirement: Styled requests
`npm run gen` SHALL accept `--style <game>`. It SHALL add `Style: <style text>` after the request's own prompt and the style's reference images after the request's own `image_urls`. An unknown style SHALL fail before anything is sent and list the available styles.
#### Scenario: Preview a styled request
- **WHEN** a developer runs `npm run gen -- <model> '{"prompt":"a lantern"}' --style in-full-swing --dry-run`
- **THEN** the tool prints the input with the prompt "a lantern" followed by the In Full Swing style text, and with the style's reference images in `image_urls`. It exits 0 without uploading, calling the API or creating the output folder.
#### Scenario: Ask for a style that does not exist
- **WHEN** a developer passes `--style no-such-game`
- **THEN** the tool says there is no such style, lists the styles there are, and exits 1 before anything is sent.

### Requirement: Request records
When `npm run gen` saves outputs with `--out`, it SHALL also save `<name>.request.json` next to them. The record SHALL hold the date, the model, the input as given, the applied style, the request id, and each output URL with the file it was saved to. It SHALL never overwrite an existing file.
#### Scenario: Remake an asset
- **WHEN** a paid request with `--style` and `--out` completes
- **THEN** the record holds the model, input and style needed to send the same request again, and the output files sit beside it.

### Requirement: Tileable swatches
`npm run swatch -- <in> <out>` SHALL crop and resize a texture to a square, crossfade each edge band with the opposite edge so that the outermost rows and columns match, and save it as WebP, PNG or JPEG. `--preview <file>` SHALL also save the tile repeated 2 by 2. An unsupported output format SHALL fail before anything is written.
#### Scenario: Make a swatch and judge it
- **WHEN** a developer runs `npm run swatch -- source.png tile.png --size 128 --preview preview.png`
- **THEN** `tile.png` is 128 by 128 with its first and last rows equal, and `preview.png` is 256 by 256.
#### Scenario: River Rush textures are unchanged
- **WHEN** River Rush's `pack-ground.mjs`, `pack-surfaces.mjs` and `pack-tree-textures.mjs` run on the same inputs before and after they share the seamless step
- **THEN** every file they write is byte for byte the same.

### Requirement: Repeat-aligned swatches
`npm run swatch -- <in> <out> --repeat` SHALL crop the square, from half the shorter side up to the shorter side less twice the blend band, whose edges continue into the same place in the pattern. It SHALL score each size by the lines on both sides of each seam, so that a plain stripe such as a mortar line cannot decide it alone. It SHALL then blend each edge with the image just past the opposite edge, and print the crop and its mean seam difference.
#### Scenario: Tile running bond
- **WHEN** a developer runs `--repeat` on running bond with 20 px courses, where every other course is shifted by half a brick
- **THEN** the crop spans an even number of courses, so the joints line up across the seam.
#### Scenario: An exact repeat stays exact
- **WHEN** the source repeats exactly and the output size equals the crop
- **THEN** the tile is the crop unchanged, and the printed seam difference is 0.0.
#### Scenario: Tile the generated brick
- **WHEN** a developer runs `npm run swatch -- brick.png tile.webp --repeat --band 32 --preview preview.webp` on the 2048 px brick from the paid run
- **THEN** the preview shows no doubled mortar line at the seams, and brick courses and joints continue across them.
