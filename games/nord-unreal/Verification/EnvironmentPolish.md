# Environment polish — accepted

Final bounded acceptance: `2026-10-11T17:29:03.795731+00:00`. Baseline `31e7ed09cce9b695d6ca23626459d4508bcee3cc`. **All seven required gates pass (`passed: true`).** Art froze at 16:34 UTC within the two-hour art window; thorough QA continued afterward. The existing browser host is active. No new Vercel deployment or production gameplay/quality change was needed.

The saved map is `ed0056d27b3a9496871c538bcbe7e6214b5dbe7d4ae87b88c03015900c3662ce`. This accepts the specific tree/material, street/perimeter and two survey-exterior corrections below. It does not establish pixel-perfect Google Street View or complete citywide reconstruction.

## Delivered appearance

- Retained tree cutouts, material coverage and comic foliage treatment improve near/far crown readability. All 4,571 mapped instance transforms, source geometry and collision remain unchanged. Sky and low-roughness upward pond reflections retain continuous gradients while roads, vertical glass, crew and foliage keep their comic treatment.
- The perimeter contains 305 decorative batches across 154 fronts, with 725,808 decorative triangles. Le Neuville and École Le Plateau add two retained municipal exterior copies (882 body triangles), correcting their 9.6 m fallback visual heights to the survey masses. Façade decoration is estimated artwork.
- Seven exact original NoCollision render components hide duplicate landmark shells/cards. Four filtered copies retain 150,253 triangles and remove only the 878 confirmed duplicate triangles, preserving every unaffected ordered position/UV token. Both roof parents are explicitly persisted and freshly verified.
- 65 metal cornices have attached closures. Four confirmed side edges — OSM356350796 edges1/2, OSM345835052 edge4 and OSM356350765 edge2 — have backed framed-window skins. The finish has 36 nonblocking batches and 13,352 triangles. Exactly 347 additions are approved; all 2,701 original snapshot rows remain strict except the seven approved visibility transitions. The separate source verifier also checks their exact manifest render states. Gameplay colliders are preserved.

Eight unchanged accepted 1080p comic frames are in [Preview/EnvironmentPolish](../Preview/EnvironmentPolish). Existing preview/trailer media was not overwritten.

## Acceptance evidence

| Gate | Accepted evidence |
|---|---|
| CPU/source | Eleven final frozen suites pass, including original corruption rejections, dependency persistence, exact four-side inventory, eleven tree cases and package/log parsers. All 32 baseline race assertion conditions remain in their original order. Protected gameplay/config/browser/raw data show no baseline diff. |
| Fresh saved map | All 17 existing Plateau checks pass: strict2,701 original actors, seven exact render exceptions,347 exact added labels,4,571 unchanged tree instances, saved foliage alpha/coverage/shading and both roof-parent identities. |
| Rendered appearance | Final720 and Final1080 each complete42/42 PNGs and21 matched comic/F2 pairs, with identical camera instructions. Both owned processes exit normally0. Both closed logs pass dependency/shader/fatal guards. All 84 PNG signatures, dimensions, chunks/CRC and complete IEND are verified. |
| Independent visual review | The audit agent viewed36 final frames across both sizes; the building agent viewed32 targeted final frames plus two cooked spot checks; the tree agent viewed19 final editor frames plus two current cooked views. Reviews overlap. These counts do not claim each reviewer inspected all 84 images. Treated geometry/materials pass with the limitations below. |
| Native gameplay/save | HUD/story suites pass121 checks and21 PNGs at each size. Collision and population each pass13 checks. The final minimal continuous race passes7 gates in63.153 seconds,27,105.94 cm of actual travel, zero checkpoint retries, traffic/collision active and QA/production saves restored. |
| Fresh Linux package | BuildCookRun exits0 in69.06 seconds; cook reports0 errors and0 warnings. Separate host/client verification exits0, loads2,537 meshes across8 strict families (347 Perimeter),8 crew/32 clips/66 resident parts and seven complete1600×900 screenshots. Both peer dependency logs pass. All 48 non-Saved local/browser files match SHA-256. |
| Current frame budget | All six unchanged Epic3/100% packaged CSV profiles pass p95<16.67 ms. Managed harness reports `Result=success`, `ExecMainStatus=0`, inactive/dead. Six closed rendered logs pass. |
| Browser and mobile | Existing normal lifecycle restored after the unchanged12,000 MiB guard observed15,613 MiB free with no native jobs. Ordinary-network public two-player checks pass7/7; mobile touch emulation passes6/6. Both QA processes exit0. Current decoded game/HUD screenshots were independently inspected. |
| Preservation | Before host startup, all 651 protected identities match; only two test-mutated editor INIs were restored. Seven new package screenshots were copied and hashed before protected Saved output restoration. After real friend startup,650 identities remain exact; the sole difference is the native guest `CachedClientID` counter25→26. Existing saves remain unchanged, no new save paths exist, and neither audit writes progress. |

