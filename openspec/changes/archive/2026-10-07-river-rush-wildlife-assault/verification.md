# Verification

## Gameplay and controls

The combined automated engine, generation, action-route, contact, movement,
audio, world-section, wildlife-visual, fallback and shoreline/model suite passes
109 checks. Final branch fitting changes receive a separate focused geometry
and shoreline rerun. Raw logs are in `/tmp/river-wildlife-final/`.

Across 300 seeded maps, every map contains all three species and relics:
1,896 enemies and 791 relics total. Crocodiles cross the full lane width and
reverse repeatedly through contact; the three map periods are 1.15, 1.0 and
.85 seconds at maximum Rush speed. Birds enter from either bank and descend
2.7 units to the duck envelope. Fish leap .72 units above their low body
baseline, with launch/landing splash progress separate from their lateral glide.
Engine and both renderers sample the same contact lane and pose.

180 unshielded relic-chasing stages at 30/60/120 Hz and .22/.42-second action
leads finish with all 522 touched relics and 20,310 raised coins collected,
1,098 enemies cleared or dodged and 648 naturally earned Rush activations.
240 delayed-input campaigns finish 720 stages with 180–288 ms input delays,
with and without Rush. Both campaigns peak at 50 active entities. Physical
coin contact radius, action durations, promised three-jump chains, exact Rush
expiry and finite finishes remain covered by the existing checks.

## Mobile guidance

The compact opening guide occupies the left HUD edge at x15/y78 on both
390x844 and 360x640 layouts; it is 46 pixels tall. Browser checks show no
overlap with score, distance, powers, capture, Rush, controls or the central
river corridor. Short landscape also passes. A drag beginning on the hint
changes lanes through the actual App handler. The redundant central opening
notice is suppressed; dynamic reward, collision and Rush notices remain.
See the final compact browser receipt for the retained checks.

## Meshy branches and presentation

The branch is a completed Meshy 7.1 generation via fal.ai, request
`01a11966-1f38-7fd2-8aee-aa623eee0424`. Its provenance and reproducible packaging
are in `games/river-rush/docs/meshy-bough-sources.json`. Local full/lite assets
embed PBR WebP maps and meshopt geometry: 4,907/1,458 triangles and
388,268/112,516 bytes. No generation URL is fetched during play. One prepared
instance batch holds at most 32 props and adds one tree draw call.

Root reviewed the final phone and desktop close-up pictures in both Lite and
full PBR paths. The generated dense core forms the actual low duck limb;
connected forks and natural taper replace the old cylinder dip. Actual packed
geometry checks cover 144 shoreline/profile/lane cases, including all three
maps: low wood stays within 1.65 world units of its lane and .7 of its contact
station, while duck clearance is at least 2.02 units. Measured robust contact
sections exceed .35 units of thickness. The final eight focused branch tests
pass. Current pack scripts reproduce both recorded GLB byte hashes exactly.

Final near-view browser checks select the actual Meshy models, show identical
stopped pixels and retain fixed prepared resources with no GPU errors. Full
material fixtures use actual MeshStandardMaterial, embedded normal/albedo maps
and the custom fitted shader, on explicitly recorded SwiftShader. Source
wildlife fixtures verify shared body/contact
registration, exact stopped pixels, reduced-motion determinism and unchanged
prepared texture/shader counters on phone, desktop and landscape. Detailed
material fixtures explicitly run the full asset/PBR path on SwiftShader;
natural App probes use the normal renderer selection.

The final build is `index-CoJTEH3z.js`, 1,097,863 bytes, SHA-256
`40e5918af294e209737a529bb8c76ad48855a29b17557028290c241190b5edd6`.
CSS is `index-CBusqfet.css`, 35,573 bytes. See [build assets](build-assets.json)
and [browser receipt](browser-receipt.json). The final natural phone App run passes without state, clock or seed overrides.
Real controls clear a weaving crocodile, bank-diving bird and leaping fish and
collect a physical relic for exactly +200. Crocodile samples span .001–1.999
lanes with reversals; bird lift descends from 2.7 and fish reaches .72. Shared
pose errors are zero, all six encounter screenshots remain identical while
paused, and texture uploads/shader counters remain 49/76 through active play.
The shield is retained with no hits. Meshy bough readiness and the final compact
phone receipt are recorded in the browser receipt. Source commit `e17a94b66ce3093d88f64d6c929e2232bd79b87c` is published to
`vdimarco/rouge-warden` main without force. Production deployment
`dpl_BsiCBVi2y9G4JEaD1b5JnrocnXRY` is READY and owns the arcade domain.
Fetched HTML, JavaScript, CSS, both Meshy models and music exactly match local
bytes; all six return HTTP 200 and the music range request returns HTTP 206.
See [live assets](live-assets.json) and [deployment receipt](deployment-receipt.json).
The natural production desktop run also passes on that exact bundle through
the actual App controls: crocodile jump, right-bank bird duck and fish jump,
plus a physical relic with exactly +200 bonus. Recorded poses match the shared
engine helper with zero errors; all six encounter screenshots retain identical
paused pixels and status. Upload/shader counters remain 49/76, the shield stays
intact with no hits, and the Meshy bough is ready with no GPU errors. See
[live browser receipt](live-browser-receipt.json). Both natural runs retain the
App seed, state and clock.

## Limits

The OpenSpec CLI is unavailable; requirement/scenario structure and archive
merging are checked directly. Three uniquely matching modified requirements
with 11 observable scenarios merge into 53 canonical requirements and 117
WHEN/THEN scenarios, independently reviewed before archiving. See
[spec validation](spec-validation.json). Browser checks use Chromium/SwiftShader and
synthetic pointer/keyboard input. Isolated rendering fixtures set their own
states and clocks; natural App probes retain the App's seed, clock and state
and use the real controls. These checks do not measure physical-phone frame
rate or human play feel.
