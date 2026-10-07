# Verification

## Local implementation checks

- Final terrain suite: 63 tests passed, including deterministic sections, analytic river/water derivatives, seeded hazard routes, no-Rush/grace reward farming, natural jump-chain availability, precise pickup/hazard contact and delayed-input playtests. Across 240 full campaigns at 30/60/120 Hz, all 720 stages finish unshielded with 180–288 ms input delays, 16,527 successful tricks and 1,960 Rushes; active entities peak at 73.
- Independent natural generation review: 150 seed/maps contain 407 advertised wave encounters, all with at least four eligible jump rows. Twenty-eight truncated encounters omit the three-jump objective. The first review identified unreachable targets; the final sampler and row recovery rules resolve that issue.
- Audio factory/lifecycle suite: 13 tests passed. Cue routing/frozen-contact presentation tests: two passed. Impact/contact feedback tests: four passed, with an additional motion and physical-contact suite passing in the impact implementation check.
- Actual browser checks on the preceding runtime candidate pass on desktop, phone and short landscape: each touched coin schedules its cue, passing beside coins stays silent, protected hits keep steering available, fatal contact freezes physics while showing multiple wipeout frames, layered crash audio finishes, and results/retry work. Mute, reduced motion, exact paused pixels and hidden-impact pause also pass. The final exact `index-wW83rlHd.js`/`index-BttXBCLJ.css` bundle phone probe also passes exact paused status/pixels, six physical pickups and six cues, responsive protected steering, resume/home, and no post-preparation GPU work. Sixteen final HUD cases pass on phone, desktop, short landscape and portrait tablet after correcting notice/capture overlaps; objectives, notices and controls remain readable.
- Isolated final-source rendering checks pass for 20 terrain states across all maps, protected/fatal impacts across three layouts, and fallback contact. Reduced motion suppresses optional motion; splash/shield effects reuse the bounded particle pool. These fixture checks construct their own seeded states rather than mutating actual-App runs.
- Real Web Audio cue rendering: six cases pass, including a 30-coin burst followed by a fatal impact. The burst peaks at 0.402 without clipped samples and never exceeds 12 voices. Coin sound ends around 0.150 s and the fatal tail around 0.452 s, within the 0.60 s visual beat.
- The final arcade build passes. JavaScript `index-wW83rlHd.js` is 1,064,942 bytes, SHA-256 `2f8d38d248dbac3806c57a94659b902b69d834c086973a8a18c685bbf8bf2a54`; CSS `index-BttXBCLJ.css` is 33,889 bytes, SHA-256 `6517ad030e1900dda887e6c15822a45cddd2b54f4d3d26b35d922f109d30ed95`. The local adventure music is unchanged.

The compact [browser receipt](browser-receipt.json) records the tested versions, measurements and fixture limits. The four `qa/river-rush/` contact, waveform, terrain-renderer and HUD scripts retain the checks for reproduction.

## Limits and publication

The OpenSpec CLI is unavailable in this workspace. Markdown structure/scenarios are validated manually. Browser checks use Chromium/SwiftShader and viewport layouts; physical phone/audio hardware and hardware frame rate are not measured. Production is verified below.

## Published arcade verification

The source/build release is `15ac31ed76d0e522dd2960348ecc2bee371d9728` on `vdimarco/rouge-warden` main. Vercel deployment `dpl_dAnhNHBAkRgdqQz6PT428M1gwZHw` is READY and serves `arcade.uptick.systems`. Production HTML, JavaScript, CSS and local music match the tested files byte-for-byte; the music range request returns HTTP 206 with the correct first 1,024 bytes. See [deployment receipt](deployment-receipt.json) and [asset receipt](live-assets.json).

The short live phone probe passes on the exact release bundle: six physical starter contacts produce six pickup cues, protected impact has measurable wood/splash audio, lane steering remains available, settled paused status/pixels stay identical, resume works, home is silent, and no shader/texture preparation or browser/GPU errors occur during play. No App state/clock or leaderboard writes are used. See [production browser receipt](production-receipt.json).

All tasks are complete and the canonical River Rush requirements have been reviewed. This archive follow-up changes only verification documents; it preserves the tested runtime assets.