The QA race fix is only a950 cm final-gate lookahead in the automated driver, plus its description. The retained baseline path overshot the return leg by about9 m and current stationary traffic blocked that outside arc. Earlier aim follows the same route and passes native verification. All 32 original assertions, route/gate/travel/time thresholds, input, collision, traffic and save isolation remain unchanged. Unneeded reverse helpers were removed before the final passing minimal-source rerun. Production vehicle/gameplay source was not edited.

## Current frame budget

RTX4090, i9-14900K, Linux, Unreal5.8.3/VulkanSM6. Epic3,100% screen percentage, comic on, VSync off, uncapped. Each profile records3,000 CSV frames, discards the first600 and final2, and retains2,398. These are current cooked assets, replacing baseline results for acceptance.

| Scene | Size | p95 ms | Average FPS |
|---|---:|---:|---:|
| Sherbrooke | 1280×720 | 12.90 | 102.7 |
| Pond | 1280×720 | 13.35 | 98.4 |
| NorthPark | 1280×720 | 12.90 | 102.9 |
| Sherbrooke | 1920×1080 | 14.79 | 85.4 |
| Pond | 1920×1080 | 15.14 | 82.0 |
| NorthPark | 1920×1080 | 14.69 | 86.1 |

Worst p95 is15.14 ms. Native static-camera averages82.0–102.9 fps do not mean60 fps streaming: the real public test observed host25.3 and friend23.9 decoded fps. No stream/network speed improvement is claimed by this art pass.

## Preserved failures and actual recovery

1. Initial relative-project startup could not locate the uproject and crashed. Later commands used the absolute existing project. Initial neighbourhood CPU runs lacked Shapely in system/bundled Python; the existing geo virtual environment passed. Original logs remain.
2. The first tree graph emitted sampler/desaturation warnings and failed rounded bounds equality. The diagnostic proved identical raw geometry:1,777,278 vertices,2,062,487 triangles and position hash `0ae600f1573ebfb2fc582232564c9c13f5cf2b1ca2abedd1a5de47e9accbfed8`. The maximum quantized render-proxy bound shift was0.042252 cm. The final guard requires exact raw geometry and rebuilt source bounds; saved alpha uses Masks/TC_MASKS. All fresh saved/native/render checks pass.
3. Rendered material authoring asserted `NumRefs >= 0` in RHIResources.h during material shader cleanup, before perimeter import/map save. Offline NullRHI authoring completed and all final Vulkan render checks subsequently passed. Quality defaults and guards were preserved.
4. A temporary background fixture lacked its new exact visual manifest. Explicit fixture/visibility tests were repaired, retaining all old corruption checks. Four new actor labels initially collided with the old landmark prefix; the disjoint `Plateau survey context ` labels resolved it without changing the original landmark verifier.
5. Missing owned roof-parent disk packages were a real dependency failure. Rejected partial720 images and logs remain. Root canceled only the owned capture viaSIGTERM at16:16:49; teardown exited139, so it is rejected. Both parents are now explicitly saved, instances reparented and fresh disk/identity checks required. Final closed logs are clean.
6. A normally completed, clean42-frame pre-side-repair720 capture still showed two giant blue side-card planes. It remains rejected under `PreSideRepair720`; two exact additional footprint edges were fixed. Both complete final resolution sets and independent targeted reviews now pass. Exit0 alone never accepted that earlier visual failure.
7. The old continuous driver twice stalled after six gates against the same traffic car. Conservative arc and straight reverse preflights rejected safely with zero maneuvers. All failures remain. The minimal final-gate guidance passes every original assertion in the final normal native run.
8. The first final performance parent ended143 and wrote no aggregate, although its sixth child completed its3,000-frame CSV normally. Cause remains unknown. All interrupted files/hashes remain rejected under `InterruptedPerformance`. The unchanged full six-profile suite was rerun under a managed one-shot unit and completed normally with all six strict passes. Partial or reconstructed results were not accepted.
9. The first public-live command failed before browser launch because the worktree Playwright path did not exist. The already installed bundled Node/Playwright runtime was used; no installation or code change. Actual desktop/mobile runs pass normally.
10. The initial exact651 post-live identity check failed on the native guest reconnect counter. Its failure is retained. The subsequent byte-specific audit confirms only `CachedClientID25→26`, with650 other identities and all existing saves unchanged. Active client runtime state was not restored merely to force a hash match. Pre-host preservation still matched all 651 exactly.

Historical failed/candidate evidence is retained with SHA-256 identities in [EnvironmentPolish.json](EnvironmentPolish.json). Repeated historical paths in that report record checkpoint hashes; final identities are explicitly referenced in the final acceptance sections. Existing Verification reports remain historical and were not overwritten.

## Browser scope and restoration

Public player: [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). Desktop evidence: `Browser/.qa/live-2026-10-11T17-11-31-006Z/summary.json`; mobile evidence: `Browser/.qa/mobile-2026-10-11T17-13-02-348Z/summary.json`.

