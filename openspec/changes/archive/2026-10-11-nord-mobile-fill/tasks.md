# Tasks

## Implementation

- [x] Fill mobile landscape fullscreen with the complete video using zero inset and `object-fit: fill`, preserving portrait/non-fullscreen/desktop behavior.
- [x] Reposition existing fullscreen touch controls over clear world areas with minimum dimension 44 px and no target/HUD collision; preserve input and release behavior.
- [x] Update mobile QA for actual edge-to-edge video bounds, fill mode, transformed native HUD exclusion boxes and both landscape sizes.

## Verification and delivery

- [x] Run existing CPU/input and local real-media desktop/mobile checks; review decoded fullscreen frames at 800×360 and 667×375 and retain portrait/non-fullscreen coverage.
- [x] Verify preview and final public desktop/mobile behavior, deployment identity and file parity without replacing the native package or disturbing production saves.
- [x] Record results and browser-emulation limits, manually validate the OpenSpec delta with CLI validation unavailable, then merge and archive after owner acceptance.

Implementation, the configured build and 12/12 unit tests pass. Local desktop checks pass 7/7 in `Browser/.qa/live-2026-10-11T14-26-04-345Z/summary.json`; local mobile checks pass 6/6 in `Browser/.qa/mobile-2026-10-11T14-24-36-780Z/summary.json`. Preview desktop/mobile checks pass 7/7 and 6/6 in `live-2026-10-11T14-31-03-114Z` and `mobile-2026-10-11T14-31-30-130Z`; production checks pass 7/7 and 6/6 in `live-2026-10-11T14-32-33-132Z` and `mobile-2026-10-11T14-33-06-974Z`, under `Browser/.qa/`. Root fresh preview/public decoded-frame review accepts both fullscreen sizes. Preview `dpl_DXFTdRMwuyxDa26QDxzJWYeszNUw` and production `dpl_55cYWdcQFtXjSYahvpgnZ1NJnM9e` are READY with exact four-file hashes and security/cache header parity. The normal host invocation is unchanged and QA clients are closed. Owner final acceptance authorizes one canonical requirement replacement and the four-file archive. Manual validation covers 17 unique canonical requirements, seven delta scenarios, six completed tasks and evidence links. Stretch, physical-phone, off-LAN, audio, dynamic HUD and CLI-unavailable limits remain explicit in the design.
