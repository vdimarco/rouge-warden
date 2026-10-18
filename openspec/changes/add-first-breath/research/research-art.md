# First Breath: research for art, game design and sound

Working id: `first-breath`. Route: `/first-breath/`. This file collects prior art for the design and the OpenSpec `design.md`.
AGENTS.md asks us to name the source we adapt for each rendering technique. The "Source to name in design.md" lines do that.

## 0. Short answer

- Draw the game in **one WebGL2 canvas with two main passes**. Pass 1 draws soft blob "splats" into a small field texture. Pass 2 is one full-screen shader that turns the field into membranes, cytoplasm, nuclei, warm womb light, caustics, glow and vignette. Particles, cilia and vessels are cheap extra draw calls on top.
- Render at an **adaptive internal resolution** and let CSS scale it up. The subject is soft, so a low internal resolution looks right. HUD text and buttons stay in the DOM at full sharpness.
- Use a **Canvas 2D fallback** that draws cached sprites. Do not draw many anti-aliased paths or full-screen gradients each frame. Primordia (`public/primordia/render.js`, `FieldRenderer` plus `FlatRenderer`) already uses this pattern.
- I measured the stack in this container's headless Chromium 141 with SwiftShader (see section A0). At 195x422 internal pixels, a frame with 32 blobs and 1,500 particles takes **about 7 ms**. That is fast enough for full-speed SwiftShader tests.
- Design: one verb across all stages, no death, a heartbeat that ties the stages together, an active egg, and a slow climb into white light at the end.
- Sound: put every source through one low-pass "womb" bus near 450 Hz. At birth, open the filter.

---

## A0. How I measured

- Environment: this container (4 vCPU), Playwright's Chromium 141 at `/opt/pw-browsers/chromium`, with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. `chrome://gpu` reports "Canvas: Hardware accelerated" and "WebGL2: Hardware accelerated", so **both WebGL and Canvas 2D run on SwiftShader** in tests.
- Method: each frame ends with `gl.readPixels(1px)` (WebGL) or one `getImageData(1px)` per 40 frames (2D). This forces the GPU work to finish, so the numbers are upper bounds. A real rAF loop overlaps CPU and GPU work.
- The benchmark pages (`bench6.html` for the recommended stack, `bench7.html` to `bench9.html` for the Canvas 2D tests, and `run.mjs` to run them) stayed in the design session's scratchpad. They are not in the repository. The tables below record their numbers.
- I did not run anything on a real phone. The phone costs below are estimates from pixel counts and per-pixel work. The design must define a frame-time check (A9) to confirm them.

| Test (SwiftShader, ms per frame) | 137x295 | 195x422 | 293x633 | 390x844 |
|---|---|---|---|---|
| Per-pixel SDF loop, 16 blobs, per-blob `atan`+`sin` wobble | 13.8 | 18.6 | – | 68.0 |
| Per-pixel SDF loop, 16 blobs, one domain warp for all | 5.2 | 9.4 | – | 35.8 |
| Splat field (half res) + threshold pass, 32 blobs | – | 4.3 | – | 13.6 |
| Splat field + threshold, 64 blobs | – | 4.9 | – | 14.5 |
| **Recommended 2-pass stack**, 32 blobs, 1,500 points, glow from mips | 6.8 (156x338) | **7.0** | 16.2 | 24.4 |
| Same stack, 4 passes (separate scene target and mip bloom) | 6.6 | 10.8 | 24.9 | 37.5 |

Same stack at other layouts: landscape 422x195 = 8.2 ms. Desktop 1440x900 at 0.35 scale (504x315) = 11.6 ms, at 0.5 scale (720x450) = 22.3 ms.

| Canvas 2D primitive (SwiftShader, full 390x844 canvas) | ms per frame |
|---|---|
| Flat `fillRect` of the whole canvas | 0.14 |
| Full-screen radial gradient `fillRect` (rebuilt or cached) | 8.6–9.1 |
| Pre-rendered background `drawImage` (scaled up from 1/4) | 3.5–3.8 |
| 16 blob sprites, 100 px, `lighter` | 0.23 |
| 300 particle sprites (`drawImage`) | 1.5 |
| 600 particle sprites | ~4.0 |
| 2,000 particle sprites | 16.1 |
| 300 particles as `fillRect` calls | 0.6 |
| 300 particles as one `rect` path + `fill` | 10.3 |
| 300 particles as one `arc` path + `fill` | 36.0 |
| One 24-point membrane path, fill + stroke | ~3.7 |
| Eight 64-point membrane paths, fill + stroke | 44.4 |
| Glow: downsample canvas x8, add back with `lighter` | ~5.7 |
| CPU metaball field (24 balls, 98x211 grid, `putImageData`) | 14.2 |

Rules from the tables:
1. In SwiftShader, cost scales with **pixels x passes**. The number of blobs matters little when you splat them.
2. Per-pixel loops over every blob with trig inside are the slowest choice.
3. In Canvas 2D, sprites (`drawImage`) are cheap. Full-screen gradients and many anti-aliased paths are expensive.

---

## Part A. Rendering techniques

For each technique: the source, what it does, the estimated cost on a mid phone (390x844 CSS px, DPR 2–3, an Adreno 6xx or Mali-G5x class GPU), and how to adapt it to WebGL2 and Canvas 2D.

### A1. Gooey cell membranes: metaballs and smooth union

**Sources**
- Inigo Quilez, "Smooth minimum" — https://iquilezles.org/articles/smin/ . This article lists exponential, root, sigmoid, quadratic, cubic, quartic and circular smooth minimums. With his normalization, `k` is the thickness of the blend in distance units. It also gives a version that returns a **blend factor** for mixing materials:
  ```glsl
  // quadratic polynomial; .x = distance, .y = blend factor for mixing two cells' colours
  vec2 smin(float a, float b, float k) {
    float h = 1.0 - min(abs(a - b) / (4.0 * k), 1.0);
    float w = h * h, m = w * 0.5, s = w * k;
    return (a < b) ? vec2(a - s, m) : vec2(b - s, 1.0 - m);
  }
  ```
- Jamie Wong, "Metaballs and Marching Squares" (2014) — https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/ . The field is `f(x,y) = Σ r_i² / ((x−x_i)² + (y−y_i)²)`, and the surface is where `f ≥ 1`. Marching squares sample a coarse grid and interpolate along cell edges. He notes that 40 balls on a 700x500 grid (about 14 M evaluations per frame) are too slow for JavaScript, which is why he used a coarse grid.
- Lucas Bebber, "Creative Gooey Effects", Codrops (2015) — https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/ . Blur the shapes, then raise the contrast of the alpha channel with an `feColorMatrix` (for example, the alpha row `0 0 0 18 -7`). Overlapping soft shapes then fuse into goo. This is the same idea as "splat then threshold".
- Quilez, "2D distance functions" — https://iquilezles.org/articles/distfunctions2d/ (circle, capsule and segment SDFs for villi and the egg's corona).

**What fits here.** Run "splat then threshold" on the GPU. That is Bebber's blur-and-contrast idea with Wong's summed field, and it uses Quilez's smin only where you need exact SDF blends (2–3 shapes, such as the player cell and the egg).
- Pass 1: draw one quad per blob into a half-resolution RGBA8 framebuffer with additive blending `gl.blendFunc(ONE, ONE)`. Use a compact falloff with finite support: `f = (1 − r²)³` for `r < 1`. Its cost is proportional to blob area, not pixels x blobs.
- Pass 2: in the full-screen shader, `d = (iso − f) * scale` gives a signed pseudo-distance. Then `inside = smoothstep(+e, −e, d)` and `rim = exp(−|d|·k)`.
- Pack channels: R = membrane field, G = nucleus field (a smaller second kernel per cell), B = vessels and heart mask, A = hue or cell id. Then one texture fetch gives everything.

