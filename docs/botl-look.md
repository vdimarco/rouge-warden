# Breath of the Lake: look settings

The game aims for a clean, soft, hand-painted look. Think of a bright meadow in an animated film.
This note lists the settings that make that look. It also says what each setting costs.

## Quality levels

Low is the phone setting. Keep it fast. Medium and High add smoothing.

| Setting | Low | Medium | High |
|---|---|---|---|
| Edge smoothing | FXAA in the last pass | 4x MSAA | 4x MSAA |
| Lens blur near the camera | off | off | on (first 3 m) |
| Top resolution | `maxRatio` in `QUALITY` | `maxRatio` in `QUALITY` | `maxRatio` in `QUALITY` |

The resolution ladder in `main.js` can go above the base ratio when the frame time is low. It never goes above `devicePixelRatio`.

## Painted filter (`post.js`)

- The Kuwahara brush filter blends toward the average of its four quarters on far hills. Far hills look smooth.
- Ink lines are thin (strength 0.42). They skip grass. The grass shader writes alpha 0 to the scene target. The ink pass reads the smallest alpha of the centre pixel and its four neighbours.
- Haze strength is 0.42. Saturation is 1.12.

## Watercolour wash (`post.js`, `uWash`)

The default Paint setting copies the look of [Susurrus](https://susurrus.vercel.app/): a cream-and-sepia watercolour.
`uWash` is 1 for Watercolor and 0 for Bright. The Paint button in the pause menu sets it. `?paint=bright` sets it for one visit.

- The brush reads the scene 1 to 2 pixels off, along slow noise. Edges wobble like bled paint.
- Wet edges: where the colour changes, the pigment dries 30% darker. Grass (alpha 0) gets no wet edge.
- Far haze fades towards warm paper, not cool blue.
- After the display transform, the paper tints the paint. Shadows stay sepia. Saturation drops by 10%.
- Granulation: dark paint shows more paper grain than light paint.
- A ragged border of bare paper frames the screen. It has a darker rim where the paint stops. At night the paper dims.
- Cost: 4 more colour reads and about 8 noise calls for each pixel. There are no new draw calls or render targets.

## Grass (`world.js`)

- Roots are dark and soft. Tips are bright yellow-green. One blade differs little from the next.
- Near blades include wild flowers. A flower has a thin stem and a small head. The head has one of five colours.
- Far clumps get patches of flower colour at their tips.
- Dry grass (gold) uses darker roots so the field keeps depth.
- The grass writes alpha 0. Do not change this. The ink pass needs it.

## Clouds (`world.js`, `cloudTexture`)

- Each cloud is a soft sprite made on a canvas.
- The top is warm white. The lower half is cool blue-grey. The base fades out with no hard edge.
- Clouds have no rim line.

## Terrain and models

- The terrain uses a smooth two-band ramp (`softGradientMap` in `models.js`).
- Model toon materials get a warm rim light (`rim()` in `glb.js`). Outlines use the colour `0x4a3428`.

## How to check a change

1. Run the game from `public`: `python3 -m http.server 8765`.
2. Take screenshots at Low, Medium and High.
3. Run `PERF_PHONE=1 PERF_NOPROFILE=1 node perf.mjs low` in `qa/wild`. Compare triangles, draw calls and draw time with main at the same resolution ratio.
4. Open the browser console. There must be no shader errors.
