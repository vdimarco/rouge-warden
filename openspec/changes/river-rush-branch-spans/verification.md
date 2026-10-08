# Verification

## Shared span mechanics

81 engine/generation/contact/action-route tests pass. A 300-map comparison
with prechange commit a2111ab confirms all 108,959 coin lane/distance/height
and jump-offset tuples, final generator RNG and row counts remain identical.
150 seeded maps contain all three widths: 3,396 trees, including 1,744 coherent
single-tree full-width walls, all six width/bank combinations, and 3,344 intact
raised log-arc routes. Partial branch rows retain a clear lane. Centered old
parts expand toward the bank away from the safe route; conflicts with raised
log rewards retain the log and replace the old centered branch with a rock.

Standing physical crossings hit in every covered lane and between covered
lanes; a duck clears once. Shields/Rush protect once without trick farming;
coins retain .25-lane actual contact. Hints include exact lanes and span width.
240 unshielded delayed-input campaigns complete 720 stages at 30/60/120 Hz
with 180–288 ms input delays, with/without Rush, peaking at 48 active entities.
180 relic-chasing stages collect 510 targets and 20,430 raised coins, with
630 earned Rush activations. 410 advertised wave encounters still contain at
least three eligible jumps. Test controllers and formation assertions now use
actual coverage; required-action drought and repeated-formation bounds remain.
See [engine tests](engine-tests-receipt.json) and [baseline](engine-baseline.json).

## Shape, rendering and guidance

9 geometry/resource tests and 8 branch/wildlife fallback tests pass. Full and
Lite actual installed Meshy vertices are checked over 576 configurations,
including both banks and all three course profiles. Main reach sags gently;
root station depth is 1–1.8m. Widths 1/2/3 have 3/4/5 diagonal connected main
offshoots with secondary forks and smaller twigs. Low wood respects coverage
and duck clearance at every covered lane center. Geometry retains the recorded
locally packaged Meshy generation/PBR maps and unchanged full/Lite GLB hashes.
The fixed tree pool holds 32 trees with 48 parts per tree (at most 43 used).
One prepared marker batch holds 192 instances; all width labels prewarm before
play. See [geometry receipt](branch-geometry-receipt.json).

Root reviewed close phone/desktop pictures of all three widths, both-bank
examples and full PBR views. The broad supporting wood is shallow across the
river, with connected offshoots instead of the steep hanging single tip. One
coverage band/label represents each span and agrees with physical contact.
16 Lite near/mid fixture pictures and 7 detailed-material pictures pass exact
lane, marker and contact registration. Three short-landscape fallback cases
pass. Pause pixels and reduced status remain identical, uploads/shaders stay
fixed, and no GPU errors occur. Ordinary fixture sweeps peak at 24 draws/97,539
triangles (Lite) and 27 draws/239,624 triangles (full); artificial saturation
stays within 32 Meshy spans and 192 marker instances. See
[browser receipt](browser-receipt.json). Full material fixtures explicitly select
the detailed PBR path on recorded SwiftShader; natural App selection is normal.

## Build and remaining release checks

The arcade build succeeds: index-BpSfABkQ.js and unchanged index-CBusqfet.css.
See [build assets](build-assets.json) for exact byte counts and SHA-256 hashes.
The natural local phone App run passes on the exact built bundle: timely
ducks clear all three widths with the shield retained and no hits. Coverage
errors are zero; markers agree, stopped pixels/status remain identical, and
51 texture uploads/76 shader counters remain unchanged with no GPU errors.
The full-width hint is 174x46 at x15/y78, clear of the HUD/river/controls.
A short pointer sequence beginning inside the visible hint steers out/back
and ducks through the actual App handlers in .10 simulation seconds; the
covered branch is safely cleared. See [phone receipt](local-phone-receipt.json).
The first external automation sequence arrived after contact; its failed
receipt/images are retained in /tmp/river-branch-spans-local-phone-late-probe.
Only QA event timing changed, then the final natural run passed.
Production desktop, exact publication and canonical archive checks are pending.

## Limits

OpenSpec CLI is unavailable; Markdown requirement/scenario structure and merge
are validated directly. Browser tests use Chromium/SwiftShader and synthetic
keyboard/pointer input. Isolated fixtures set their own state/clock; natural
App runs use actual controls without changing App state, clock or seed. These
checks do not measure physical-device frame rate or human reaction feel.
