# UE Project Context — NORD

*Engine association: `5.8` · Installed engine: UE 5.8.3 · Last checked: 2026-10-17*

This is the repository-root context for `games/nord-unreal`, generated from current source/configuration and dated local verification records. It is guidance, not a new gameplay, package or device acceptance result. Read [repository instructions](../AGENTS.md) and the [game handoff](../games/nord-unreal/CLAUDE_HANDOFF.md) first; later dated records supersede older handoff/README assertions.

## Engine and project

- Active project: [Quebec.uproject](../games/nord-unreal/Quebec.uproject); product name **NORD**, a Montréal neighborhood co-op game around Parc La Fontaine and 1334 Rue Sherbrooke Est.
- `EngineAssociation` is literally `5.8`. Local installed/promoted Linux engine: `~/.local/share/Epic/UE_5.8.3`; `Engine/Build/Build.version` records 5.8.3, changelist 58210709, `++UE5+Release-5.8`, and `InstalledBuild.txt` is present. Engine modifications are [unknown].
- Active map: `/Game/Maps/LaFontaine`, set as both game and editor default. `/Game/Maps/Quebec` is the old blockout. Linux/Vulkan SM6 is the configured and verified native platform; other OS/device acceptance is not established. `.uproject` has no `TargetPlatforms` list.
- The retired `Documents/ChatGPT/GTA_ Quebec` directory is a notice only; original history/assets are archived separately. Do not recreate the game there.

## Modules and build

| Module | Type / phase | Public dependencies | Private dependencies |
| --- | --- | --- | --- |
| `Quebec` | Runtime / Default | `Core`, `CoreUObject`, `Engine`, `InputCore`, `NetCore` | `PixelStreaming2`, `PixelStreaming2Core`, `AnimGraphRuntime` |

[Build.cs](../games/nord-unreal/Source/Quebec/Quebec.Build.cs) uses `UseExplicitOrSharedPCHs`. [QuebecTarget](../games/nord-unreal/Source/Quebec.Target.cs) is Game; [QuebecEditorTarget](../games/nord-unreal/Source/QuebecEditor.Target.cs) is Editor. Both use `BuildSettingsVersion.V7`, `EngineIncludeOrderVersion.Unreal5_8`, and extra module `Quebec`. No project Client/Server target, custom build define or direct third-party library is declared. Packaging selects Linux Development, pak/IoStore files and shared material shader code. The current combined verification explicitly cooks both LaFontaine and CollegeBathurst plus configured always-cook art/material directories.

## Plugins

Explicit enabled entries in `.uproject`: `PythonScriptPlugin` (Beta), `EditorScriptingUtilities` (Beta), `ModelContextProtocol` (Experimental), `AllToolsets` (Experimental), `PixelStreaming2`. `AndroidFileServer` is explicitly disabled. Maturity labels come from installed engine descriptors.

Relevant engine defaults: `EnhancedInput`, `Metasound`, `Niagara` have `EnabledByDefault: true`. `GameplayAbilities`, `CommonUI`, `StateTree`, `Iris` (Beta), `ReplicationGraph` (Beta), and `GameFeatures` (Beta) default false and have no project enable override. The `GameFeatureData` AssetManager scan entry alone does not enable GameFeatures or GAS. There is no project `Plugins/` directory. This is a focused list, not an exhaustive transitive plugin inventory.

Native MCP starts on port 8001 through [launch.sh](../games/nord-unreal/Scripts/launch.sh) editor mode. The isolated VibeUE trial stays outside the project and is **rejected for active adoption**: trace analysis emitted engine memory-tag errors and exited 1. Do not enable it or treat plugin-load/API success as runtime acceptance; see [StudioTools](../games/nord-unreal/Verification/StudioTools.md) and [pilot boundaries](../games/nord-unreal/Tools/VibeUE/README.md). Five UE 5.8 guidance skills are installed globally with pinned provenance under `~/.codex/skills/`.

## Coding and gameplay framework

Headers are flat under `Source/Quebec/`, with `GENERATED_BODY()`, Epic class/type prefixes and `QUEBEC_API` on exported declarations. Stored reflected object references use `UPROPERTY` plus `TObjectPtr`; weak references use `TWeakObjectPtr`. Observed logging uses `LogTemp`; no custom category declaration was found. Assertions exist for game-thread/road invariants; broader assertion policy is [unknown]. Preserve validation, save error handling and shared helper conventions.

