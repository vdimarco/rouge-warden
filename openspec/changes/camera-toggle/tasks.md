# Tasks
- [x] Fix context-switch and repeated-key toggle behavior.
- [x] Verify actual keyboard opening, holding, shutter and closing.
- [ ] Validate/archive with OpenSpec CLI when available.

Desktop Playwright check passed at 1280×720: held V including a repeated keydown keeps the visible viewfinder open, Space adds a photo, a separate V press closes it. No browser errors. Screenshot `/tmp/crimson-camera-fixed.png`. Physical gamepad/mobile not tested. Browser plugin not available; used existing Playwright harness. OpenSpec CLI unavailable.
