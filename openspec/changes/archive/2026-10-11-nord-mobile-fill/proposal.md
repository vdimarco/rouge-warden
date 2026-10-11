# Fill the mobile fullscreen game view

The user accepts the current HUD and asks for the game view to fill fullscreen without black borders. The accepted side-rail layout reserves space beside the 1280×720 stream; replace that landscape fullscreen presentation with video covering the entire phone viewport while preserving the complete HUD.

## Scope

- Fill mobile landscape fullscreen edge to edge using the complete stream, allowing aspect-ratio stretching rather than cropping its HUD.
- Float the existing touch controls over clear world areas, keeping them clear of the native HUD and one another with minimum target dimension 44 px.
- Preserve existing input behavior, portrait, non-fullscreen and desktop presentation.
- Check actual video bounds, decoded frames, HUD clearance and touch input at 800×360 and 667×375 before delivery.

This is a browser layout and focused QA change. Native HUD, game content, gameplay, input bindings and stream resolution are unchanged.

## Acceptance

The fullscreen game image reaches all four viewport edges without reserved black rails or cropped HUD. The existing objective, dialogue/status, prompt, identity, radar attribution and speed remain clear of touch targets. The full-frame stretch is explicit: about 25% horizontal stretch at 800×360 compared with a 16:9 image, and almost none at 667×375. Physical-phone and off-LAN testing remain distinct from browser emulation.

## Progress

The browser layout and focused QA are complete. The configured build and 12 unit tests pass. Local, preview and final public desktop checks pass 7/7; phone-emulated checks pass 6/6 at each stage. Fresh decoded-frame review accepts both 800×360 and 667×375. Preview deployment `dpl_DXFTdRMwuyxDa26QDxzJWYeszNUw` and production deployment `dpl_55cYWdcQFtXjSYahvpgnZ1NJnM9e` are READY; all four static file hashes and security/cache headers match the accepted local build. Production is https://nord-montreal.vercel.app/. The normal host invocation remains unchanged and QA clients are closed. Owner final acceptance authorizes the single canonical requirement replacement and four-file archive on 2026-10-11. Manual OpenSpec validation passes; the CLI is unavailable. Physical-phone, off-LAN, audio and every dynamic HUD/story combination remain outside the verified scope.
