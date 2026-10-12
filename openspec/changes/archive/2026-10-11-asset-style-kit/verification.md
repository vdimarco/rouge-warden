# Verification

Node 26.7.0 and npm 11.19.0 on Linux. The checks below ran without credentials. One paid request was made afterwards, with the user's key and approval.

## Checks
- `npm test --prefix higgsfield`: 12 tests pass. They cover every committed style loading with its images, the style order in the prompt and `image_urls`, a missing image and an empty source note failing to load, an unknown style failing in `gen.ts`, the dry run printing the styled input, the seamless step matching River Rush's loop byte for byte at 1024, 256 and 97 px, opposite edges matching on a 200 by 120 RGBA image, and `npm run swatch` writing a 128 px tile with equal first and last rows and a 256 px preview.
- `npm run typecheck --prefix higgsfield`: passes.
- River Rush: `pack-ground.mjs`, `pack-surfaces.mjs` and `pack-tree-textures.mjs` ran on the same four inputs before and after the change. All ten files they write were byte for byte the same (sharp 0.34.5 from River Rush and 0.35.5 from the Higgsfield tools). The committed art was restored afterwards.
- A clean `npm ci --prefix higgsfield` without `.npmrc` failed while sharp tried to build against the global libvips 8.18.6. With `ignore-scripts=true` it installed, and sharp loaded its prebuilt binary. `npm audit`: 0 vulnerabilities.
- A dry run from the repository root with `--style in-full-swing --out <dir>` printed the styled input, exited 0 and did not create the folder.
- `npm run swatch` on `public/wild/tex/cottage-facade.webp` made a 512 px tile and a 1024 px preview. The preview showed the expected doubling where door bottoms fade into the siding, which is why a facade is not a swatch and the preview is the check.
- `openspec validate asset-style-kit --type change --strict` (CLI 1.14.0 through npx): valid.

## Paid run (2026-10-11)
- `npm run gen -- marketing-studio/image @brick.json --style in-full-swing --out <scratch>/brick --name brick` asked for a square, seamlessly tiling red brick swatch at 2k, 1:1, with `enhance_prompt` off. It uploaded `keyart.webp` and `cutscene/city.webp` and completed in 144 s as request `c290e2fd-f228-40c1-995a-b0f9426a56b0`. It saved a 2048 by 2048 PNG and `brick.request.json`. The record held the date, model, the input as given, the whole `in-full-swing` style, the request id, and the output URL with its saved path.
- The image had the In Full Swing look: ink outlines, halftone dots, and the orange and magenta sunset colours.
- `npm run swatch` on the whole image: the 2 by 2 preview showed the doubling the design warns about. The brick courses did not line up at the top and bottom edges, so the seam had a ghost mortar line through a course and joints fading into bricks.
- Experiment, outside the tool: a search for the crop whose edges wrap onto the same place in the pattern. It compared a band at each offset with the band one period later, on a 512 px greyscale copy.
  - The best 5-course repeat removed the ghost mortar line. Joints still faded in the seam course, because running bond repeats every 2 courses.
  - The best 6-course repeat was a 1512 by 1532 crop at (0, 388). After the crossfade with a 32 px band, joints continue across both seams; only a soft band and one joint about 20 px out of line are left.
- So for regular patterns, a repeat-aligned crop before the crossfade works where the crossfade alone does not. The user kept the 6-course tile and asked for the crop in the tool.

## `--repeat`
- `npm test --prefix higgsfield`: 18 tests pass. The six new tests cover these cases:
  - An exact 30 by 20 repeat gives a 120 px square at cost 0.
  - Synthetic running bond gives 160 px (8 courses), not the odd 140 px.
  - Sizes or a band that do not fit are rejected.
  - `wrapTile` leaves an exact repeat unchanged and blends each edge with the lines past the opposite edge.
  - `npm run swatch --repeat` on running bond prints `repeat crop 160 px square at (10, 10); mean seam difference 0.0 of 255` and writes the crop unchanged.
- The generated brick: `npm run swatch -- brick.png brick-auto.webp --band 32 --repeat --preview …` took under 3 s. It chose a 1044 px square at (824, 888), 4 courses, with a mean seam difference of 22.8.
  - The preview has no doubled mortar line, and courses and joints continue across both seams.
  - In the seam course, one joint steps sideways by about 25 px, because the drawn joints are not exactly regular.
  - Compared with the mirror crossfade on the same crop, the continuation blend removed the smeared band; crackle lines and halftone dots run through the seam.
- The kept swatch is the hand-cropped 6-course tile from the experiment. It is in the session scratch folder, not the repository, because no game uses painted swatches yet.
- `openspec validate asset-style-kit --type change --strict`: valid.

## Not checked
- Whether other models on the Higgsfield API accept reference images in `image_urls`. `marketing-studio/image` does.
