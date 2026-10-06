# Tasks

- [x] Measure the messages against the lure on a 412x915 phone after a real motion cast.
- [x] Move the tall reel's prompt, banner and cast report; hold toasts while the report is up; push the prompt below a long toast.
- [x] Move the wide reel's and wide cast's report to the top right; tighten the prompt on a short wide screen.
- [x] Fade the gauge in with no rise.
- [x] Add `world.lureScreen()` and `qa/fish/messages.e2e.mjs`.
- [x] Run the fish browser checks: messages, menus, moments, screens, touch, mouse.
- [x] Render the store screenshots again.
- [x] Validate and archive the change.

## Checks

- `qa/fish/messages.e2e.mjs` passes: casts of 15, 35 and 55 m in motion play at 360x640, 390x844, 412x915 and 430x932 (and the reel on the left at 412x915), in touch play at 390x844, 844x390 and 640x360, and with Larger text at 360x640 and 844x390. No message is within 22 px of the lure, with the report up and after it. Before the change it failed in the wide layouts, and on a 412x915 phone the report ended 35 px above the lure.
- `menus.e2e.mjs`, `moments.e2e.mjs`, `screens.mjs`, `touch.e2e.mjs` and `mouse.e2e.mjs` pass. `npm run test:check`, `npm run test:native` and `npm run check:native` pass with version 1.0.1 (versionCode 2).
- Not checked: a real phone. The store videos still show the old message places.
