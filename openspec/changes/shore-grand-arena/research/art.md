# Shore of the Ancients: current art and what an art-direction change needs

Everything below was checked read-only. No repository files were changed. Scratch scripts and images are in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`.

## 0. Key findings

1. **The battlefield copies a Rick and Morty-style concept.** All battlefield sprites and terrain were generated with the "Rick and Morty inspired" concept as the image reference.
   - The concept prompt asks for "crisp bold black outlines, flat cel-shaded colors, acid green and ultraviolet accents, strange goofy folklore beasts with expressive eyes, warped crooked architecture" (`higgsfield/monster-styles.json:7`).
   - Every production recipe passes that concept's URL (`ffaa4140…`) as `image_urls`: `higgsfield/monster-reference-assets.json:16`, `monster-motion-assets.json:17`, `monster-environment-assets.json:13`, `monster-toon-assets.json:12`.
   - The same URL is the R&M entry in `public/tidebreak/styles/sources.json:23`. The provenance files say so too: `art/illustrated/sources.json:4`, `art/sources.json:207`.
   - The choice is recorded in `docs/tidebreak.md:109-111` and `:120-122`.
2. **The menu and the battlefield are two different games.** The hero select is dark, painted, semi-realistic fantasy: sunset gold, deep navy, cyan magic and Cinzel type. It was built from a reference image the user supplied on 3 Oct (`art/reference/credits.md`), and the spec encodes it (`openspec/specs/moba-ui/spec.md:8-9`). The battlefield is an inked cartoon with turquoise willows, glowing violet mushrooms and purple-roofed witch cottages.
3. **One battlefield screen mixes four art styles:**
   - painted semi-realistic hero portraits (`illustrated-render.js:193-194`)
   - inked cartoon scenery
   - nearest-neighbour pixel-art camps (`marketplace-sprites.js:14`)
   - pixel-art procedural minions and boss (`public/arcade/creatures/player.js:55`; `sim.js:331,406`)
4. **Lighting is flat (measured).**
   - The spread of brightness values (standard deviation of HSV value) is 0.13–0.16 on the battlefield and 0.28 on the hero select.
   - Dark pixels (value below 20%) cover 6–9% of the battlefield and 31% of the menu.
   - Bright pixels (value above 78%) cover 1–2% of the battlefield and 15% of the menu.
   - Vivid teal/cyan covers about 10% of the battlefield and 2.7% of the menu.
5. **Proportions are toy-like.** The player hero is drawn 475 world units tall against a 245-unit outer tower and 355–410-unit houses (`sim.js:28`; `illustrated-render.js:184,189`; `world.js:52,57`).
6. **The map is already 6400×6400, not 4800×4800.** See `arena.js:2-3` and `qa/tidebreak/towers.test.mjs:24`. "Double" therefore means 12800, or 9600 if the plan meant 1.5×. The ground is one cached 3072² canvas per realm phase (`paint-ground.js:29`; `illustrated-render.js:43-44`), so a bigger map needs chunked ground.
7. **One visual bug is confirmed:** the river has a ruler-straight horizontal cut-off. The water fill uses 4800-era constants `fillRect(0,1300,SIZE,1700)` (`paint-ground.js:78,84`) and a gradient from `(0,1700)` to `(4000,2600)` (`paint-ground.js:83`). The river actually spans y 2288–3410 (measured with `riverGeometry(1)`), so everything south of y=3000 has no water. It is visible in `shots/07-battle-camp.png` and `shots/crop-river-cutoff.png`.

## 1. Screenshots (1440×900; Chromium `/opt/pw-browsers/chromium`, no GPU flags)

All files are in `…/scratchpad/understand/shots/`:

- **Hero select:** `01-hero-select.png`, `02-hero-select-voidcaller.png`
- **Draft:** `03-draft.png`
- **Battle with HUD:** `04-battle-start-hud.png` (match start), `05-battle-mid-river.png`, `06-battle-enemy-tower.png`, `07-battle-camp.png` (river cut-off and pixel camp), `08-battle-home-base.png` (core and pixel minions)
- **Woods realm:** `13-battle-woods-realm.png`, `14-battle-woods-east.png`. Ignore `09-battle-woods-phase.png`: the sim reverted the phase and it shows town.
- **Close crop:** `15-battle-crop.png`
- **Market:** `10-market.png`, `16-market-wait.png`
- **Map:** `11-map.png`
- **Phone, 390×844:** `12-phone-battle.png`
- **HUD crops:** `crop-hud-abilities.png`, `crop-hud-topleft.png`, `crop-hud-bottom.png`, `crop-river-cutoff.png`
- **Asset contact sheets:** `art-structures.png`, `art-nature.png`, `art-creature-heroes.png`, `art-reference-heroes.png`, `art-spells.png`, `art-textures-misc.png`

Scripts: `shots.mjs`, `shots2.mjs`, `scenery-count.mjs`, `postfx-bench.mjs`.

## 2. How the battlefield is drawn

The live renderer is the Canvas 2D `illustrated-render.js` (`main.js:6`). The other modules are dead code on this path: `render.js` (WebGL), `world-art.js`, `toon.js` and `environment.js` are imported only by `render.js` (`render.js:6-8`). `hero-rig.js` is untracked new work and also references models.

**`loadArt()` (`illustrated-render.js:20-26`)**

- Line 21–22 load **73** `art/illustrated/*.webp` files:
  - 9 base sprites: `house-a`, `house-b`, `pines`, `stones`, `tower-enemy`, `tower-ally`, `wisp-ally`, `wisp-enemy`, `bridge`
  - 9 `LANDMARKS`, 9 `PLANTS` and 6 `LANDFORMS` (`scenery.js:4-6`)
  - creatures 0–3: back, front and 6 attack frames each (32 files)
  - the 8 legends: front only
- Line 23: 2 MagicPixel PNGs.
- Line 24: 16 `art/reference/<slug>.webp` identity portraits.
- Line 25: `art/toon-ground.webp` and `art/illustrated/terrain-surfaces.webp`.
- Total: **93 images, 16.1 MB** (7.06 MB illustrated, 6.45 MB reference, 2.57 MB terrain and pixel).
- `CreatureBank` also loads all 18 procedural creatures (`illustrated-render.js:33-35`): 25 PNG pages, 1.3 MB, in `public/arcade/creatures/assets`.

**Terrain**

- `this.tiles` cuts the 4 quadrants of `toon-ground` (`illustrated-render.js:38`). Only `tiles[2]`, the cyan cartoon water, is used: at alpha 0.12 (`paint-ground.js:84`).
- `paintGround` (`paint-ground.js:28-123`) paints a 3072² canvas for each phase:
  - base `#667558` and material pattern: lines 31–32
  - district tint and material: 34–40, with colours in `scenery.js:23-26`
  - 220 blurred colour patches: 41–45, from `scenery.js:90`
  - tan lane ribbons: 47–66
  - shore bands: 68–81
  - flat cyan water gradient `#659f9c → #3b8e91 → #77b5a2 → #387c8d`: 83
  - gravel: 92–108
  - radial contact shadows: 110–114
  - grass strokes: 116–119
  - base courts: 120, using `bases.js:7-30`
  - woods tint `#1b435e23`: 121
- Memory: 2 × 3072² × 4 B ≈ **75 MB**.

**Each frame (`draw`, `illustrated-render.js:108-180`)**

- `#142932` fill: 130
- ground blit: 131
- bridges: 134
- portal and brush rings: 135–136
- depth-sorted props and units: 139–151. The loop visits **all** props every frame, and props over the hero fade to alpha 0.28 (line 146).
- labels: 152–164
- vector VFX: 165–166
- `drawAtmosphere`: 167 and 269–294 (warm window glows `#ffbd5420`, 32 motes, river streaks)
- floaters: 176
- woods overlay `#192c4429`: 178
- minimap every 6 frames: 179

There is no vignette, colour grade, fog or directional light. The camera scale is `min(w/1200, h/1680)` (line 53), which is 0.536 at 1440×900, and the y axis is squashed by 0.88 (line 58).

**Units (`drawUnit`, lines 181–227)**

- Heights: towers 245 (outer) and 315 (inner), cores from `BASE_STYLES` (620/670), boss 325, camp 160, minion 120 (line 184).
- Heroes use `HEROES[i].height`, scaled by 0.77 for bots (line 189). Base heights are [365,475,360,390] (`sim.js:28`); legends are 340–420 (`legends.js:4-39`).
- An attack frame is chosen at line 192 and then replaced by the static identity portrait (lines 193–194). Every hero has an identity (`hero-identities.js:96-109`), so creature sprites and attack frames never render in a match. They are fallback only, yet 40 files (3.5 MB) are still loaded.
- Motion is done with bob, tilt and stretch (line 217). Kit 1, which is only Tidewarden, also gets Nessie's "wave" slice distortion (lines 66–68 and 217), so the armoured knight's legs wobble like jelly.
- World health bars use `TEAM=['#73e0be','#c167d8']`, mint against violet (lines 14, 221–223).

## 3. Asset inventory: `public/tidebreak/art/**`

The folder holds 161 tracked files (29 MB). Sizes below were measured from the file headers.

| Folder / file | Count, size, format | Used for | Status |
|---|---|---|---|
| `illustrated/` town structures: house-a 621×900, house-b 663×900, observatory 510×590, mill 525×463, market 564×451, abbey 443×559, hollow-log 601×518, greenhouse 506×571, shrine 293×537, ivy-wall 554×425, pier 545×545 | 11 WebP | Cover props (`world.js:44-58`), village yard (`scenery.js:49-52`); shrine and abbey are also the cores (`bases.js:3-4`) | Used, except `mill`: loaded, never drawn (absent from the scene census) |
| `illustrated/` plants: willow 586×598, oak 506×608, birches 449×628, mushrooms 520×487, ferns 565×503, juniper 595×505, reeds 484×571, boulders 675×505, branch 583×458, pines 733×900 | 10 WebP | Groves, infill and reeds (`scenery.js:54-89`) | Used. Count per phase-0 scene (seed 1): ferns 137, boulders 136, branch 132, birches 120, reeds 86, hollow-log 86, juniper 71, **mushrooms 57**, oak 49, **willow 37**, forest-island 37, pines 32; 995 props in total |
| `illustrated/` landforms: cliff-ridge 632×829, root-arch 619×788, ruin-yard 623×726, mill-yard 658×755, rock-shelf 645×634, forest-island 657×840 | 6 WebP | Large cover footprints (`world.js:45-55`) | Used |
| `illustrated/` gameplay: tower-ally 449×900, tower-enemy 450×900, bridge 427×900 | 3 WebP | Towers (`illustrated-render.js:183`), the core's side towers (`bases.js:35`), minimap icons (`illustrated-render.js:331`), bridges (`:134`) | Used. Both tower tiers share one sprite |
| `illustrated/` wisp-ally 410×577, wisp-enemy 392×617; `stones` 760×745 | 3 WebP | Minion fallback (`illustrated-render.js:183`); stones loaded only | Fallback / unused |
| `illustrated/` creature heroes: 4 × (front, back, 6 attack frames) at 345–690 × 642–900; 8 legend fronts at 533–640 × 585–640 | 40 WebP, 3.5 MB | Fallback battle sprites; spellbook header only without an identity (`spellbook.js:28`) | Loaded, effectively unused |
| `illustrated/ability-*.webp` (6, about 620×626) and `atlas.json` | 6 WebP | Referenced only in `atlas.json` | Unused |
| `illustrated/terrain-surfaces.webp` 2048² | 1 WebP, 1.7 MB | 4 ground materials, cropped to 600² (`paint-ground.js:6-10`, `:30`) | Used |
| `illustrated/opening-citadel.webp` 2752×1536 | 1 WebP | Background in `opening.css:3`, but hidden by `selection-reference.css:5` (`::before{content:none}`). Still preloaded at `index.html:20` | Wasted preload |
| `toon-ground.webp` 2048² | 1 WebP | Only the cyan water quadrant is used (`paint-ground.js:84`) | Used (water) |
| `reference/*.webp` 1024×1536 | 16 WebP, 6.45 MB | Hero select stage (`main.js:135`), draft (`draft.js:75`), spellbook (`spellbook.js:28`), **battle sprites** (`illustrated-render.js:24,194`), minimap markers (`:301-304`) | Used. Painted, close to the target style |
| `reference/shore-scene.webp` 1672×941 | 1 | Hero-select backdrop (`selection-reference.css:3`) | Used |
| `reference/reference-source.png` 1536×864 | 1 PNG (user's mockup) | CSS sprite source for the wordmark, 16 roster portraits, role icons, sigils, avatar and brand (`selection-reference.css:8,20,30,43,56,66,69,73`; `roster.js:9-12`) | Used. Portraits are about 100 px crops of a screenshot |
| `spells/<kit>-spells.webp` 1254² | 12 | HUD and selection spell tiles for the 12 identities without their own atlas (`roster.js:20-24`, `spell-art.js:3-5`) | Used, but shows the **creature** (Voidcaller shows Kraken: `shots/02`) |
| `spells/<identity>-fal.webp` 768² | 4 (tidewarden, embersong, skyreaver, dredge) | Own spell art (`roster.js:8,16`) | Used. `skyreaver-fal` has baked-in text labels |
| `spells/nessie-portrait.webp` 512×341 | 1 | Spellbook fallback (`spellbook.js:28`) | Fallback |
| `magicpixel/possessed-ogre.png` 512², `undead-rpg.png` 1024² | 2 PNG | 4 neutral camp guardians (`marketplace-sprites.js:2-7`; `sim.js:414`), drawn nearest-neighbour | Used; required by the spec (`moba-combat/spec.md:50`) |
| `items.webp` 1536×768 | 1 (18 icons, 6×3) | Item icons (`style.css:21`) | Used |
| `ui/*.svg` | 10 | Menu icons (`index.html:63,69,73`; `roster.js:5`) | Used |
| `animated/*-idle.gif` | 12, 5.6 MB | Only `qa/tidebreak/hero-gifs.test.mjs` | Unused in game |
| `ground.webp` 1536², `monsters.webp` 2048², `baba/devil/mothman/nessie.webp` 460² | 6 | Early Monster Mash atlas | Unused |
| `shore-ancients-hero.webp` 320×213 | 1 | og:image (`index.html:11`), arcade card (`public/index.html:349`, `arcade/switch.js:6`) | Arcade only |

Other art the game uses or ships:

- `public/arcade/creatures/assets`: 18 pixel creatures (frames 102×89, `cameraElevationDeg` 30) for minions, the boss and the leviathan (`sim.js:131,331,406`).
- `fonts/cinzel.ttf`, plus Barlow Condensed from `/vr/fonts` (`style.css:1`).
- `models/*.glb`: 6 Meshy cartoon models, used only by the dead `render.js:14`.
- `styles/*.webp`: the style gallery.

## 4. How earlier art was generated

- **Concepts.** The 30 Sep comparison generated three concepts with Higgsfield `marketing-studio/image`, styled after Ghibli, Pixar and Rick and Morty (`higgsfield/monster-styles.json`; README). The user chose R&M (`docs/tidebreak.md:111`).
- **Production sheets.** Sprite sheets were made with `marketing-studio/image` at 2k, 1:1, with `enhance_prompt:false` and the R&M concept as the image reference:
  - `monster-reference-assets.json`: scenery 2×2, heroes 4×2, units 2×2, abilities 3×2, bridge
  - `monster-motion-assets.json`: landmarks 3×3, botanicals 3×3, attack sheets 3×2 for each of the 4 creatures
  - `monster-environment-assets.json`: landforms 3×2, surfaces 2×2
  - `monster-toon-assets.json`: terrain
- **Wording that sets the look.** The prompts ask for:
  - "hand-inked storybook cartoon, fine irregular black contour lines … purple slate roofs" (`monster-reference-assets.json:3`, `monster-motion-assets.json:3`)
  - "small charming round blue spirit minion … tiny arms and feet … cartoony thick outlines" (`monster-reference-assets.json:7`)
  - "three cute wailing pale mint ghosts" (`:8`)
  - "big bulging expressive eyes" (`:6`)
  - "willow with drooping turquoise foliage; gnarly leafless oak with luminous blue moss; giant cluster of luminous violet mushrooms" (`monster-motion-assets.json:6`)
  - "Rick and Morty-inspired bold dark outlines and flat cel-shaded" terrain (`monster-toon-assets.json:3`)
- **Processing.** Magenta #FF00FF chroma key, two-pixel despill, alpha trim per cell, downsample to at most 760×900, WebP q91 (`art/illustrated/sources.json:6`). No processing script is committed; `scripts/` has none.
- **Other generators:**
  - Legends: built-in image_gen, "watercolor and gouache, dark ink contours" (`art/illustrated/legend-sources.json`).
  - Spell atlases: built-in image_gen (`art/spells/sources.json`).
  - GIFs: fal minimax (`art/animated/sources.json`).
  - Hero-select citadel: fal nano-banana-pro (`art/illustrated/opening-sources.json`).
  - Reference portraits and shore scene: OpenAI image generation, from the user's mockup (`art/reference/credits.md`).
- **Tooling:**
  - `higgsfield/gen.ts` runs `npm run gen -- <model> <json> --out`. It needs `HF_CREDENTIALS` in `higgsfield/.env.local`, which is absent (only `.env.example` exists).
  - The README says to use the API tools, not the MCP connector. However, `higgsfield/arcade-key-art.json` (5 Oct) was made with the MCP connector, using `gpt_image_2_5`. The policy is inconsistent.

## 5. Why the current look reads as childish

1. **Source style.** Every sprite carries thick black ink outlines with flat cel shading, which is the look of TV cartoons (see the recipes in §4). Contact sheets: `art-structures.png`, `art-nature.png`.
2. **Candy palette with no hue hierarchy.** Each prop brings its own saturated accent:
   - turquoise willows (37), violet glowing mushrooms (57), blue-glowing oaks (49), orange birches (120)
   - purple roofs, a magenta market awning, crystal towers in cyan and violet
   - flat cyan water (`paint-ground.js:83-84`)
   - mint/violet team colours (`illustrated-render.js:14`)
   - pastel VFX (`combat-motion.js:2`: `#bbacf6`, `#91f4df`, `#ffd699`, …)

   Measured: teal/cyan covers about 10% of the frame against 2.7% on the menu, and the menu's vivid pixels are mostly warm (6.4%).
3. **Flat, even lighting.** The only lighting is small radial blobs: prop shadows (`paint-ground.js:110-114`), unit shadows at alpha 0.27 (`illustrated-render.js:203`) and window glows (`:272-278`). There is no key light, no long shadows, no vignette and no depth haze. Brightness spread is 0.13–0.16 against 0.28 on the menu (§0). The woods realm only adds a blue tint at alpha 0x23–0x29 (`paint-ground.js:121`; `illustrated-render.js:178`).
4. **Toy scale.** Heroes are taller than houses and about twice an outer tower (§0, item 5). Towers are small crystal ornaments; the inner tower is only 315 units.
5. **Busy, confetti-like scenery.** About 995 props per scene (2600 placement attempts, `scenery.js:70`), each a detailed "hero prop" with its own glow. There is no negative space and no quiet ground.
6. **Style clash.**
   - The painted, realistic hero portraits stand in 3/4 front view, not the oblique camera view, and have no back view.
   - Pixel camps and minions are scaled up with smoothing off (`marketplace-sprites.js:14`; `arcade/creatures/player.js:55`).
   - So retro casual sprites stand next to cartoon scenery and painted heroes (`shots/07`, `08`, `15`).
7. **Rubbery motion.** Heroes are static images that bob, tilt and squash-and-stretch (`illustrated-render.js:217`), and Tidewarden wobbles (`:66-68`). Attack frames never show (§2).
8. **Theme mismatch.** The game and menu are about tide and ocean citadels. The battlefield is "Midnight Town / Deep Woods" with witch cottages and mushrooms (`index.html:35`).
9. **HUD language.**
   - The HUD has its own visual layers: `toon.css` ("Weird Woods: inked controls", `toon.css:1`) and `illustrated.css` (`:1`).
   - Comic "sticker" hard-offset shadows: `toon.css:4,5,7,9,12-17,19,21,24,25,29-33`, e.g. `box-shadow:3px 4px 0`.
   - A rotated title, `rotate(-2deg)` (`toon.css:27`).
   - Lime accents and pills: `#d6ea78` (`style.css:13`; `illustrated.css:6`), lime primary `#bace72` (`toon.css:32`), lime market tab `#d0df7c` (`style.css:21`).
   - Round gold "+" coins in Arial 900 (`abilities.css:175`) and a large flat yellow-outlined "+1 POINT" box (`abilities.css:264-281`).
   - A "LOCK" chip on every skill (`abilities.css:370+`).
   - Four font families: Barlow ×49, Georgia ×46, Arial ×37, Cinzel ×9 (grep over `*.css`).
10. **Ground.** Soft khaki ground with large blurred patches (`paint-ground.js:41-45`). It is also under-sampled: 3072 px for 6400 units is 0.48 texels per unit, against 0.54 screen px per unit at DPR 1 and 1.07 at DPR 2, so it looks blurry on sharp screens.

## 6. Constraints already encoded

**Specs**

- `moba-ui/spec.md:8-9`: the opening "SHALL match the supplied Shore reference composition … gold wordmark and cyan selection feedback". This is the user's direction from 3 Oct, so the battlefield should move **toward** it.
- `moba-roster/spec.md:19-20,30-32`: source-matched selection artwork; fall back to the archetype sprite.
- `moba-skills/spec.md:58`: painted spellbook.
- `moba-combat/spec.md:50-54`: MagicPixel neutral guardians. Replacing them needs a spec change.

**Tests that encode art**

- `qa/tidebreak/hero-identities.test.mjs:42,81-108`: `loadArt`, `nessie-front`/`back`/`attack` must exist, `reference-<slug>` as `renderAsset`.
- `qa/tidebreak/hero-gifs.test.mjs`: the 12 GIFs.
- `qa/tidebreak/scenery.test.mjs:12-19`: at least 10 scenery names, footprints match `OBSTACLES`, lane clearance.
- `qa/tidebreak/towers.test.mjs:7,15,24,28`: `SIZE===6400`, two tiers (tier 0 and 1).
- `qa/creatures/browser.mjs:44-46,127-128,196-198`: portraits from `reference-source.png`, `shore-scene` loaded.
- `qa/tidebreak/desktop.e2e.mjs`: pixel budget.

**Docs**

- `docs/tidebreak.md:109-130` describes the cartoon direction and needs a rewrite.
- `AGENTS.md`: preserve the user's requested art direction and define a concrete visual check.

## 7. What an art-direction change requires

### 7.1 Recommended direction

Make the battlefield match the hero select: dusk, ocean-ruin, painterly, semi-realistic fantasy (in the spirit of `shore-scene.webp` and the reference portraits). It should have:

- no black outlines
- one warm amber key light from the upper left, with cool teal shadows
- a desaturated stone, moss and umber environment
- saturation reserved for magic, team colours and VFX
- team colours cyan (ally) against ember red (enemy), replacing mint/violet
- towers about 1.6–2× hero height

Possible setting: sea cliffs, drowned ruins, salt marsh and a lighthouse. The realm shift could become dusk/storm or low/high tide while keeping the obstacle rules (`world.js:61`).

Concrete checks, using the script in this report on 1440×900 screenshots:

- spread of brightness values ≥ 0.22
- dark pixels (value below 20%) ≥ 15%
- vivid teal/cyan ≤ 4% of frame
- vivid violet ≤ 0.5% of frame

### 7.2 Assets to regenerate

Do not use the R&M URL as a reference. Use `shore-scene.webp` and the reference portraits instead. Keep bottom-centre anchoring and the alpha trim: `drawAsset` takes the aspect from the image and anchors the feet at the bottom edge (`illustrated-render.js:63-69`), so a change of aspect needs no code change.

| Group | Count | Current | Target (source px, aspect) | Notes |
|---|---|---|---|---|
| Large landforms and cover | 6 | 619–658 × 726–840 | about 900×1100, varied | Drawn at 450–650 units, up to about 350 CSS px |
| Town structures | 11 (drop `mill` or start using it) | 293–663 × 425–900 | 640–900 long side | Rethink the witch cottages and greenhouse for the new setting |
| Plants and small props | 10 | 449–733 × 458–900 | 384–512 long side | On screen they are only 35–250 CSS px. Mushrooms and willows need repainting or renaming (names live in `scenery.js:6,23-26,45,65,73-76,86`) |
| Towers, 3 tiers × 2 teams | 6 (now 2) | 449×900 | about 512×1024 (1:2) | Needed for three tower layers. Code today: heights 245/315 (`illustrated-render.js:184`), ring (`:204`), labels (`:224`), minimap (`:331`), `TOWER_POSITIONS` returns 2 (`world.js:33-37`) |
| Tower rubble | 2–3 (new) | none | 512×384 | Destroyed towers currently just disappear |
| Cores | 2 (now reuse shrine/abbey) | 293×537 / 443×559 | about 900×1200 | `bases.js:3-4,31-48` |
| Bridge | 1 | 427×900 | about 512×1024 | Rotated by tilt (`illustrated-render.js:134`) |
| Lane minions | 6 types (2 teams × melee/caster/siege) × front/back = 12, plus 2–3 frames if animated | pixel creatures | about 256×320 | Replace the `creatureId` drawing for minions (`sim.js:331`) |
| Camp guardians | 4 | MagicPixel pixel art | about 512×640 | Spec change (`moba-combat/spec.md:50`) |
| Wild Hunt boss / leviathan | 1–2, plus an attack frame | pixel creature | about 900×900 | `sim.js:131,406` |
| Terrain materials | 4–5 | `terrain-surfaces` 2048² plus the toon water quadrant | 1024² seamless each: heath, worn road, wet shore, flagstone, water | Fix `paint-ground.js:78,83-84` at the same time |
| Hero battle sprites | minimum 16 back views; full set 16 × (2 idle + 6 attack) = 128 | 16 portraits, 1024×1536 | 512×768 (2:3), using each portrait as reference | Front views can reuse the portraits. Decoded size: 128 frames at 512×768 ≈ 200 MB, so pack into atlases or reduce |
| Identity spell atlases | 12 | kit creature atlases, 1254² | 1024² (4 tiles of 512) | Fixes the Kraken-for-Voidcaller mismatch (`roster.js:8,20-24`). Regenerate `skyreaver-fal` without baked text |
| VFX sheets (optional) | 8–12 | vector strokes only | 512², 4–8 frames | Slash, impact, splash, embers, rune decal |
| Items (optional) | 1 | 1536×768 | same layout | Mostly consistent already |

Scope: about 45–60 generation jobs for the minimum set of 58 environment/structure/unit sprites, plus 16–128 hero frames and 12 spell atlases.

Once replaced, these become unused and can be deleted: the 40 creature fallbacks, 6 `ability-*`, `stones`, the wisps, `animated/` (update `hero-gifs.test.mjs`), `ground`, `monsters`, the 4 small portraits, `models/` and `toon.js` (its cel ramp and ink pass are the cartoon look itself: `toon.js:4,21,29-62`).

### 7.3 Changes possible in code without new art

| What | Where | How |
|---|---|---|
| Ground palette | `paint-ground.js:31,43,51,54,57,63-64,71,75,80,83,88,90,100-101,105,113,118,121`; `scenery.js:23-26`; `bases.js:3-4,10-28` | Desaturate to stone and umber, raise value contrast, darken the water and give it a depth gradient |
| Baked lighting | `paint-ground.js:110-114` | Replace the radial blobs with long, skewed, blurred silhouette shadows of each prop. Props are static per scene, so this costs nothing per frame |
| Sprite colour grade at load | `loadArt`, `illustrated-render.js:22-25` | Pass each image once through an offscreen canvas: `filter:saturate(.6) contrast(1.1)`, or a hue remap that turns violet to slate and turquoise to deep green. Zero cost per frame. It cannot remove the outlines, so it is a stopgap |
| Team, VFX and feedback colours | `illustrated-render.js:14,135-136,138,204-211,221-224,322-340`; `combat-motion.js:2,5`; `combat-feedback.js:53` | Cyan against ember; brighter, additive VFX |
| Atmosphere | `illustrated-render.js:130,178,269-294` | Torch and lantern light pools at towers, bridges and cores; depth haze at the top of the screen |
| Post-processing per frame | new pass after line 176 | See the cost table below |
| Ground resolution and memory | `paint-ground.js:29`; `illustrated-render.js:43-44,140-148` | Chunked or lazy ground tiles and a spatial grid for props; required before any map doubling |

Measured cost per frame at 1440×900 in this headless software-raster Chromium (`postfx-bench.mjs`). The baseline is one full-screen `drawImage` at 6.24 ms; each number is the extra time:

| Pass | Extra cost | Use? |
|---|---|---|
| multiply tint | +0.55 ms | yes |
| top-of-screen haze | +0.7 ms | yes |
| cached quarter-resolution vignette | +5.4 ms | yes |
| radial-gradient vignette | +8.3 ms | prefer the cached version |
| `soft-light` split-tone | +7.7 ms | test on phones first |
| `saturation` pass | +11.6 ms | avoid per frame |
| `ctx.filter` on the whole screen | +22 ms | avoid |

So: bake the grade into assets and use only cheap overlays live. GPU-backed canvases should be faster, but phones were not measured. The existing `adapt()` quality ladder (`illustrated-render.js:84-101`) still applies.

### 7.4 Hero portraits and sprites

- The 16 reference portraits are already in the target style. Keep them for the menu, draft and spellbook.
- **Roster cards** crop the low-resolution mockup (`selection-reference.css:66`; `roster.js:9-12`). Crop the 1024×1536 portraits instead. This needs edits to `qa/creatures/browser.mjs:44-46,198` and the wording of `moba-ui/spec.md:8-9`.
- **In battle, minimum work:**
  - remove the wave distortion for Tidewarden (`illustrated-render.js:217`)
  - shrink heroes relative to towers
  - add a team rim or ring and a shadow cast by the key light
  - generate back views
- **Full version:** 128 painted frames, or the parallel 3D track (task list items 1 and 5; untracked `hero-rig.js`). A 3D renderer would need lit PBR materials, not `toon.js`.

### 7.5 HUD and menu styling

- Consolidate the tokens. There are 6 separate token sets today: `:root` in `style.css:2` and `:13`, `toon.css:2` and `legend-ui.css:2`, `#menu` in `opening.css:2`, and `#menu.reference-selection` in `selection-reference.css:3`. Across 11 CSS files there are about 1028 hard-coded hex colours and 63 `!important` rules. `#skill-points` alone is restyled in about 25 rules in `abilities.css`, `legend-ui.css:82` and `team.css:77`. Delete the old layers instead of adding a new override layer.
- Remove `toon.css` (`index.html:15`) and the lime from `illustrated.css` and `style.css:13`.
- Restyle the abilities like the menu skill tiles (`selection-reference.css:40-41`, `abilities.css:228-262`). Replace the gold coins and "+1 POINT" box with slim gold rank pips and chevrons.
- Give the minimap a fine gold ring (`illustrated.css:13`; `style.css:27`). Frame the health bars (`illustrated.css:29`; `illustrated-render.js:220-223`).
- Fonts: Cinzel for titles and labels, Barlow Condensed for numbers. Drop Arial (`selection-reference.css`) and Georgia (`opening.css:7,17,27,44`; `style.css:14`).
- Give the market and map dialogs the menu's dark glass panels and cyan selection feedback (`opening.css:44`; `style.css:21`).

### 7.6 Interaction with the map and tower requests

- Doubling the map from 6400 to 12800 multiplies the area by 4, so about 4000 props per phase at today's density (`scenery.js:70,90`). The per-frame prop loop and the two whole-map ground canvases cannot scale that far: they would need 6144² or more each, which exceeds mobile canvas limits.
- Three tower layers need the 6 tier sprites listed in 7.2, plus renderer and minimap changes (`illustrated-render.js:184,204,224,331`) and a third entry in `TOWER_POSITIONS` (`world.js:33-37`).

## 8. Other problems seen (separate from the art direction)

1. **River cut-off** (`paint-ground.js:78,83-84`), as described in §0.
2. **Market opens on an empty page 1/3.** Only the heading and tabs show, and the 8 item buttons sit on later pages (`shots/10-market.png`, `16-market-wait.png`). This likely comes from the page-break logic in `panel-pager.js:26`.
3. **Spell art shows the wrong hero** for 12 of the 16 identities, in both the hero select and the HUD (`roster.js:8,20-24`; `shots/02`).
4. **Wasted loading:** the hidden `opening-citadel` is still preloaded (`index.html:20`; `selection-reference.css:5`), and 3.5 MB of creature fallbacks load at start.
5. **Stale numbers:** `docs/tidebreak.md:7` and the computed task both still say the map is 4800 wide; the code says 6400.