| Role | Project implementation |
| --- | --- |
| GameMode | `AQuebecGameMode` (`AGameModeBase`) |
| GameState | `AQuebecGameState` (`AGameStateBase`) |
| PlayerController | `AQuebecController` |
| Walking pawn | `AQuebecCharacter` (`ACharacter` / CharacterMovement) |
| Driving pawn | `AQuebecCar` (`APawn`, custom arcade movement/collision) |
| HUD | `AQuebecHUD` (`AHUD::DrawHUD`, native canvas) |
| PlayerState / GameInstance | No project subclass or override found in the scanned source/config |
| Stream lifecycle | `UQuebecStreamIdleSubsystem` (`UGameInstanceSubsystem`), skips unwatched rendering while retaining simulation |

[QuebecGameplay.h/.cpp](../games/nord-unreal/Source/Quebec/QuebecGameplay.h) define the framework, parked cars, traffic, residents and controls. [QuebecCampaign](../games/nord-unreal/Source/Quebec/QuebecCampaign.h) implements the chalet worklight/plunger encounter and seven-gate street race. The remaining story missions are design material. Source includes native surface swimming in [QuebecSwimming.cpp](../games/nord-unreal/Source/Quebec/QuebecSwimming.cpp); older README text saying it is absent is historical. [QuebecCrewAnimation](../games/nord-unreal/Source/Quebec/QuebecCrewAnimation.h) owns a native AnimInstance/proxy and saved BlendSpace assets; inspect current source and character acceptance before extending rigs.

## Networking, saves and input

- Direct-IP listen server, default native port 7777; the browser has separate host/friend game processes in the same native session. Authority owns campaign decisions, cars/residents and shared state. Source uses reflected replicated properties, `GetLifetimeReplicatedProps`, OnRep callbacks and Server/Client RPCs. No project Iris, push-model or ReplicationGraph opt-in was found; do not migrate replication as incidental cleanup. No matchmaking/accounts/session allocator is implemented.
- `UQuebecCampaignSaveGame`: production slot `NordCampaign_v1`; isolated QA slot `NordCampaign_StorySliceQA_v1` via `-NordCampaignQA`. `-NordNoCampaignSave` disables persistence. Version 1 is completed missions 0–2 and starts the later story over. Version 3 stores that same mission count plus the pond, court, show, rescue, convoy, blank page, tour, and home steps, and starts the escort over. Version 4 adds the escort step and starts the lamp crossing over. Version 5 adds the crossing and starts the grab over. Version 6 adds the grab step and starts the short way over. Version 7 adds the short-way step and starts the chase over. Version 8 adds the chase step and starts the finale over. Version 9 adds the finale step and starts the follow over. Version 10 adds the follow step and starts the cart over. Version 11 adds the cart step and starts the bells over. Version 12 adds which bell is next and starts the block over. Version 13 adds the block step and starts the send-off over. Version 14 adds the send-off stage and starts the pursuit over. Version 15 adds the pursuit step and starts the stall over. Version 16 adds the stall step. Version 2 stays the unsupported fixture and is never written. The lamp burn, the grab clock, the rival's clock, the tail's place on the road, the finale burn, the page clock, the cut clock, the finale tail's place, the follow person's place on the path, how far the cart has rolled, how far the courier has driven, how far the send-off drive got, and how far the traffic car has driven stay in the session. Unsupported/unreadable saves are preserved, not replaced. The chain, hold clocks, court misses, cash, and side errands stay in the session. Race best/lap feedback is session state. Source: [QuebecCampaign.cpp](../games/nord-unreal/Source/Quebec/QuebecCampaign.cpp) and [QuebecStorySave.h](../games/nord-unreal/Source/Quebec/QuebecStorySave.h).
- [DefaultInput.ini](../games/nord-unreal/Config/DefaultInput.ini) selects EnhancedInput player/input-component classes, but gameplay uses legacy `BindAxis`/`BindAction` names and config mappings. No project InputAction/MappingContext stack was found. WASD movement/driving, mouse look, Shift sprint, Space jump/stroke/handbrake, E interact/car, C crew cycle, F2 local comic toggle, R recover, T race replay. Browser touch/gyro maps into the existing native controls; preserve release/cancel/disconnect behavior.
- UI is native canvas plus the browser frontend; no project UMG/CommonUI/MVVM stack is configured. Residents/pedestrians and traffic use custom authoritative routes/road graphs, not a project Behavior Tree/StateTree/Mass implementation. Streaming model/World Partition status is [unknown] without saved-map inspection; source/config contain no explicit streaming-system integration.

