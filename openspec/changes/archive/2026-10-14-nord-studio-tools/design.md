# Design

## Scope

Changes reach the local Codex skills directory, pinned external tool environments under `~/.local/share/nord-tools`, a small VibeUE trial entry point, audition files under ignored `Saved/ToolTrials`, and documentation/verification. They do not reach gameplay callers, native runtime modules, the main `.uproject`, production assets, browser configuration or packages. New nontrivial trial scripts receive a focused self-check or direct assert-based smoke test.

## Sources and choices

- [Quodsoler Unreal skills](https://github.com/quodsoler/unreal-engine-skills): select only project context, materials/rendering, animation, replication and testing guidance for UE 5.8; inspect and pin their source. Their upstream compile-validation claims are not local verification.
- [VibeUE](https://github.com/kevinpbuckley/VibeUE): reuse native MCP and its PerformanceService. Build and test in a separate host before considering production editor adoption. Check in-process trace start/stop/readback there. Require clean process completion before promotion; reject the trial if analysis fails despite successful API response fields. Separate-process PIE is not packaged-game performance; Windows-only graceful standalone shutdown remains an explicit Linux limitation, outside this trial. Rendered NORD drive profiling depends on passing that prerequisite and a safe isolated scene/resource window.
- [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5), [model card](https://huggingface.co/ACE-Step/Ace-Step1.5): generate ordinary instrumental audio offline with the MIT-licensed model, without a runtime AI service. Use explicit original prompts, seeds and a minimal model configuration; keep results as auditions rather than silently replacing current sound.

No new rendering/art technique is implemented. No CHORD or Hunyuan-Foley assets are introduced because of their reviewed license restrictions. No Unity/Godot migration or additional general MCP bridge is needed.

## Resources and verification

The machine has one RTX 4090 and an active two-process browser demo. Inspect current GPU use and job ownership before each GPU launch. Keep downloads and environments bounded by available disk; do not fetch optional music LMs or vLLM for the initial audition. CPU builds run at low priority with capped parallelism. Keep tool failures and logs, and distinguish a tool-load smoke test from real NORD gameplay profiling.

Capture source revisions, tool versions, commands, normal exit status, output identities and structural audio checks. Keep CLI absence, compatibility failures, inaudible/unreviewed audio and any pending rendered trial explicit. The running NORD package is not rebuilt for this change.
