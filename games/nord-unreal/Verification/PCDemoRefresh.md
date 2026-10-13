# PC browser demo refresh — 2026-10-13

The browser demo now runs a freshly cooked Linux Development package based on `origin/main` at `9dcefdb4`, with the local corrections on `pc-fix-comic-smoke`. The unfinished PC work remains separately committed as `9b84ca69` on `pc-wip-editor-shutdown`. The public address remains https://nord-montreal.vercel.app/; no tunnel or player deployment was changed.

## Corrections

- Preserve the intentional realistic default from `a86a508a`. Smoke and story tests first check standard view, then explicitly enable the comic fixtures used by their existing private-toggle, car/tool and capture checks. The smoke animation check follows each peer's expected weight. Its driving crew-cycle expectation now correctly wraps from style 10 to 3.
- Replace an editor-only directional-light accessor in the sky implementation with the runtime component lookup. Both editor and game targets compile.
- Generate the missing atmosphere collection, rain material and pond shore texture with the existing bounded authoring pass. Save the related ground, window and illustration wrappers, plus exposure scaling for the eight crew materials' daylight emissive fill. The crew importer preserves that scaling on reimport. Textures and base-colour connections remain unchanged; the daytime emission multiplier is one.
- Avoid UE 5.8's material bulk-delete iteration bug in the pond, rain and crew generators. A shared helper deletes expressions from a copied read-back. The CPU repeat-authoring regression reproduces skipped nodes and requires a stable second run.

## Verification

Evidence is retained locally under `Saved/Tests/PCComicFix-20261013-134646/`, including rejected attempts.

| Check | Result |
| --- | --- |
| Editor build, Linux game build, cook/stage/archive | Passed, exit 0 |
| Legacy native smoke | 69 checks passed; repeated after initial atmosphere authoring |
| Two-player story suite | 120 checks passed; isolated save restored and production saves unchanged |
| Native automation | All 18 `Quebec.*` tests passed, including sky and shutdown tests |
| CPU authoring/water/shader checks | Passed; 23 original fixture files backed up, repeat graph stable; water shaders checked with three compilers |
| Final atmosphere fresh-load verification | Passed for collection, water, rain, 15 pond actors and all 21 wrapped materials |
| Final cooked daytime and rainy-night package | Each passed separate-process join, eight crew cycles, 32 loaded clips, environment inventory, seven 1280×720 captures and clean dependency/shader/fatal log scans |
| Public desktop browser | 7/7 checks passed: independent streams, input, release, occupied-slot refusal and reconnect |
| Public touch emulation | 9/9 checks passed, with real VP8 video, input/release, fullscreen and control-layout checks; the observed stream remained 1280×720 |

The final daytime and rainy-night standard/comic captures were inspected directly. The crew's blown-white night appearance is corrected and the daytime appearance is preserved. These spawn-area captures do not replace the full sky/water visual acceptance matrix or performance profiles. Native smoke/story/automation preceded the final crew-material recook; final cooked rendering, joining and browser checks used the installed package.

The saved map remains byte-identical: `ed0056d27b3a9496871c538bcbe7e6214b5dbe7d4ae87b88c03015900c3662ce`. Original material backups are in `Saved/Recovery/sky-water-20261013T135314682597Z/` and `Saved/Recovery/sky-water-20261013T140215484630Z/`; the final idempotent pass is recorded under `Saved/Recovery/sky-water-20261013T140427570799Z/`.

## Installation and recovery

The package was cooked into `Builds/BrowserNext-20261013-134646/`, tested there, then installed at `Builds/Browser/`. All 48 non-Saved file hashes match the tested package. All 26 existing Saved files were copied and checked byte-for-byte before restarting; the campaign `.sav` was checked again after browser input tests. `package-identity.json` and `save-preservation.json` retain the identities in the evidence directory.

The previous package and its original saves remain at `Builds/BrowserPrevious-20261013-134646/`. Rollback requires stopping only `nord-browser-demo.service` and preserving any subsequent campaign progress before restoring that directory. `Builds/Linux/` was not replaced.

The normal demo service was restored with the existing ICE configuration and quality settings. Both peers joined, the live sky runs, and the dependency/shader/fatal log scan passes without `NORD_SKY missing` warnings. The public, original Funnel and TURN Funnel services retain their original process IDs; relay configuration and credentials were untouched.

Physical phones, off-network connectivity, audible playback, sustained performance, the complete naturally driven packaged campaign and the full sky/water acceptance matrix were not checked. The OpenSpec CLI is unavailable on this PC; no CLI validation or broad sky/water archive is claimed.
