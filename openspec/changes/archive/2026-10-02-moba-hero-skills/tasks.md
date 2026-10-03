# Tasks
- [x] Implement four hero kits, rank requirements and bot training.
- [x] Implement thumb fan, training sheet, rank/lock/cooldown feedback and input.
- [x] Add thematic combat cues and verify hero combinations.
- [x] Run progression, existing combat, full-match and desktop browser checks; review responsive geometry and record mobile limits.
- [x] Update canonical specs and archive the implemented change. Publication is verified in the PR and deployment receipt.

Validation: seven deterministic suites pass, including all four signature combinations, rank gates 1/3/5/7 and 6/12/18, point accounting, death preservation, bot progression, deterministic replay and 12 full matches. Cloud Chrome at 1363x936 verified title/content, first-spell selection (one point to zero; rank zero to one), disabled future ranks, paused training, pointer-cast cooldown feedback, four distinct button bounds and the larger corner ultimate. No game errors or framework overlays were observed; console messages were from the browser extension and the Vercel login page. Responsive positions were reviewed for 390x844, 844x390 and 320x640; actual mobile browser screenshots and touch drags could not run. Local Chromium launch failed with socket() Operation not permitted, and the cloud browser does not allow local file pages. OpenSpec CLI and physical phone/audio playback checks remain unavailable.
