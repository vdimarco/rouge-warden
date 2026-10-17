# Design

## Sources and existing patterns

- Installed `ue-testing-debugging` and its `references/profiling-commands.md`: triage CPU/render/GPU timing, retain warmed native CSV baselines and compare the same workload/settings.
- Installed `ue-animation-system` and engine `USkeletalMeshComponent::RefreshBoneTransforms`: manually driven pose work does not disappear merely because an actor is hidden. Keep authority simulation before the visual early return; use the existing absolute animation clock after unhide.
- Pinned ACE-Step 1.5 trial and the existing controller feedback SoundWave references/import guards: use ordinary cooked audio with recorded prompts, seeds, hashes and the MIT model license. No model enters the game.
- Existing `Scripts/profile_package.py`, `test_race_drive.py`, resident/story fixtures and `render_log_guard.py`: reuse their native behavior/measurement methods, retain historical reports and isolate saves/settings.

No new rendering or art technique is introduced. Musical loop preparation uses a bounded overlap/crossfade on the generated audio and validates finite, unclipped samples and seam continuity; it does not establish subjective musical acceptance.

## Scope

The performance correction reaches the resident body tick default, `AQuebecParkResident::Tick` and a focused native hidden/unhide regression test. The first native run exposed that constructor `SetComponentTickEnabled(false)` ignores the component template; replacing it with `PrimaryComponentTick.bCanEverTick = false` prevents autonomous registration while retaining active/rendered state and the existing explicit pose calls. The test checks actual tick registration as well as hidden pose freeze and current-time recovery. It must not change authority travel, reaction clock compensation, crew visibility rules, collision, visible animation cadence, scene count or render settings.

Music reaches original derived PCM/provenance, a bounded offline importer, two owned SoundWaves, the local controller audio lifecycle and focused tests. Reuse current campaign state for neighborhood/race selection; hard references ensure cooking. Local controllers alone play music. Stop on controller teardown, avoid restarting unchanged tracks each tick, and keep level below existing one-shot feedback. No map edit is needed.

Keep the module structure, reuse current audio components and avoid introducing an extra manager or dependency. Preserve the uncommitted resident-feedback work and other tasks' source/assets. Source and installed package are distinct until verified packaging/promotion.

## Checks and resources

Record source/map/package/save baselines, actual settings/hardware and owned process exits. Use CPU/native checks first, then serialized rendered/profile/cook/package work in a coordinated window. Retain the existing GPU launch guard, public/Funnel/TURN services and all live save roots. Restore any deliberately paused owned demo through its existing lifecycle and verify real browser media/input afterward.

Compare warmed frame/game-thread/animation timing without promising an FPS gain from one correction. Require hidden residents' authority route to continue, poses to stay unevaluated while hidden and visible animation to catch up on the first visible tick. Check quiet music selection, unchanged-track continuity, local ownership, teardown and cooked dependencies. Native mixer output and browser decoded sound establish narrower scopes than listening on physical speakers/phones.
