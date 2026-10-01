# Working in rouge-warden

## OpenSpec

Use [OpenSpec](https://openspec.dev/) for new features, changes to gameplay behavior, substantial refactors, and work across multiple systems. Read `.agents/skills/openspec-workflow/SKILL.md` for the workflow. Apply these rules throughout the repository, together with any instructions closer to the files you change.

Before implementation, inspect the affected game and existing specs. Reuse a relevant active change or create `openspec/changes/<change-name>/` with a proposal, capability specs, design decisions, and a task checklist. Keep the documents proportional to the work. A small correction that restores intended behavior can use an existing spec and a focused check.

Write scenarios that describe observable player behavior. For game changes, cover the affected controls, gameplay states, and supported screen layouts. Define a concrete way to check visual or performance requirements. Preserve the user's requested art direction and input preferences in the relevant change.

Implement the tasks and keep the specs current as the design develops. Check off work only when complete. Validate the spec structure and separately test the code against its scenarios. State clearly when browser, phone, audio, or motion-sensor checks could not run. Archive completed changes and review the resulting canonical specs in `openspec/specs/`.

Continue work already authorized by the user. OpenSpec documents the agreed scope; it does not add a new approval gate. Follow the user's instructions for publishing and merging.

### Tool setup

The repository includes a portable workflow skill. This does not mean the OpenSpec CLI or its generated command skills are installed.

When CLI setup is needed, check the current [installation guide](https://openspec.dev/docs/installation), verify the required Node.js version, and initialize at the repository root with `openspec init --tools codex`. Review generated files before saving them. Preserve this file and other custom instructions.

Use the generated skills for the installed version. Agent commands such as `$openspec-propose` run in the assistant, while `openspec` CLI commands run in the terminal. Consult `openspec --help` and the [CLI reference](https://openspec.dev/docs/cli) for supported flags. If the CLI is unavailable, create the Markdown artifacts directly and report which validation could not run.
