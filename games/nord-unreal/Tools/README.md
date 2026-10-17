# Selected studio tools

This work adds development guidance, an isolated editor-plugin pilot and local
music generation. The applied gameplay pass is recorded in
[ToolsInUse](../Verification/ToolsInUse.md); the existing package/browser QA remains the acceptance path.

## Unreal guidance

Five global Codex skills are installed and available under `~/.codex/skills/`:

- `ue-project-context`
- `ue-materials-rendering`
- `ue-animation-system`
- `ue-networking-replication`
- `ue-testing-debugging`

Source: [quodsoler/unreal-engine-skills](https://github.com/quodsoler/unreal-engine-skills),
commit `f3742d7b688690810df369802b90430324e380b9`, version 2.0.0, targeting UE 5.8.
Each installed directory retains MIT `LICENSE` and `SOURCE.txt`. Installation
validated frontmatter, linked resources and the exact upstream blobs for all 14
skill/reference files. Upstream API/example compilation is a maintainer claim;
this trial does not recompile every example.

## VibeUE

See [the isolated pilot](VibeUE/README.md) for pinned source, build/smoke commands,
boundaries and Linux standalone-trace limitations. The plugin builds and loads
outside NORD under `~/.local/share/nord-tools/vibeue-pilot/`, but trace analysis
emits engine memory-tag errors and exits 1. Adoption is rejected until that issue
is resolved; the main project does not enable it. Retain
`Scripts/profile_package.py` for real cooked-game frame budgets.

## ACE-Step music

The pinned [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) source and
isolated environment are under `~/.local/share/nord-tools/ACE-Step-1.5/` at
`ca1e85fe9430179831e6bc6be790c332190a3866`. Its
[model card](https://huggingface.co/ACE-Step/Ace-Step1.5) permits commercial music
generation under MIT. No runtime music model or API service is added to NORD.

The local audition entry point, prompts, seeds, setup logs, model identities and
generated files are under `../Saved/ToolTrials/ACE-Step/`; open its
[audition page](../Saved/ToolTrials/ACE-Step/index.html) to play all three.
The three candidates
cover neighborhood walking, a street race and a garage, using original
instrumental 1970s band palettes without named-artist references. Two derived loops now provide quiet neighborhood/race playback; see
[their provenance and limits](../Data/Art/Music/README.md). Listening has not
accepted musical quality or beat alignment. Procedural ambience and feedback cues
continue through their existing paths.

## Evidence and resources

The development record is `../Verification/StudioTools.md`; raw trial evidence is
under `../Saved/ToolTrials/` and the external VibeUE evidence directory. External
dependencies, caches and generated auditions are intentionally not vendored.

Read current repository instructions and `CLAUDE_HANDOFF.md` before any engine
or model launch. The GPU is shared with live play and other tasks; observe current
ownership, preserve launch guards and serialize heavy GPU jobs. No network
research, terrain API or Fab-account tools are part of this pilot.
