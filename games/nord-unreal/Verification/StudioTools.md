# Selected studio tools — 2026-10-14

The user authorized the reviewed shortlist. Five Unreal skills are installed.
The VibeUE source build passes, but its isolated trace-analysis trial is rejected
for active-game adoption because the engine process exits 1. ACE-Step is installed
and three music auditions pass their structural checks. No production audio,
native gameplay, project plugin configuration, package or browser release is
changed by this trial.

## Installed guidance

`ue-project-context`, `ue-materials-rendering`, `ue-animation-system`,
`ue-networking-replication` and `ue-testing-debugging` are installed globally in
`~/.codex/skills/`, available next turn. Source pin:
`quodsoler/unreal-engine-skills@f3742d7b688690810df369802b90430324e380b9`.
All are upstream version 2.0.0 / UE 5.8, with MIT license and local provenance.
The installer and checks passed for frontmatter, linked resources and all 14
upstream skill/reference blobs. Existing skills were not replaced. Upstream API
compile-verification claims were not repeated locally.

## VibeUE compatibility trial

Source pin: `kevinpbuckley/VibeUE@dc051be7c49b08e613ca7a2196fe9f39c9b52119`.
The isolated Linux UE 5.8.3 plugin build completes all 110 actions, exit 0, in
86.38 seconds. The external plugin loader also loads its module without changing
the test host's plugin list; NORD's `.uproject` remains unchanged.

The bounded NullRHI checks load WorkflowService, PerformanceService and
TransactionService and exercise in-process trace capture/readback. API success
does not establish clean runtime acceptance: the retained trace-analysis attempts
emit TraceServices memory-tag errors and exit 1. The first attempt additionally
exposes an immediate `TRACE_NOT_FINALIZED` response before the trace finishes
writing. Three distinct attempts are retained; no plugin source patch or forced
green result is used.

**Decision: keep VibeUE isolated and do not enable it in active NORD.** A rendered
NORD drive was not attempted after the prerequisite failed. No frame-rate gain,
MCP endpoint acceptance, packaged profile or Linux standalone shutdown is claimed.
Keep the existing packaged CSV profiling pipeline. Commands, source boundaries,
raw reports and known Linux limitations are linked from
[Tools/VibeUE](../Tools/VibeUE/README.md).

## ACE-Step audition

Source pin: `ace-step/ACE-Step-1.5@ca1e85fe9430179831e6bc6be790c332190a3866`.
The model checkpoint is pinned separately in the local download manifest.
The isolated Python environment and downloaded models live outside the game
under `~/.local/share/nord-tools/ACE-Step-1.5/`.

The entry point, original instrumental prompts, seeds, install/download logs and
audio reports are in `Saved/ToolTrials/ACE-Step/`. The initial candidates use a
1970s instrumental band palette for neighborhood walking, street racing and a
garage. No named-artist reference or existing recording is supplied. Outputs
remain audition material, pending listening and loop editing; none is imported
over current ambience or feedback cues.

All installation, download/hash, settings, import and final generation processes
exit 0. All 28 original model files pass size/hash checks. The standard loader
synchronizes two model Python files from the pinned tool source; original and
runtime hashes are recorded separately. The tool's tracked source remains clean.
The initial missing optional timing-wrapper launch exits 127 before Python and
is retained separately from the successful runs.

The CPU fallback uses four Torch threads and hides CUDA to avoid interrupting the
other tasks' rendered NORD QA. Each candidate is a 25-second, stereo 48 kHz PCM16
WAV. Finite/non-silent signal, unclipped peak, duration, output hashes and
independent ffprobe checks pass. Actual generation takes 65.4, 48.3 and 47.2
seconds respectively, with about 14.38 GiB peak RAM and zero GPU allocation.

| Candidate | Seed | Local output under `Saved/ToolTrials/ACE-Step/` |
| --- | --- | --- |
| Neighborhood | 197401 | `run-20261014T162946Z/neighborhood.wav` |
| Street race | 197402 | `run-20261014T163117Z/street-race.wav` |
| Garage | 197403 | `run-20261014T163225Z/garage.wav` |

[Open the local audition page](../Saved/ToolTrials/ACE-Step/index.html).
`setup-provenance.json` retains exact commands, process exits, environment
versions and per-track report paths. Installed ACE-Step footprint is 17.06 GiB;
35 GiB remains free on the home filesystem. Listening, lack of vocals, musical
suitability, originality and seamless looping are unverified. No output is
represented as production-ready audio.

## Preservation and checks

Raw baseline: `Saved/ToolTrials/StudioTools/baseline.json`, beginning at repository
HEAD `6b09138bdc09e29acf90fca9a43339b5e84d9439`. Its scope is the main `.uproject`,
saved maps and existing `.sav` files in current local/browser package Saved roots.
All four baseline identities match at completion. Concurrent gameplay/audio and graphics work remain separately owned; changes
made by those tasks must not be misattributed to this tooling trial.

Manual OpenSpec structure checks passed for four requirements and four WHEN/THEN
scenarios. The OpenSpec CLI is unavailable. Focused script/runtime checks and
their actual completion statuses replace no visual, audible or physical-device
acceptance. This trial does not restart or deploy NORD services.