**Mid-phone cost:** low. At 1.0x CSS (330k px) the splat pass touches about 80k px and the composite does a few texture taps per pixel. I estimate 1–3 ms (not measured on a phone). Use ≤ 32 blobs per stage, typically 8–24.

**Canvas 2D fallback.** Pre-render each cell as a layered radial sprite (bright rim ring, translucent body, darker nucleus) in 3–4 size buckets. Draw them with `globalCompositeOperation = 'lighter'`. Overlaps then glow and merge visually without a threshold (24 sprites ≈ 0.3 ms in SwiftShader). Do not threshold on the CPU (24 balls on a 98x211 grid took 14 ms here). Optional: put `filter: blur(6px) contrast(18)` (Bebber's trick as CSS) on a dedicated "goo" canvas element. CSS filters on an element work in Safari, but `CanvasRenderingContext2D.filter` is **off by default in Safari** (https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter), so never use `ctx.filter`. Measure the CSS route before you rely on it.

Source to name in design.md: "Splat-and-threshold metaballs after Wong (2014) and Bebber (Codrops 2015); exact smooth union and blend factor from Quilez, smin."

### A2. Soft membranes with wobble, translucent cytoplasm, nuclei

**Sources**
- Daniel Shiffman, Coding Train #36 "Blobby!" — https://thecodingtrain.com/challenges/36-blobby — and #136 "Polar Noise Loops" — https://thecodingtrain.com/challenges/136-polar-noise-loops . The radius of a circle is offset by noise sampled **along a circle in noise space**, so the outline closes without a seam: `r(θ,t) = R·(1 + a·noise(cos θ·f, sin θ·f, t))`.
- Stefan Gustavson, "Simplex noise demystified" (2005) — https://cgvr.cs.uni-bremen.de/teaching/cg_literatur/simplexnoise.pdf — and the MIT-licensed GLSL `webgl-noise` repository — https://github.com/stegu/webgl-noise .
- Beer–Lambert style absorption, `exp(−s·σ_t)`, as used for translucent materials in Simon Green, GPU Gems ch. 16 — https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering .

**Adaptation (WebGL2).**
- Wobble: warp the sample position once per pixel before reading the field: `uv += 0.006 * (noise2(p*14 + t*0.5) − 0.5)`. This bends every membrane with one noise lookup. Per-blob angular `sin`/`atan` was 2x slower in SwiftShader (A0 table).
- Use a baked, seeded 128x128 RGBA noise texture (built once at start from the game's seeded RNG). That is deterministic and cheap. In SwiftShader a texture tap and ALU value noise cost about the same, so pick the texture for determinism across GPUs.
- Cytoplasm: `opacity = 1 − exp(−σ·f)` uses the field value as "thickness". Thick centres are denser and redder, thin edges are clear. Membrane = `rim` (bright, warm white). Nucleus = `smoothstep(a, b, G)` with a darker violet-red tint and a small highlight offset toward the light.
- Mitosis (embryo stage): two blobs move apart while a third, small blob at the midpoint shrinks. The smooth field pinches into a figure-eight and then splits. This needs no special case.

**Canvas 2D fallback.** Cell sprites (A1) plus a slow sprite rotation and a non-uniform scale (`1 ± 0.04·sin`) give a cheap wobble. Draw only the **player's** membrane as a real path: ≤ 24 points, one fill and one stroke (≈ 3.7 ms in SwiftShader). Eight such paths cost 44 ms, so never draw paths for every cell.

**Mid-phone cost:** low (one noise tap per pixel in the composite).

### A3. Warm light through skin ("inside the womb"), vignette, cheap bloom

**Sources**
- Simon Green, "Real-Time Approximations to Subsurface Scattering", GPU Gems ch. 16 — https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering .
  - Wrap lighting: `max(0, (dot(L,N) + wrap) / (1 + wrap))`, with `wrap = 0.2`.
  - A red shift at the light-to-shadow edge: `scatter = smoothstep(0, scatterWidth, NdotL_wrap) * smoothstep(scatterWidth*2, scatterWidth, NdotL_wrap)`, with `scatterColor = (0.15, 0, 0)`.
  - Absorption by distance travelled, from depth maps: `exp(−s·σ_t)`.
- d'Eon and Luebke, "Advanced Techniques for Realistic Real-Time Skin Rendering", GPU Gems 3 ch. 14 — https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch14.html . The key line is "red light scatters much farther than green and blue". The skin diffusion profile is a sum of Gaussians that is widest in red.
- Barré-Brisebois and Bouchard, "Approximating Translucency for a Fast, Cheap and Convincing Subsurface-Scattering Look", GDC 2011 (Frostbite 2, Battlefield 3), explained by Alan Zucconi — https://www.alanzucconi.com/2017/08/30/fast-subsurface-scattering-1/ . The back-light term is `I = saturate(V · −(L + N·δ))^p · s`, and it is cheap and believable.
- Reid et al. 2017, *Current Biology*: third-trimester fetuses turned toward face-like patterns of light shone through the abdomen. Press summary: https://www.kqed.org/futureofyou/408449/fetuses-respond-to-face-like-patterns-study-suggests . This supports "light from outside gets brighter in the third trimester".
- Bloom:
  - Masaki Kawase's multi-pass blur (GDC 2003) and Marius Bjørge's "dual filtering" (Arm, SIGGRAPH 2015, "Bandwidth-Efficient Rendering"), summarized in Intel's "An Investigation of Fast Real-Time GPU-Based Image Blur Algorithms" — https://www.intel.com/content/www/us/en/developer/articles/technical/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms.html .
  - An Android OpenGL ES 3.1 benchmark found mip-based bloom fastest (10.3 ms), ahead of Kawase (11.5 ms) and Gaussian (14.1 ms) — https://etasr.com/index.php/ETASR/article/download/19101/6940 .

**Why light through skin looks red.** Tissue absorbs blue and green much more than red, so red light travels farthest (d'Eon). In 2D we have no normals or depth maps, so we fake "thickness":
- Define a scalar thickness `T(p)` per stage, for example distance to the nearest uterine wall, mapped so that thin wall = small T. Or bake a soft gradient texture.
- Transmitted light = `lightColor * exp(−σ * T)` with `σ = vec3(0.6, 2.2, 3.0)`, so red survives and blue dies. Add Green's red scatter band where the light term crosses about 0.2.
- Fake a normal for membranes from the field's gradient (`dFdx/dFdy` of the field, or two extra taps). Then apply Zucconi's back-light term with the "outside light" direction, so cells glow on the far rim, as if lit from behind.
- The stage's light intensity rises: dim and red in the early stages, warm amber in the third trimester, white at birth.

**Vignette:** multiply by `1 − dot(v,v)·1.3` in the final pass (free). In the fallback, use a CSS `radial-gradient` overlay `<div>` (free; costs no canvas time).

**Cheap bloom (recommended):** sample the **field texture's mip chain** (`textureLod(field, uv, 3.0)`) and add it, tinted, as glow. Glow then follows the cells, the heart and the vessels with no extra full-screen pass. This is the "2-pass stack" in A0 (7.0 ms at 195x422 in SwiftShader). In WebGL2, `generateMipmap` works on non-power-of-two textures. In WebGL1 it does not, which is one reason to require WebGL2 or Canvas 2D. Use dual Kawase only if the art needs a wider, scene-wide glow (+1 render target, +2–4 small passes).

**Canvas 2D bloom:** draw the canvas into a 1/8-size canvas, then draw that back stretched with `lighter` and `globalAlpha ≈ 0.35` (≈ 5.7 ms in SwiftShader). Bilinear upscaling is the blur.

**Mid-phone cost:** low for all of the above (a few ALU ops and one mip tap per pixel).

Source to name in design.md: "Translucency after Green (GPU Gems ch. 16), d'Eon and Luebke (GPU Gems 3 ch. 14), and Barré-Brisebois and Bouchard (GDC 2011); glow from mip sampling (benchmarked faster than Kawase on mobile)."

### A4. Flow fields and curl noise (drifting particles, fluid currents, rheotaxis)

**Sources**
- Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow", SIGGRAPH 2007 — https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf .
  - 2D: `v = (∂ψ/∂y, −∂ψ/∂x)`. The field is divergence-free (no sinks or "gutters"), so particles never clump or vanish.
  - Walls: multiply ψ by `ramp(d(x)/d0)`, where `d` is the distance to the wall, `d0 ≈` the noise length scale, and `ramp(r) = 15/8·r − 10/8·r³ + 3/8·r⁵` for |r| < 1 (±1 outside). Flow then slides along walls and never enters them.
  - Add a laminar term (ψ = U·y gives a steady current along x), vortices, and moving bodies (rigid-motion potential blended by distance).
- Gustavson and McEwan, "Tiling simplex flow noise in two and three dimensions", JCGT 11(1), 2022 — https://jcgt.org/published/0011/01/02/ . `psrdnoise` returns the **analytic gradient**, so curl costs no extra noise calls, and the gradients can rotate ("flow noise") for swirling motion. MIT-licensed GLSL is in `webgl-noise`.
- Craig Reynolds, "Steering Behaviors for Autonomous Characters", GDC 1999 — https://www.red3d.com/cwr/steer/gdc99/ (seek, flee, wander, separation, flow-field following). Daniel Shiffman, *The Nature of Code*, "Autonomous Agents" — https://natureofcode.com/autonomous-agents/ .
- Biology hooks: sperm reach the egg by **rheotaxis** (swimming against the flow), **thermotaxis** (toward warmth) and **chemotaxis** (toward the egg's chemical signal) — Eisenbach and Giojalas; see the 2015 review https://pmc.ncbi.nlm.nih.gov/articles/PMC4492055 and https://www.weizmann.ac.il/Biomolecular_Sciences/eisenbach/ .

**Adaptation.**
- Gameplay motion (player, rival sperm, the egg's drift, nutrients) lives in `core/`. Use a deterministic value or simplex noise with seeded permutation tables, curl by central differences (4 noise evaluations), and Bridson's ramp for the tube walls. The current runs **toward** the uterus, and the player swims against it (rheotaxis as the core feel of stage 1).
- Rivals use Reynolds steering: wander + seek(egg scent gradient) + separation + flow following. Use 20–60 rivals, simulated in core and cheap.
- Decorative particles (floating debris, amniotic motes) live in `render/` with their own seeded stream. On the CPU: 1,000–1,500 particles advected by the same curl field. Upload a `Float32Array` with `bufferSubData` each frame (12 KB) and draw as `gl.POINTS` with additive blending. This is included in the 7 ms SwiftShader figure.
- Canvas 2D fallback: ≤ 300 particles as `drawImage` sprites (≈ 1.5 ms). Never use `arc` paths (300 arcs = 36 ms).
- Not recommended: a real Navier–Stokes solver (Stam's Stable Fluids; Pavel Dobryakov's WebGL fluid demo, MIT, whose forks default to a 128 sim grid and a 1024 dye grid). It needs float render targets and many passes, which is too heavy for SwiftShader and a mid phone together. Curl noise gives the look for a fraction of the cost.

**Mid-phone cost:** CPU about 0.3–0.6 ms for 1,500 particles (estimate), GPU negligible.

### A5. Cilia and villi; branching growth for the placenta's villous tree and vessels

**Sources**
- Metachronal waves: neighbouring cilia beat with a small phase lag, and the travelling wave moves fluid better than synchronous beating (review: https://pmc.ncbi.nlm.nih.gov/articles/PMC11044847). Human fallopian-tube cilia beat at about 3.2 ± 1.6 Hz (optical coherence tomography, SPIE 2023, DOI 10.1117/12.2656886).
- Runions et al., "Modeling and visualization of leaf venation patterns", SIGGRAPH 2005 — https://www.algorithmicbotany.org/papers/venation.sig2005.html . This is the 2D open and closed venation model, so it fits a 2D placenta well.
- Runions, Lane and Prusinkiewicz, "Modeling Trees with a Space Colonization Algorithm", 2007 — https://www.algorithmicbotany.org/papers/colonization.egwnp2007.html . The algorithm, from the paper:
  1. Scatter N attraction points in the target region.
  2. Each point influences only its closest node, and only if that node is within the radius of influence `d_i`.
  3. Each influenced node `v` grows a new node `v' = v + D·n̂`, where `n̂` is the normalized sum of unit vectors toward its points. An optional bias `g` can be added.
  4. Remove points closer than the kill distance `d_k` to any node.
  5. Repeat until no points remain or none are in range.

  The paper's figures use N = 375–12,000 and `d_k` = 2D–20D. Fewer points with a larger `d_k` give sparser, straighter branches. A smaller `d_i` gives wiggly, "gnarly" branches.
- Prusinkiewicz and Lindenmayer, *The Algorithmic Beauty of Plants* (L-systems) — https://algorithmicbotany.org/papers/abop/abop.pdf . Use it if you need exact, rule-based branch shapes (for example a stylized umbilical spiral). Space colonization reacts better to free space, so prefer it.
- Placental anatomy: stem villi branch from the chorionic plate into intermediate villi and then terminal villi with capillary loops. Terminal villi make up about 40% of villous volume near term — https://embryology.ch/old/anglais/fplacenta/villosite07.html .

**Adaptation.**
- **Cilia (fallopian tube, stage 2):** use one static vertex buffer of K cilia x 4 segments as a quad strip. The vertex shader bends each cilium: `angle_j = base + A · (j/S)² · sin(ω·t − k·i)` (bend grows toward the tip; `k` is the phase lag between neighbours). Draw them all in one call, with no CPU work. Slow ω to about 1 Hz on screen (real ≈ 3 Hz) so it reads calm. The cilia's wave pushes the egg along the tube, so the egg drifts on its own.
- Canvas 2D fallback: pre-render an 8-frame flipbook of a 256 px cilia strip and tile it along the wall with `drawImage` (cheap). Do not stroke cilia paths each frame.
- **Villi (uterine wall for implantation, chorionic villi):** use capsule SDFs smooth-unioned in the composite shader, or sprites in the fallback.
- **Placenta (stage 4) as gameplay:** run space colonization in `core/` with seeded attraction points inside the placental disc and roots at the cord insertion. Use N ≈ 300–600, D ≈ 6 px (in world units), `d_i` ≈ 8D and `d_k` ≈ 2D. Grow 1–3 iterations per fixed step, so the tree visibly grows while the player steers nutrients into its tips.
  - Cost: naive O(points x nodes) per iteration, under 1 ms in JavaScript at these sizes. Add a uniform grid if N > 1,000.
  - Width by the pipe model: `w_parent^n = Σ w_child^n`, with n ≈ 2–3. Runions uses the pipe model.
  - Draw the grown tree into a cached texture or offscreen canvas only when it changes. Each frame, draw only the cached image plus a moving pulse (A6).
  - Arteries red and veins violet-blue, as a hue shift in the vessel channel.

**Mid-phone cost:** low (one draw call for cilia; a cached vessel tree).

Source to name in design.md: "Villous tree by space colonization (Runions et al. 2005, 2007); cilia as a vertex-shader metachronal wave."

### A6. A beating heart and pulsing vessels

**Sources**
- The embryonic heart tube forms and starts to beat at about **day 22** after fertilization (about 5 weeks gestational age). Circulation follows by days 27–29 — https://discovery.lifemapsc.com/library/review-of-medical-embryology/chapter-114-development-of-the-heart-cardiac-tube-development .
- Fetal heart rate over pregnancy: about 110 bpm at 5–6 weeks, **170 bpm at 9–10 weeks**, 150 at 14, 140 at 20, and 130 at term (*Heart* (BMJ) 2007; 93:1294, https://heart.bmj.com/content/93/10/1294). The usual "normal" band is 110–160 bpm, which is partly expert opinion (PeerJ 2013, https://peerj.com/articles/82).
- W3C WCAG 2.2, SC 2.3.1 "Three Flashes or Below Threshold" — https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html (no more than three flashes in any one second, with a stricter red-flash rule).

**Adaptation.**
- There are two rhythms, and they are the backbone of the whole game:
  - The **mother's** heartbeat, 72–84 bpm, drives the walls, the placenta's glow and the "whoosh" (C3).
  - The **baby's own** heart appears in stage 5 and follows the BMJ curve by stage: about 110 → 170 → 150 → 140 → 130.
- Visual pulse = **one** smooth swell per beat: `pulse(φ) = exp(−((φ − 0.08)/0.06)²)`, where φ is the beat phase 0..1. Do **not** flash for both "lub" and "dub" (two flashes per beat at 140 bpm is 4.7 per second, which breaks the WCAG three-per-second rule). Keep the luminance change under 10% of the frame, and keep saturated red swings small.
- Vessels: the brightness or width of each vessel vertex follows `pulse(φ − s/c)`, where `s` is the arc length from the heart (or the cord root) and `c` the wave speed. Store `s` as a vertex attribute so the wave travels down every branch for free.
- Heart: a small two-lobed SDF that scales by `1 + 0.08·pulse` with a quick contraction (systole about 35% of the beat). In 2D, the cached heart sprite scales the same way.
- Reduced motion: halve the amplitude, keep the phase (the rhythm still informs play), and drop the scale bounce.

### A7. Fluid caustics (amniotic fluid, third trimester)

**Sources**
- Evan Wallace, "Rendering Realtime Caustics in WebGL" (2016) — https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c — and the WebGL Water demo, https://madebyevan.com/webgl-water . It approximates the light wavefront with a mesh and uses screen-space derivatives. It is physical, but needs float textures and a mesh pass, so it is too heavy here.
- Alan Zucconi, "Believable Caustics Reflections" (2019) — https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/ . Take **one tileable caustic texture** and sample it **twice** with different scale, offset and speed. Combine with **`min`** (averaging looks wrong), and offset R, G and B slightly for a chromatic split.
- Inigo Quilez, "Voronoi edges" — https://iquilezles.org/articles/voronoilines/ (exact distance to Voronoi cell borders, which gives caustic-like networks of bright lines).
- Licence warning: Shadertoy shaders default to **CC BY-NC-SA 3.0** unless the author says otherwise. Godot ports of the "tileable water caustic" shader (shadertoy.com/view/MdlXz8) note this, for example https://godotshaders.com/shader/water-caustic/ . Do not paste Shadertoy code into the repo. Adapt the idea only.

**Adaptation.** At start, generate a seeded, tileable 128² (or 256²) caustic texture in JS: the Voronoi edge distance on a wrapped grid, `c = pow(1 − smoothstep(0, w, edgeDist), 3)`. In the composite: `caus = min(tex(uv*1.0 + t*v1), tex(uv*1.3 − t*v2))`, then scale by the stage's outside-light level and by the A3 transmittance (so caustics are warm). In Canvas 2D, `globalCompositeOperation = 'darken'` is a per-channel **min**, so two `createPattern` fills with `'darken'` reproduce Zucconi's trick. Measure it before use; it is probably 2 full-screen fills, about 4–8 ms in SwiftShader, so it may only fit at 0.5 internal scale.

**Mid-phone cost:** low (2 texture taps).

### A8. "Birth into light": a bloom-to-white transition

**Sources**
- Jenova Chen's GDC 2013 talk "Designing Journey" — https://gdcvault.com/play/1017700/Designing . Journey's ending is a collapse in the snow, then a flight to the summit into bright light (https://en.wikipedia.org/wiki/Journey_(2012_video_game)). The team added animations in the snow so the player feels weaker before the final release (Destructoid on Chen's D.I.C.E. talk, https://destructoid.com/?p=118816).
- WCAG 2.3.1 (above). A slow ramp to white is safe, and a sudden full-screen white flash is not ideal.

**Adaptation (one uniform, `uWhite`, plus `uExposure`).**
1. The squeeze (end of the birth stage): narrow vignette, darker, heartbeat louder, pressure (scale the walls inward).
2. Release: over about 2 s, `exposure` goes 1 → 6, `col = col*exposure; col = col/(1+col)` (Reinhard-style roll-off keeps colour), and the glow lod grows (3 → 5). Then `uWhite` 0 → 1 with a smoothstep over about 1 s. At the same time the sound's low-pass opens (C5).
3. Hold white for 0.5 s, then fade to a soft final image: a blurred warm room and a face shape, in silhouette. Show the title and the run's score in the DOM.
4. Reduced motion: a plain 1.5 s crossfade to white, with no exposure pumping and no glow growth.
- Check: mean frame luminance rises monotonically during the transition and reaches ≥ 0.95. Luminance never drops by more than 10% inside any 1 s window (no flash).

### A9. Recommended stack (concrete)

**Layers (DOM order).**
1. `<canvas id="view">` WebGL2, fixed full-screen, CSS size = viewport, backing size = internal resolution. `alpha:false`, `antialias:false`, `preserveDrawingBuffer:false`.
2. `<div class="vignette">` (used by the 2D fallback only) and an optional `<div class="white">` for the final hold.
3. DOM HUD: "‹ Arcade" link, "Switch game" (`data-switch`), pause, mute, stage label, score. All tap targets ≥ 44 px on the shorter side, inside `env(safe-area-inset-*)`.

**Passes per frame (WebGL2).**
1. **Field splat** → RGBA8 FBO at ½ internal resolution, additive. ≤ 32 blob quads per stage (typically 8–24). Channels: R membrane, G nucleus, B vessel and heart mask, A hue. Then `generateMipmap`.
2. **Composite** (full-screen triangle at internal res, `precision mediump float`):
   - womb background from 2 taps of the baked noise texture
   - A3 transmittance light and red scatter
   - A1/A2 membranes (threshold, rim, nucleus, cytoplasm absorption)
   - A7 caustics (2 taps, stages 6–7)
   - glow from field mip lod 3
   - A6 heartbeat tint (≤ 10%)
   - vignette
   - A8 exposure and white mix
3. **Overlays** (additive, same target): particles as `gl.POINTS` (≤ 1,500 high, ≤ 600 low), cilia strip (one draw), vessel lines from the cached tree (one draw), heart sprite.

**Internal resolution.**
- Start: phones at **1.0 x CSS pixels** (≈ 330k px at 390x844, ignore DPR beyond 1). Desktop capped at **0.6 MP** (for example 1440x900 → scale ≈ 0.68).
- Adaptive control: take an exponential moving average of the frame time. Step down through scales `[1, 0.8, 0.66, 0.5, 0.4, 0.35]` when the EMA > 20 ms for 30 frames. Step up when it is < 12 ms for 120 frames. Never go below 0.35. Keep the gameplay step fixed (as in `ahead-of-the-light/main.js`). Only rendering scales.
- SwiftShader expectation from A0: it settles near 0.5 (≈ 80–120k px), about 7–11 ms per frame.
- Test hook: `?res=0.5` pins the scale, and `window.__fb.perf` reports `{ emaMs, scale, w, h, fallback }`.
- Keep `uTime` wrapped (for example mod 1,000 s) so `sin(t)` stays precise in mediump. Chrome's guidance is to prefer `mediump` in fragment shaders — https://developer.chrome.com/blog/use-mediump-precision-in-webgl-when-possible ; https://webglfundamentals.org/webgl/lessons/webgl-qna-when-to-choose-highp--mediump--lowp-in-shaders.html .

**Fallback rules.** Use the Canvas 2D `FlatRenderer` if `getContext('webgl2')` returns null, a shader fails to compile or link, or the context is lost twice. `?gl=0` forces it, for tests. This is the same pattern as Primordia. I recommend skipping a WebGL1 path: it adds power-of-two mipmap limits and a second shader dialect for few users.

Fallback recipe, at 0.5 internal scale, CSS-scaled:
- background pre-rendered at ¼ res (3.5 ms in SwiftShader)
- cell sprites with `lighter` (0.3 ms)
- ≤ 300 particle sprites (1.5 ms)
- one player membrane path (3.7 ms)
- x8 glow (≈ 5 ms; drop it if the frame time is > 20 ms)
- CSS vignette (free)

Expected ≈ 15–20 ms in SwiftShader. Avoid full-screen gradients each frame, `arc` batches, many paths, `shadowBlur` and `ctx.filter` (MDN, "Optimizing canvas": https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).

**Test browser.** Since Chrome 130 the automatic SwiftShader fallback for WebGL is deprecated, and from M139 context creation fails instead of falling back. Tests must pass `--enable-unsafe-swiftshader` with `--use-gl=angle --use-angle=swiftshader` (Chromium docs: https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md ; Samsung policy note: https://developer.samsung.com/browser/policy/enable-unsafe-swift-shader.html). The repo's `qa/primordia/smoke.e2e.mjs` and `qa/vr/*.mjs` already do this.

**Concrete visual and performance checks (for specs).**
- *Frame time:* in SwiftShader, after 3 s settling, `__fb.perf.emaMs ≤ 16.7` and `scale ≥ 0.35` in portrait 390x844, landscape 844x390 and desktop 1440x900. Run once with `?gl=0` and assert that the fallback renders (non-black, centre pixel brighter than corners).
- *Membrane look:* screenshot a frozen frame (`?seed=1&freeze=1` hook). The pixel at a cell's centre is redder than the background. The rim ring around it is the brightest band within 20 px.
- *Flash safety:* sample mean luminance every frame for 5 s in stages 5–7. No more than 3 luminance swings ≥ 10% in any 1 s window.
- *Birth light:* luminance is monotonic during the transition and ends ≥ 0.95.
- *Reduced motion:* with `prefers-reduced-motion: reduce` emulated, the membrane warp amplitude uniform is ≤ 50% of normal and no scale bounce is applied.

---

## Part B. Game references

### B1. flOw (thatgamecompany; Flash 2006, PS3 2007) and Jenova Chen's thesis
- **What:** you steer a microorganism that eats smaller ones and grows. The world is stacked 2D planes, and you can dive deeper or rise at any time. **Losing a fight does not kill you. You float up a plane.** Growth shows on the creature as new lit segments. Sources: https://en.wikipedia.org/wiki/Flow_(video_game) ; GamesRadar review https://www.gamesradar.com/flow-ps3-network-review/ .
- **Thesis:** Chen's MFA thesis at USC's Interactive Media Division (2006) is on flow and dynamic difficulty adjustment. The site is https://www.jenovachen.com/flowingames/ . His companion essay is "Flow in Games (and Everything Else)", *Communications of the ACM*, 2007. Chen calls his approach "active" DDA: players pick their own challenge through the core verbs (swim and eat), so the choice never pulls them out of play (GameDev.net interview, https://gamedev.net/articles/industry/interviews/notes-on-gamedev-jenova-chen-r3061/).
- **Did well:** one verb, no fail screen, visible growth, player-chosen depth as difficulty, calm audio-reactive look.
- **Did badly:** "not much to do besides eat and grow" (reviews). It is thin across a long session.

### B2. Osmos (Hemisphere Games, 2009)
- **What:** you absorb smaller motes and avoid larger ones. You move by **ejecting your own mass**, which shrinks you (Newton's third law). Ambient music; Apple Design Award. Sources: https://en.wikipedia.org/wiki/Osmos ; GDC "Minimalist Game Design: Growing OSMOS", https://gdcvault.com/play/1012298/ .
- **Did well:** one elegant rule that creates risk (moving costs size), relaxing tone, a size-based camera.
- **Did badly:** fast momentum is hard to steer (reviewers). Levels look alike.
- **Lesson for one-thumb phones:** use direct steering with soft inertia, not Osmos-style recoil, for the main verb. Keep "spend size to dash" as an optional skill.

### B3. Spore, cell stage (Maxis, 2008)
- **What:** a short Pac-Man-like eat-and-grow stage. Your **diet carries forward**: carnivore, herbivore or omnivore sets a special ability in the creature stage (https://strategywiki.org/wiki/Spore/Cell_Stage ; https://spore.fandom.com/wiki/Diet).
- **Did well:** the cell stage was kept short on purpose ("nobody would want to play as a cell for very long"), and the feedback loop is clear.
- **Did badly:** critics called Spore "five mini-games stitched together", and each stage was simplified to "a handful of mouse-clicks" (bit-tech retrospective, https://bit-tech.net/features/gaming/pc/10-years-on-spore/1/). **This is the main risk for a 7-stage game.**

### B4. Journey (thatgamecompany, 2012)
- **What:** an emotional arc with no words. Chen cites Joseph Campbell's *Hero's Journey*, and *Koyaanisqatsi* as proof that an arc needs no plot or dialogue (Engadget Q&A, https://www.engadget.com/2012-11-07-hit-list-qanda-jenova-chen-thatgamecompany-president.html). Prototyping began from the music. The ending is the weakest moment (collapse in the snow), then a flight into light. Talk: https://gdcvault.com/play/1017700/Designing .
- **Lesson:** shape the stages as one curve with a low point just before the release (labour), then light.

### B5. WarioWare and Rhythm Heaven (Nintendo): how an anthology holds together
- **WarioWare:** microgames last a few seconds and give **one-word commands**. Ideas began as "a picture … and a single word: 'Pick!'". Goro Abe: controls must be grasped instantly, and a game should be beatable on the 2nd or 3rd try. In *Smooth Moves*, making games too different "just made the player confused" (Iwata Asks, https://iwataasks.nintendo.com/interviews/wii/warioware_smooth_moves/0/2 ; GoNintendo summary https://gonintendo.com/contents/30326-nintendo-on-how-to-make-a-great-warioware-microgame-says-over-1-000-ideas-were).
- **Rhythm Heaven:** each game is about 30 s long and has a short tutorial first. Every game is cued by **both sound and visuals**. Every fifth stage is a **remix** of the previous four with new graphics. Reviewers praise remixes that give old games one new visual spin and criticize later ones that are "just mashups" (Joystiq review, https://www.engadget.com/2009-03-25-joystiq-review-rhythm-heaven.html).
- **Lesson:** a shared verb, a shared audio pulse, short teach-then-test, and a finale that remixes earlier verbs in one new frame.

### B6. Before Your Eyes (GoodbyeWorld Games, 2021)
- **What:** you replay one life from infancy to death, and you move forward by **blinking** (webcam). Designers added a metronome "blink counter" so players know when a blink will skip ahead, and a mouse-click fallback (TheGamer, https://www.thegamer.com/before-your-eyes-interview-blink/ ; Pocket-lint, https://www.pocket-lint.com/games/news/156365-before-your-eyes-blinking-game-goodbye-world-interview). It began as Will Hellwarth's USC thesis.
- **Did well:** an unusual input that maps to the theme, an always-available fallback, and a strong emotional arc about a whole life.
- **Lesson:** if we add tilt or "breath" inputs, always keep a touch and keyboard fallback, and show a timing cue (a heartbeat ring) before input windows.

### B7. Existing games about conception, pregnancy or birth

| Game | What it does | Good | Bad / tone problem |
|---|---|---|---|
| **iSperm** (Mobigem, 2009, iPhone) | Tilt and shake to guide a sperm down a tube | Simple tilt control | Novelty; joke framing (https://www.discovermagazine.com/from-ifart-to-isperm-apple-apps-go-highbrow-28440) |
| **Seed and Egg / Sperm vs Egg** (Ryo Shirakawa, iOS) | **You are the egg**; dodge viruses and collect sperm; runs of about 10 s | Role flip; tight short runs | Comic sci-fi framing (https://soranews24.com/2013/12/03/everything-you-need-to-know-about-the-birds-and-the-bees-packed-into-one-video-game/) |
| **The Great Sperm Race** (2009, browser) | Race past acid, immune cells and rivals | Uses real obstacles | Race-only frame |
| **Spermania: The Race for Life** (PinchPoint, Android) | Flappy-style dodging | — | "Dull", "not at all educational", cynical lives system (Progress Educational Trust review, https://www.progress.org.uk/game-review-spermania-the-race-for-life/) |
| **Spermination** (phr00t, 2015, Steam) | Procedural uterus, laser and torpedo race-shooter | Procedural runs | Crude look; violence framing (https://store.steampowered.com/app/363460/ ; Multiplayer.it review) |
| **Born Race** (2021, Steam) | Four sperm, puzzle platforming, bosses are viruses and **contraceptives** | 96% positive; finalist at SBGames | Stereotyped cast (cheerleader, nurse); contraception as villain is a value statement to avoid (https://store.steampowered.com/app/1447330/Born_Race) |
| **Become** (2026, Steam, upcoming) | Third-person adventure as a sperm, "mature themes", "humorous references" | — | Leans on innuendo (https://playday.one/2026/02/15/play-as-sperm-in-become-coming-to-pc-via-steam-in-2026/) |
| **Abortion Boy** (Ludum Dare 43 jam) | A fetus escapes a surgeon's hand in a procedural uterus | — | Gore, and it puts a political conflict at the centre; this is the clearest example of what to avoid (https://sixrobin.itch.io/abortion-boy) |
| **Mommy Tummy** (2011, serious game with a sensor suit) | Men feel pregnancy; the virtual fetus reacts to movement | Empathy aim | Hardware-bound |
| **Pregnant Mother Simulator** (2025, browser) | You play the mother through routines | Mother's point of view | Chore-sim framing |
| **Who's Your Daddy** (2015) | Post-birth: a baby tries to hurt itself, a father stops it | Slapstick that the art defuses | "Bumbling father" trope; deaths of an infant as comedy (https://kotaku.com/whos-your-daddy-as-told-by-steam-reviews-1754499507) |
| **Conception II** (Spike Chunsoft and Atlus, 2014) | JRPG where you "classmate" to make Star Children | Distinct system | Innuendo reviewers called "unsettling" and misogynistic (Game Revolution, https://www.gamerevolution.com/review/63780-conception-ii-children-of-the-seven-stars-review) |

**Visual reference with a warning.** Lennart Nilsson's *A Child Is Born* (1965, first shown in *Life*) shaped how the public pictures life before birth. Its images have since been widely used in abortion debates (https://en.wikipedia.org/wiki/A_Child_Is_Born_(book)). Use it for the feel (warm translucence, floating calm). Do not copy its compositions, and avoid poster-like fetus portraits that read as political.

**Science framing.**
- Emily Martin, "The Egg and the Sperm: How Science Has Constructed a Romance Based on Stereotypical Male-Female Roles", *Signs* 16(3), 1991 — https://web.stanford.edu/~eckert/PDF/Martin1991.pdf . Textbooks cast the egg as passive and the sperm as heroic.
- Fitzpatrick et al. 2020, *Proc. R. Soc. B* 287:20200805 (https://royalsocietypublishing.org/doi/10.1098/rspb.2020.0805): follicular fluid attracts some men's sperm more than others ("cryptic female choice").
- Together with the guidance research in A4, this supports an **active egg** that signals, guides and chooses.

### B8. Design lessons for a 7-stage game from sperm and egg to birth

1. **One verb, one thumb, every stage.** Drag to steer, with one secondary action (tap or hold) that each stage reinterprets: dash, latch, divide, root, grow, kick, push. flOw and WarioWare show that a shared verb is what holds an anthology together. Controls must be clear at once, and each stage beatable on the 2nd or 3rd try (Abe).
2. **Teach in play, in under 10 s, with one or two words.** For example "Swim up.", "Catch the egg.", "Split.", "Grow roots.", "Feel the beat.", "Turn.", "Push." Rhythm Heaven shows a short tutorial before each test. No text walls.
3. **Carry something forward, so it is one journey and not stitched mini-games.** Spore's diet carry-over and flOw's visible growth both do this. Ideas: the colour and spark you collect as a sperm becomes the embryo's hue, nutrient score becomes placenta size, and the placenta size sets later stamina. Use one continuous camera that zooms out as you grow (Osmos and flOw scale): cell → embryo → baby, so stage changes feel like growth, not cuts.
4. **No death. Never show loss.** flOw floats you up a layer instead of killing you. Failure here means drifting back, slowing down, or a softer score, and the stage always completes. Do not show, imply or score anything that reads as miscarriage, harm to the baby, or the mother in danger. Rival sperm "drift away" and are not killed.
5. **Make the egg active.** Martin (1991) and Fitzpatrick (2020) support this, and so does the guidance biology (warmth, flow, chemical trail). The egg sends a scent trail you follow, the cilia carry it, and its corona "opens" for the player. This avoids the stale "fastest sperm wins" race that reviewers called dull.
6. **Player-chosen challenge inside the core verb (Chen's active DDA).** The main path is always passable. Optional risk (nutrient motes near currents, perfect beat timing, tight gaps) raises the score. Add an "assist" toggle that widens timing windows.
7. **Two heartbeats as the game's metronome.** The mother's slow beat is there from stage 1. The baby's faster heart joins in stage 5 (heart starts at about day 22) and follows the real rate curve. Timed inputs on the beat earn a bonus (Rhythm Heaven's audio-visual cue). A pulse ring, like the Before Your Eyes blink counter, shows the next window.
8. **Short stages, short session.** Each stage lasts 60–120 s, and a full run about 10–14 min. Spore kept the cell stage short on purpose, and WarioWare stays snappy. After the first clear, unlock stage select and best scores per stage.
9. **A remix finale.** Birth reuses earlier verbs in one new frame: steer down a narrowing channel (stage 1), time pushes to contractions (stage 5 heartbeat), turn head-down (stage 7). This is a Rhythm Heaven remix, but make it one new scene, not a mashup.
10. **One emotional curve with a low point before the light.** Calm wonder, then busy growth, then warm and drowsy (third trimester), then the squeeze (the hardest, darkest moment), then release into white and the first breath. Journey's arc ends the same way, and sound tells the story too (C5).
11. **Tone: gentle, warm, wordless, and a little playful.** No sex or innuendo: start inside the body, after ovulation, with no depiction of intercourse (Conception II, Become). No politics: no abortion, contraception-as-enemy or "personhood" framing (Abortion Boy, Born Race bosses, Nilsson's later use). No gross-out, no stereotypes such as "bumbling dad" or gendered rival personalities (Who's Your Daddy, Born Race). The mother is never an obstacle or an enemy.
12. **Facts as small rewards, not quizzes.** After each stage, show one short, plain, checked line, for example "Day 22. Your heart beats for the first time." or "Week 25. You can hear her voice." The "educational" label without content was the main complaint about Spermania. Keep each line one sentence and medically neutral.

---

## Part C. Audio: a muffled womb soundscape in WebAudio

### C1. What the womb sounds like (sources)
- Gerhardt and Abrams, *Journal of Perinatology* 2000 (https://www.nature.com/articles/7200445 and companion https://www.nature.com/articles/7200446):
  - Sound reaches the fetal inner ear mostly by bone conduction.
  - Energy **above 0.5 kHz is attenuated by 40–50 dB**.
  - In-utero sound is **dominated by frequencies below about 300 Hz** (maternal heart and blood, breathing, gut).
  - Vowels pass, but consonants are largely lost.
  - Music's rhythm likely passes, but its overtones do not.
  - Newborns prefer their mother's voice.
  - In sheep, speech recorded at the fetal inner ear was about 26% less intelligible.
- Querleu et al. (1981, 1988), via secondary reviews: a 20 Hz tone loses about 2 dB and a 1 kHz tone about 20 dB. The **mother's voice is louder inside** (about 52 dB) than other voices (about 40 dB), because it also travels through her body. Hydrophone studies put the background around 50–60 dB, but sources vary.
- Hearing develops in the second half of pregnancy. Responses to vibration come earlier, and a functional auditory system is most often cited at about 24–26 weeks (secondary sources; treat as approximate).
- **Uterine souffle:** a soft, blowing sound in time with the **mother's** pulse, from blood rushing through the uterine vessels. **Funic souffle:** a sharper whistling in time with the **fetal** pulse (https://en.wikipedia.org/wiki/Souffle_(heart_sound)).
- Heart sounds: S1 ("lub") about 25–45 Hz, about 0.10–0.15 s. S2 ("dub") about 50 Hz, about 0.11–0.12 s. S2 follows S1 at about 0.2–0.55 of the beat period (phonocardiography teaching sources; values vary with method).
- Maternal resting heart rate rises about 10–20 bpm in pregnancy. Consumer sources give 80–100 bpm, but that sourcing is weak. Use 72–84 bpm for calm.
- Fetal heart rate by week: as in A6 (BMJ *Heart* 2007).

### C2. Graph (one context, built on the first tap, then only steered)
Follow the repo pattern in `public/ahead-of-the-light/ui/sound.js`: the graph is built once on the first tap, voices run from the start and are shaped by gain and filter automation, and the mute key is `localStorage "arcade.sound"`. Set `navigator.audioSession.type = 'playback'` where it exists. `quiet.js` suspends the context when the page is hidden. Create or resume the context only inside a user gesture (MDN Web Audio best practices, https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

```
sources ─┬─ maternalHeart (2 persistent sines + noise click) ─┐
         ├─ souffle (looped pink/brown noise → bandpass) ─────┤
         ├─ voiceHum (sawtooth → 2 formant bandpasses) ───────┼─► wombBus: lowpass 450 Hz Q0.7
         ├─ fetalHeart (stage ≥ 5) ───────────────────────────┤          → lowpass 450 Hz Q0.5 (≈ 24 dB/oct)
         └─ gameplay one-shots (soft plucks, swells) ─────────┘          → gain → compressor → master(mute) → out
birthBus (outside world: room tone, breath, cry) ──────────────────────────────► master (silent until birth)
```

- **Maternal heartbeat ("lub-dub", 72–84 bpm).**
  - Use two persistent sine oscillators: S1 near 42 Hz sliding to 32 Hz, and S2 near 58 Hz sliding to 48 Hz, each with its own gain envelope (attack 6–10 ms, exponential decay 90 ms for S1 and 70 ms for S2). S2 is about 0.6x as loud and starts `min(0.33 s, 0.40·T)` after S1, where T is the beat period.
  - Add a short low-noise "thump" (white noise → bandpass 80 Hz, Q 1, 25 ms) on S1 for attack.
  - **Phone speakers roll off below about 150–200 Hz**, so also add a quiet 2nd and 3rd harmonic (or a 120–180 Hz bandpassed click). The ear then infers the low beat (missing fundamental, https://en.wikipedia.org/wiki/Missing_fundamental). Without this, the heartbeat vanishes on phones.
  - Keep a ±3% beat-to-beat jitter from a seeded stream (a real pulse is not a metronome), and raise the rate slightly during exertion moments.
- **Whoosh of blood (uterine souffle).**
  - Build a 4 s looped noise buffer once. Use pink noise from Paul Kellet's filter (https://www.firstpr.com.au/dsp/pink-noise/ ; refined coefficients start `b0 = 0.99886·b0 + white·0.0555179`) or brown noise (`b = (b + 0.02·white)/1.02`). Seed the white noise for determinism.
  - Chain: buffer → bandpass 180 Hz (Q 0.8) → gain.
  - On each maternal S1, ramp the gain up over 120 ms, hold briefly, and let it decay over about 450 ms (`setTargetAtTime`), so the whoosh swells with the pulse.
  - Breathing: a 0.25 Hz (15 breaths/min) LFO moves the souffle level ±20% and the bandpass frequency ±30 Hz.
- **Voice-like hum (mother talking or singing, from stage 6).**
  - Use a sawtooth oscillator (F0 about 190–230 Hz) → two bandpass "formants" that glide between vowel targets. Female vowels: /a/ F1 ≈ 850, F2 ≈ 1,220 Hz; /i/ F1 ≈ 310, F2 ≈ 2,790 Hz; /u/ F1 ≈ 370, F2 ≈ 950 Hz (formant tables: https://en.wikipedia.org/wiki/Formant).
  - Pitch contour: phrases of 1.5–3 s with a rise and then a falling end, separated by 0.4–1.2 s pauses. The syllable rate is about 4 Hz as an amplitude LFO.
  - Through the 450 Hz womb bus, only melody and rhythm survive, which matches the research (prosody passes, consonants do not). Make the voice relatively loud in the mix (Querleu).
  - Gameplay: turning toward the voice gives calm and a bonus.
- **Baby's own heartbeat (from stage 5).** Use a soft, higher, quicker beat: one sine at 90–110 Hz with a 40 ms decay, plus a faint "funic" whistle (sine near 600 Hz through the womb bus, which mostly removes it, leaving a soft hiss). Rate per stage from the BMJ curve: about 110 → 170 → 150 → 140 → 130 bpm. Mix it below the mother's beat.
- **Gut and movement (optional, sparse).** Rare low gurgles: brown noise through a bandpass whose frequency sweeps 120 → 60 Hz over 300 ms. Keep these very quiet; no gross-out.
- **Gameplay sounds** go through the womb bus too, so they sit "inside". Use soft plucks on a pentatonic scale for pickups, synced to the heartbeat phase when possible.

### C3. Timing
- Schedule beats with the lookahead pattern from Chris Wilson's "A tale of two clocks" (https://web.dev/articles/audio-scheduling): a `setTimeout` every ~25 ms schedules everything due in the next ~100 ms on `AudioContext.currentTime`.
- The **beat phase comes from `core/`** (deterministic, from the fixed step and the seeded jitter). Audio and visuals both read it, so the visual pulse (A6) and the sound stay in sync even when audio is muted or blocked.

### C4. Budget and safety
- About 10 persistent voices plus a small one-shot pool (the Ahead of the Light pattern uses 24). No node churn per beat: envelope persistent oscillators instead.
- The master compressor keeps the low end from clipping on phone speakers. The master gain uses `setTargetAtTime` for mute and pause, so there are no clicks.
- Sound is optional: all beat cues are also visual.

### C5. The birth moment in sound
1. Squeeze: the womb bus cutoff drops 450 → 300 Hz, the mother's heart quickens to about 100 bpm, and pressure rumbles (brown noise, 40–80 Hz).
2. Release (about 1.5 s): `wombBus` cutoff `exponentialRampToValueAtTime` 300 → 16,000 Hz, the heartbeat and souffle fade over 1 s, and the birth bus fades in (soft room tone, a first inhale: noise bandpassed 1–3 kHz with a rising sweep).
3. Then a soft, short first cry (a formant-synth vowel /a/ at F0 ≈ 450 Hz with vibrato, 1.2 s, not harsh), and quiet. The world is suddenly clear and bright: the sound mirrors the bloom to white.

### C6. How to check audio without ears
- In a browser test, render 6 s of the stage-1 graph with an `OfflineAudioContext` (or tap an `AnalyserNode`):
  - spectral energy below 500 Hz ≥ 90% of the total
  - envelope peaks spaced 60/72–60/84 s apart (the mother's beat)
  - in stage 5, a second peak train at the fetal rate
  - after birth, energy above 2 kHz rises by ≥ 20 dB
- `window.__fb.sound` should expose the counts of scheduled beats and the current cutoff for e2e checks.
- State clearly in the PR that real listening on phone speakers was or was not done.

---

## Source index (main)
- Quilez smin — https://iquilezles.org/articles/smin/ · 2D SDFs — https://iquilezles.org/articles/distfunctions2d/ · Voronoi edges — https://iquilezles.org/articles/voronoilines/
- Wong, Metaballs and Marching Squares — https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
- Bebber, Creative Gooey Effects — https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/
- Shiffman, Blobby / Polar Noise Loops — https://thecodingtrain.com/challenges/36-blobby · https://thecodingtrain.com/challenges/136-polar-noise-loops
- Gustavson, Simplex noise demystified — https://cgvr.cs.uni-bremen.de/teaching/cg_literatur/simplexnoise.pdf · webgl-noise — https://github.com/stegu/webgl-noise · psrdnoise (JCGT 2022) — https://jcgt.org/published/0011/01/02/
- Bridson et al., Curl-Noise — https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf
- Reynolds, Steering Behaviors — https://www.red3d.com/cwr/steer/gdc99/ · Nature of Code — https://natureofcode.com/autonomous-agents/
- Runions et al. 2005 — https://www.algorithmicbotany.org/papers/venation.sig2005.html · 2007 — https://www.algorithmicbotany.org/papers/colonization.egwnp2007.html · ABOP — https://algorithmicbotany.org/papers/abop/abop.pdf
- GPU Gems ch. 16 — https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering · GPU Gems 3 ch. 14 — https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch14.html · Zucconi fast SSS — https://www.alanzucconi.com/2017/08/30/fast-subsurface-scattering-1/
- Blur and bloom: Intel blur survey — https://www.intel.com/content/www/us/en/developer/articles/technical/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms.html · mobile bloom benchmark — https://etasr.com/index.php/ETASR/article/download/19101/6940
- Caustics: Wallace — https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c · Zucconi — https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/
- Canvas and WebGL performance: MDN Optimizing canvas — https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas · Chrome mediump — https://developer.chrome.com/blog/use-mediump-precision-in-webgl-when-possible · SwiftShader — https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md · ctx.filter support — https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter
- Safety: WCAG 2.3.1 — https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- Audio: Wilson, A tale of two clocks — https://web.dev/articles/audio-scheduling · MDN Web Audio best practices — https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices · Kellet pink noise — https://www.firstpr.com.au/dsp/pink-noise/ · Gerhardt and Abrams — https://www.nature.com/articles/7200445 · Souffle — https://en.wikipedia.org/wiki/Souffle_(heart_sound)
- Biology: fetal heart rate — https://heart.bmj.com/content/93/10/1294 · https://peerj.com/articles/82 · sperm guidance — https://pmc.ncbi.nlm.nih.gov/articles/PMC4492055 · Fitzpatrick 2020 — https://royalsocietypublishing.org/doi/10.1098/rspb.2020.0805 · Martin 1991 — https://web.stanford.edu/~eckert/PDF/Martin1991.pdf · villi — https://embryology.ch/old/anglais/fplacenta/villosite07.html
- Games: flOw — https://en.wikipedia.org/wiki/Flow_(video_game) · Chen — https://www.jenovachen.com/flowingames/ · Osmos — https://en.wikipedia.org/wiki/Osmos · Spore retrospective — https://bit-tech.net/features/gaming/pc/10-years-on-spore/1/ · Journey talk — https://gdcvault.com/play/1017700/Designing · WarioWare (Iwata Asks) — https://iwataasks.nintendo.com/interviews/wii/warioware_smooth_moves/0/2 · Rhythm Heaven review — https://www.engadget.com/2009-03-25-joystiq-review-rhythm-heaven.html · Before Your Eyes — https://www.thegamer.com/before-your-eyes-interview-blink/ · Born Race — https://store.steampowered.com/app/1447330/Born_Race · Spermania review — https://www.progress.org.uk/game-review-spermania-the-race-for-life/ · Conception II review — https://www.gamerevolution.com/review/63780-conception-ii-children-of-the-seven-stars-review · Abortion Boy — https://sixrobin.itch.io/abortion-boy · Nilsson — https://en.wikipedia.org/wiki/A_Child_Is_Born_(book)

Notes on confidence:
- I confirmed the formulas from the primary sources: Quilez smin, Bridson's ramp, Runions' growth rule, Green's wrap and scatter, and Zucconi's min-of-two-samples.
- These came from search summaries, not the full texts: the Kawase and dual-filter details, Querleu's dB values, the fetal-hearing onset week, and the maternal resting heart rate.
- All phone costs are estimates. The SwiftShader numbers were measured in this container only.
