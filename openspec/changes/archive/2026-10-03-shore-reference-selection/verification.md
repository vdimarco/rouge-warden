# Verification

Completed and archived 2026-10-03. Final CI and source capture review passed.

## Published review

- Branch: `codex/shore-reference-selection`.
- [PR #153](https://github.com/vdimarco/rouge-warden/pull/153) was merged by the user.
- [PR #154](https://github.com/vdimarco/rouge-warden/pull/154) contains the compact caption fix, final archive and QA evidence.
- [Verified preview](https://warden-git-codex-shore-reference-selection-vdimarcos-projects.vercel.app/tidebreak/).

## Completed evidence

[Final browser run 37136817782](https://github.com/vdimarco/rouge-warden/actions/runs/37136817782), run 60, passed at source commit `c5c9fe2a6ea3b89a4dfcedf1eaf21ed15c89ec21`. Browser job `111242919669` covered all six sizes below. Every viewport's control and caption checks passed. The same workflow completed all 36 seeded matches.

| Layout | Width | Height | Source capture |
| --- | ---: | ---: | --- |
| Desktop reference | 1536 | 864 | [Desktop](../../../../docs/shore-selection-desktop.webp) |
| Phone | 390 | 844 | [Phone](../../../../docs/shore-selection-phone.webp) |
| Small phone | 320 | 568 | [Small phone](../../../../docs/shore-selection-small-phone.webp) |
| Landscape | 844 | 390 | [Landscape](../../../../docs/shore-selection-landscape.webp) |
| Compact desktop | 1000 | 700 | [Compact desktop](../../../../docs/shore-selection-compact-desktop.webp) |
| Short desktop | 1536 | 700 | [Short desktop](../../../../docs/shore-selection-short-desktop.webp) |

The earlier [four-viewport run 37134311347](https://github.com/vdimarco/rouge-warden/actions/runs/37134311347) also passed at commit `0e14c3e17aa5a9a85d33149a85d8736b7521edec`.

The checks selected all sixteen identities, loaded their stage artwork, checked the source atlas and scene, verified role filters and four-column keyboard travel, inspected skills by hover and tap, used menu panels and started Tidewarden. Training, movement, shared creature sprites, pause and resume remained functional. Compact roster checks used native touch events from a portrait and required vertical scroll within the roster. Screenshots were compared with the supplied reference and the layout defects found during review were corrected.

Focused deterministic tests passed for sixteen identities, bot assignment, skill descriptions, identity spellbook names, optional sprite fallback and preserved attack poses. The identity test compared combat states with and without display identities and verified that assignment consumes no combat randomness. Existing skills, legends, base attacks and attribute-growth checks passed after display-only assertions were updated for the new roster.

The cloud preview also started Embersong with Enter and completed first-spell training. That check confirmed the selected identity through the rendered start and spellbook flow.

## Final layout and input checks

The passing run includes long titles near 1000px width, short desktop layout, footer actions, skill captions and Enter behavior. Source-like condensed Barlow skill labels are retained; the description body uses Arial. The checks require skill buttons and key labels to remain clear of the description panel. Enter starts from the roster or background, while other focused controls keep their native actions.

## Completed capture review

The final compact layout uses 9px Barlow hero captions and 8px role labels. Its decorative arcade motto and memory phrase are hidden. Per-card text-overflow checks passed in run 60. All six captures were inspected. The desktop was compared directly with the supplied reference, and responsive captions and essential controls fit. Small-phone and landscape rosters scroll to reach all sixteen heroes.

## Limits

The cinematic scene and stage sprites reconstruct the reference artwork. The native screen matches its composition and uses the supplied portrait atlas; a pixel-identical reproduction is not claimed. Sixteen visual identities share twelve tested combat archetypes. This change preserves the existing combat behavior.

Browser evidence comes from Chromium in CI, including emulated touch and native touch swipes. A physical Android device and other browser engines were not checked. Audio controls were exercised; sound output was not judged by listening. Frame-rate measurements were not collected.

The OpenSpec CLI is unavailable in this workspace. Delta targets, scenarios and canonical requirements were checked manually. CLI validation and CLI-driven archival could not run. The change was archived manually at `openspec/changes/archive/2026-10-03-shore-reference-selection/`; unrelated changes were retained. Canonical moba-ui and moba-roster specs were reviewed, with independent movement touches and attribute growth preserved.
