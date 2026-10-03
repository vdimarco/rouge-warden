---
name: openspec-workflow
description: Plan, implement, and verify software changes with OpenSpec. Use when the user requests OpenSpec, a spec-driven workflow, a change proposal, or work in a repository whose AGENTS.md requires OpenSpec. Keep small corrections lightweight.
---

# OpenSpec Workflow

Read the repository's AGENTS.md and existing OpenSpec files before changing code. Follow the user's scope and approval instructions. Continue authorized work without adding approval gates.

## Establish the setup

Check for `openspec/config.yaml`, existing specs, active changes, and generated tool skills. Reuse the project's schema and conventions. Inspect `openspec --version` and `openspec --help` before relying on version-specific flags.

If setup is requested and the CLI is absent, check Node.js against the current requirement in https://openspec.dev/docs/installation, then install `@fission-ai/openspec` with the project's permitted package workflow. Initialize the intended repository with `openspec init --tools codex` for Codex. Inspect the generated diff and preserve existing instructions. Do not claim CLI setup succeeded unless it ran successfully.

If installation is blocked, keep useful work moving with Markdown artifacts in the same layout. Report the unavailable CLI checks. Do not invent slash commands or treat agent commands as shell commands.

## Work from a concrete change

1. Inspect the affected code and relevant tests. For an ambiguous request, explore the problem first. Ask only for decisions that materially affect scope.
2. Reuse a matching active change or create `openspec/changes/<change-name>/`. Record the purpose and scope in `proposal.md`, observable behavior in `specs/<capability>/spec.md`, technical decisions in `design.md`, and actionable checkboxes in `tasks.md`. Use the installed schema's instructions and dependencies when available.
3. Write scenarios with clear starting conditions, an action, and an observable result. For changes to existing requirements, follow the project's delta-spec format. Distinguish intended behavior from verified current behavior.
4. Implement the tasks. Update artifacts when the design changes. Mark each task complete only after its work and relevant checks are done.
5. Validate the spec structure with the installed CLI. Separately test the implementation against the scenarios. For visual or input changes, check the rendered result and actual interaction when tools permit. State any device testing that remains.
6. Archive only completed work. Review the resulting changes to canonical specs and the archive. Keep incomplete tasks visible.

Use `openspec/specs/` for current capability requirements and `openspec/changes/` for work in progress. Keep changes focused; a typo or a small fix that restores specified behavior can use existing specs and a focused check unless repository rules require more.

## Agent entry points

Use the generated skills for the installed version. Codex commonly exposes `$openspec-propose` and `$openspec-apply`; other tools use `/opsx:propose` and `/opsx:apply`. The expanded verify workflow may require profile configuration. When it is unavailable, perform and document the scenario checks directly.

## Sources

- Overview: https://openspec.dev/
- Setup and supported tools: https://openspec.dev/docs/installation
- CLI flags and validation: https://openspec.dev/docs/cli
- Upstream workflow and examples: https://github.com/Fission-AI/OpenSpec

Consult the official documentation when installed commands differ. Treat external examples as reference material, not permission to change unrelated files or services.