## Art and rendering

[DefaultEngine.ini](../games/nord-unreal/Config/DefaultEngine.ini) configures Lumen GI/reflections, virtual shadow maps, distance fields, TSR, custom-depth stencil and Vulkan SM6; static lighting is disabled. Coarse VSM pages exclude non-Nanite meshes. Preserve these defaults and the current map/material sources.

Current source starts in standard view (`bComicStyle = false`); F2 enables per-player ink/halftone post processing. The illustrated Plateau map and original supplied crew/1970s cars are the established direction. Optional Resident9 graphic-novel candidate branches in source do not prove installation into a package. Preserve original geometry, reference art, OSM/municipal attribution and current asset acceptance. Older `prepare_lafontaine.py` / `create_lafontaine.py` regenerate the previous environment; follow [Plateau provenance/regeneration notes](../games/nord-unreal/Data/Plateau/README.md) for the active scene. New visual techniques require researched sources recorded in OpenSpec design.

## Source versus installed play

[launch.sh](../games/nord-unreal/Scripts/launch.sh) prefers `Builds/Linux/Quebec.sh` for play/host/join whenever present; source/editor asset edits do not reach that package or `Builds/Browser/Linux` until intentionally built, checked and promoted. The tools-in-use pass integrates main `936d2c1` with local neighborhood/race music and suppressed hidden-resident poses. Its [verification record](../games/nord-unreal/Verification/ToolsInUse.md) establishes 37 native passes, both-district packaged checks and 48 matching non-Saved files in each installed destination with saved data preserved. Local and ordinary public browser checks each passed all eight media/input/reconnect checks on this host; physical-device/off-LAN acceptance remains separate. Do not infer the current browser package from Git HEAD, an older handoff binary hash, or an editor-only check. Compare actual package/source manifests for each new measurement.

## QA and concurrency boundaries

- Re-read current `git status` and establish owners before edits. Preserve concurrent gameplay/audio/graphics work, the integrated saved map, protected raw inputs and all production saves. Repository [OpenSpec workflow](skills/openspec-workflow/SKILL.md) applies; root agent owns the active change and acceptance scope.
- Before engine/model/capture launches, inspect live processes, services and GPU ownership. Heavy GPU jobs run serially; never kill unrelated jobs or tunnels. The browser lifecycle requires 12,000 MiB free VRAM on adapter 0 plus free owned ports/no rendered Unreal jobs; never bypass its guard or lower production defaults to pass it. Read [handoff maintenance rules](../games/nord-unreal/CLAUDE_HANDOFF.md) and [hosting](../games/nord-unreal/Browser/HOSTING.md); maintenance must preserve public/Funnel/TURN services and restore/verify actual media/input.
- Author assets in a fresh NullRHI process, let it exit, then use a separate Vulkan process for rendered verification. Preserve the project Linux editor shutdown workaround and QA teardown safeguards. Never claim a successful JSON report if its process exits abnormally.
- Choose checks through [QAPlan](../games/nord-unreal/Verification/QAPlan.md). Native automation is under `Source/Quebec/*Tests.cpp`; source regressions are `Scripts/test_*.py`. PIE checks share port 17777 and must be serial. Browser `npm test` and `test:browser` are distinct from occupied-slot-sensitive live/mobile/media tests and physical-device acceptance.
- [profile_package.py](../games/nord-unreal/Scripts/profile_package.py) measures six warmed Epic/100% static cooked views at 720p/1080p: 3,000 CSV frames, drop first 600/last two, p95 <16.67 ms. Static views do not establish continuous-driving/co-op frame times, remote latency or minimum hardware. That script overwrites historical `Verification/Performance.json` and `Preview/Performance*.png`; retarget evidence to a fresh timestamped location before repeating. Keep command lines, raw CSV, package hashes, GPU ownership and normal process exits.
- Do not print/commit/upload private relay files or credentials under `Saved/BrowserStreaming/relay/`. Generated packages, auditions, raw logs and recovery directories are local ignored evidence. Audible sound, subjective handling, physical-phone/carrier/off-LAN and naturally driven rendered packaged campaign acceptance require separate checks; source tests, emulation and decode counters do not substitute.
