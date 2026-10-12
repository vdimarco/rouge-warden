# Verification

## Gameplay and regression
Full `npm test --prefix games/river-rush`: 253 passed, zero failed or skipped. The final graphics-only culling and fallback-water changes additionally passed 24 focused checks covering camera framing, exact fork geometry, branch margins, canyon banks, registered water art, conservative visible-row bounds and both renderers. See `proof/tests.log` and `proof/graphics-tests.log`.

Fork behavior checks include both streams across all maps and 30/60/120Hz with future Rush; complete richer-stream courses; normal finite-course regressions; strict physical coin/cache contact; stream-confined enemies; clean, incomplete and protected treasure payouts; and center-island impacts, Rush expiry, shield rebound, shallow spring reversals and equal-distance numeric contact ordering. A hit invalidates the +400 clean bonus even if three subsequent guards are cleared. Both streams grant +200 on physical cache contact; only qualified richer-route play earns +600. Island entry reserves 0.90 maximum-future-Rush seconds free of normal hazards, and reunion tokens remain beyond the actual land taper.

## Scenario coverage
| Changed requirement | Relevant behavioral and presentation evidence |
| --- | --- |
| Diverging river adventures | `river-forks`, `river-adventures`, `fork-graphics`, `fork-fallback`; real stream choices, island contacts and reunion |
| Purposeful treasure encounters | `river-adventures`, `adventure-cues`, `audio`; qualified/partial cache receipts and physical misses |
| Fair escalating obstacle course | `engine`, `playtest`, `course-escalation`; finite courses, both streams and future Rush |
| Varied five-lane coin routes | `five-lane-coins`, `action-routes`; meaningful sparse pockets, strict contact and untouched alternatives |
| Tactical coin decisions | `risk-reward`; safe/risk/abort campaigns, protected scoring and real input receipts |
| Varied required action beats | `action-routes`, `course-sections`; required actions, delayed input and preserved wave chains |
| Shoreline ducking branches | `branch-spans`, `fork-graphics`, `fork-fallback`; actual physical endpoint margins and native rooted stream trees |
| Drifting bonus relic targets | `moving-encounters`, `playtest`; compatible physical contact, stream confinement and attainable returns |

## Build and source freeze
`npm run build:arcade --prefix games/river-rush` passed: `index-CxptSh1V.js`, `index-Dr3fxOm_.css`. Existing approved title art, detailed character/tree assets, arcade analytics and switch scripts remain. `proof/build.log` records the normal static-script/large-bundle warnings. The frozen manifest covers 273 source/build files and is checked again before publication.

## Browser verification
All 90 source renderer frames passed across Canopy, Redstone and Moonlight at portrait 390×844, desktop 1365×900 and short-landscape 844×390 in WebGL and fallback, including normal/reduced geography, treasure, fatal/protected contact frames, exact stopped pixels and unchanged resources. Nine real engine island-contact cases passed at 30/60/120Hz without protection, with shield and with Rush. A 72-pose normal/reduced software budget sweep peaked at 112,261 triangles/45 calls, below the unchanged 125,000/65 limit. The rich water shader also compiled without GL errors. See `proof/source-browser.json`, `proof/source-browser-summary.json` and selected rendered frames.

Actual compiled-App play passed all three layouts using `index-CxptSh1V.js` with original seeds/clocks/state and real controls. Each collected safe 200 and clean-risk 600 treasure, missed the other stream's rewards, retained the shield, froze exactly when paused and kept resources at 53 uploads/80 programs. The 331 physical receipts had a maximum 0.125 m gap, inside the fixed 0.95 m contact radius; 37 opposite-stream rewards remained uncollected. Visible coins stayed at or below 16 with zero overflow and at most 35 entities. Portrait and landscape used native pointer drags through the visible route card onto the canvas; keyboard steering handled desktop. Landscape naturally reached Canopy's 4200 m finish and advanced through the actual Next river button into Redstone with the same campaign seed, then earned its clean cache. See `proof/natural-browser.json`, `proof/natural-browser-summary.json` and actual running choice/cache/receipt images.

The isolated full-path probe passed 76 poses: full meshes, far meshes, materials, shadows, rich water and original tessellation at scale 1. Maximum 284,287 triangles/47 calls respects the unchanged 300,000/65 limit; uploads/programs remained 91/94. This probe overrides only fixture renderer classification and truthfully records SwiftShader as the underlying driver. It does not measure hardware frame rate. See `proof/full-path-browser.json` and `proof/full-path-browser-summary.json`.

An initial natural checker had assumed every map supplies two forks; valid seeds can supply one and finish normally. The checker now retains passed scopes, namespaces observations across maps and uses the actual Next river button when needed. An initial helper-export issue affected only checker startup. Failed preliminary reports are excluded. Final source/build bytes remained unchanged throughout these corrections.

Source commit `b5d709c8fe140a2800c0017ed77f3d074d77801e` was published exactly to GitHub main by authenticated fast-forward Git push. Vercel deployment `dpl_82V9iczXZg6mgf5jFQE4VhdiHRAP` is READY on `arcade.uptick.systems` at that commit. Live HTML, fingerprinted JS/CSS and approved menu art returned HTTP 200 with correct MIME types and bytes identical to the verified build. See `proof/source-publication.json`, `proof/source-deployment.json` and `proof/live-bytes.json`.

Fresh actual production phone play passed at 3,388 m using the exact new bundle with original seed/clock/state. It earned safe 200 and clean-risk 600, touched 91 rewards within 0.000030 m, missed 11 opposite-stream rewards, retained the shield and produced no browser/GL errors or public score writes. The native drag reached the canvas through the route card, exact pause pixels matched, resources stayed 53/80, and the scene peaked at 114,045 triangles/44 calls. See `proof/live-browser.json`, `proof/live-browser-summary.json` and the six `proof/live-*.jpg` captures.

Canonical merge and archive validation: 57 unique requirements and 133 observable WHEN–THEN scenarios. All implementation, verification and publication tasks are complete. Source/build bytes and the QA harness are unchanged by the evidence/specification archive commit.

## Validation limits
OpenSpec CLI is unavailable; delta/canonical Markdown structure and observable scenario checks are validated directly. Chromium uses SwiftShader with emulated viewports; hardware-phone frame rate, human reaction difficulty and audible listening are not measured. Source fixtures explicitly own isolated state; natural App runs retain the game's original seed, clock and state and send actual input handlers. No public leaderboard scores are submitted.
