# NORD funded mature-character pilot — 2026-10-14

The new curly-haired style-9 body has mature proportions, integrated utility trousers/high-tops and its own matching animations. It is imported separately at `/Game/ParkComic/CrewGraphicNovelGenerated/Resident9`; both `-NordGraphicNovelCandidate -NordGraphicNovelGenerated` are required to select it. Candidate alone retains the previous 44-bone pilot; ordinary launches retain the production cast. The new body reuses the existing selective ink and stencil 254. No live package was replaced.

[Actual model CPU preview](../Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/review/CPU-body-three-quarter.png), [face](../Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/review/CPU-face-front.png) and [hand side view](../Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/review/CPU-hand-left-side.png) are **Cycles CPU model reviews, not Unreal screenshots**. Eleven retained views show body/face/hands and sampled own-clip poses. The body/clothing improve the silhouette and coverage. Coarse hand facets, pale/smooth face shading, rope-like shiny curls and a jagged collar rim still need native review/refinement. Five separate digits are visible in both side crops. The 24-bone generated rig has zero finger controls and zero face morphs: face and fingers remain static.

| Verification | Result |
| --- | --- |
| Retained source geometry | 31,026 triangles, 43,807 UV-split vertices, 1.82 m; zero unweighted vertices |
| Own Idle/Walk/Run | Exact body hierarchy/bind match, 138 animation curves each |
| Own Jump | Locally authored against the new body; 1.2 s, exported/reimported, no actor root motion |
| Native import | Exit 0; twelve new packages, one assigned PBR material; supplied FBX bind pose recreated by SDK, missing-smoothing warnings retained |
| Editor build / native animation | Exit 0; all four tests pass, including actual generated-body/own-clip selection; the hand/eye test still covers the older articulated pilot |
| New-body seven-state headless check | Seven states pass, 29.45 s; imported atlas pixels match source, own skeleton/root/pose checks pass |
| New-body 1× headless transitions | Standard 182 selected observations/21.88 s; comic 180/21.85 s. Eight phases pass; 90° turn, 183.673 cm jump, zero horizontal actor drift |
| Default-game regression | Seventy checks pass with two in-process PIE peers, 44.54 s; production cast selected |
| Preservation / logs | All 333 protected source/asset hashes unchanged; six closed native logs pass dependency/shader/fatal scan; every listed process exits 0 |

Motion observations retain native controller camera/HUD/materials and use native movement callbacks on a clear fixture pitch. Physical input is disabled, cars/residents are hidden and collision disabled; NullRHI forces bone refresh for observation. Selected observations are capped at 30 per world second and do not measure rendered FPS, motion fluidity, city collisions or candidate co-op. The separate seven-state fixture slows locomotion observation and pauses for capture state. Full editor INI byte preservation is not claimed.

The source has UV-split edges. A copy-only position weld reports 48 boundary and 91 non-manifold edges; this body is not claimed watertight. Sampled shoe minima against the fixed studio plane range from −1.1 cm in idle to +4.5 cm in run. These samples do not establish planted feet or continuous deformation.

The user authorized US$25 of fal spending. Exactly one model job was submitted, completed and downloaded:

- Endpoint: `meshy/v7.1/image-to-3d`
- Request: `01a13897-127f-7c01-8e00-272ff4d5c998`
- [Provider GLB output](https://v3b.fal.media/files/b/0aae4cec/DO-CuG9PUEMk9RZfOUDUN_rigged_character.glb) — exact local body/result retained below.
- [Generation inputs and provenance](../Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/generation.json), [completed result](../Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v1/result.json), [budget ledger](../Data/GraphicNovel/budget-2026-10-14.json).

The [published standard textured/rigged/animated setup](https://fal.ai/models/meshy/v7.1/image-to-3d) is **US$1.52**. The ledger conservatively reserves US$2, leaving US$23 uncommitted (US$23.48 estimated unspent). The connector returns neither settled charge nor actual balance. No additional fal jobs or automatic top-ups were submitted.

Seven other crew references are cleaned and independently reviewed under `Data/GraphicNovel/Crew/`: BlackCap, LimeJacket, GreenCap51, Memphis33, WhiteCap, RedJersey and Topknot. Exact built-in ImageGen edit prompts and source/prompt/output hashes are retained with each. GreenCap's first ambiguous-hand edit remains as `reference-v1.png`; its accepted image-only revision shows five separated digits. These are model-draft sources, not generated replacement bodies or in-game acceptance. Further model spending is held until the pilot's rendered appearance is reviewed.

[Curated verification and hashes](GraphicNovelFundedPilot.json) identify the tested source/assets. Raw process logs/reports, the first rejected CPU framing attempt and signed queue recovery receipt remain locally under ignored `Saved/Tests/GraphicNovel/FundedPilot/`. Rendered checks at 1280×720/1920×1080, unpaused video/line stability, native face/hand/foot contact, candidate co-op and current cook/package/performance/browser/physical-phone checks remain open. The shared live demo still occupies the GPU; no rendered process or service action was performed by this pass. `graphics_accepted=false`; the city-quality change remains active.

`/Game/ParkComic` is in `DirectoriesToAlwaysCook`, so future cooks include these new review packages even when selection is off. They occupy about 25 MiB on disk; actual cooked-size/performance impact has not been measured.