Real host/friend decode, native input, third-slot rejection, recovered-slot reconnect and original-host reconnect pass. Mobile checks cover decoded media, portrait/landscape/fullscreen layout, simultaneous movement/look/jump, native data-channel packets, keyboard activation and held-key release on disconnect. Reviewed fullscreen controls clear radar/attribution/objective regions. Portrait retains a small letterboxed view; landscape is recommended. Existing favicon404 diagnostics are recorded; they are not native asset failures. The active host/friend asset-log scan is a snapshot, not a closed-process exit claim. QuickTunnel/TURN and unrelated applications were preserved; QA clients are closed and the normal host remains active.

## Honest remaining limits

- No copied Google imagery, exact Street View reconstruction or every-building likeness claim. Some farther background/rear elevations retain generic masses and repeated flat blue window cards outside the four repaired side edges.
- All 154 authored façade finishes/opening rhythms are estimates.85 heights use the untagged three-storey fallback;69 use tagged storeys at3.2 m. None has a measured OSM height tag.
- Le Neuville and school use retained 2016 municipal exterior massing with estimated façade decoration. Reviewed roof/base/wing seams pass; original 9.6 m gameplay colliders remain and no interiors or upper-floor access were added.
- Notre-Dame hospital retains its simplified35.2 m shell. The ambiguous1334 Sherbrooke municipal association (IoU0.649) was not automatically replaced. Espace La Fontaine/Calixa remain illustrated.
- Existing flat ground, pond banks, pond shape and simplified terrain remain. NorthPark water is still flat/pale at the reviewed angle, also visible in baseline; smooth gradients do not establish precise reflective fidelity everywhere.
- All 4,571 trees retain one source crown/species geometry. Static near/far images do not establish temporal shimmer, wind quality or species variety.
- Chromium touch emulation does not establish physical iPhone/Android, cellular/off-LAN NAT, audible quality, other hardware or subjective driving feel. No60 fps browser claim.

## Evidence identities and OpenSpec

All paths below are relative to `games/nord-unreal`; the JSON includes file sizes and exact capture/source/package hashes without embedding screenshot data.

| Evidence | SHA-256 |
|---|---|
| `Saved/Tests/EnvironmentPolish/CPU-Audit-delivery-20261011T163737168047Z.json` | `699042fd8742e920e370a94f6371c9a196dd270408b113491db6276577e9f2bb` |
| `Saved/Tests/EnvironmentPolish/GraphicsFreshLoad-20261011T163947736014Z.json` | `57ff63858cf923a8a73508e2329971257d41e571a3f9bf3f39a1af8323d54dcd` |
| `Saved/Tests/EnvironmentPolish/RaceDrive-final-minimal.json` | `bfb12203a8709c756023e3ef14919ba747c47d257ee5de54dfa4f2d028e15943` |
| `Saved/Tests/EnvironmentPolish/FinalVisualAudit.json` | `d8db5d49ef74ed3771ebcbb31ebc81cef7e4580b7c2df8633916e61059ec854c` |
| `Saved/Tests/EnvironmentPolish/PreviewPromotion.json` | `8a3a263df6193a36ffca9b97887af07b440c6e24b228c1d7869cb37043c5558b` |
| `Saved/Tests/EnvironmentPolish/FinalPackageAudit.json` | `52931976b5554bfd5cd0a205f93ca756278d1e97427622037c0fa49b24823fb7` |
| `Saved/Tests/EnvironmentPolish/FinalPerformance.json` | `8f8d412452a940f33b99bac5317e4d3d9c0ba20e791da8440bba97e69af7ca34` |
| `Saved/Tests/EnvironmentPolish/PerformanceProcess.json` | `1a780a9f12406f3af63a9d2874a3021cc65516f483150e3fad3655fd8f00eb60` |
| `Saved/Tests/EnvironmentPolish/Preservation-20261011T170628766469Z.json` | `483ac10bb858f8cc263cf6f193e703aff8638a3d1a7db5e46fb082dfa346962a` |
| `Saved/Tests/EnvironmentPolish/PostBrowserAudit.json` | `0c967a90758fddcf52bdac9df8276546dbd442e47bd7e1a744d49831cde18c4d` |
| `Saved/Tests/EnvironmentPolish/OpenSpecManual-final-accepted.json` | `36b8aeefd781a7a2bfa3d96b4000ce28f2448c26407157e4103048a11a6d76a4` |

The recovery copy at `Saved/Recovery/environment-polish-20261011T145444Z` preserves6,364 Content and651 protected files; its baseline manifest SHA is `815deb3bfb3961051884fdd2b1cc5fe0262a78e9b74469d726160b2dbb7eb729`.

OpenSpec's one added requirement and ten WHEN/THEN scenarios were manually validated; all 14 tasks are complete. The canonical `openspec/specs/nord-unreal/spec.md` retains prior content and adds the single requirement once. The four-file change is archived at `openspec/changes/archive/2026-10-11-nord-environment-polish`. The CLI is unavailable, so no CLI validation is claimed. Physical-phone/audio/off-LAN and other limits remain explicit.
