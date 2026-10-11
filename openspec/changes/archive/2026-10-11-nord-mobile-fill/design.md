# Design

## Starting point

Baseline `3b7e43fd` includes the compact native HUD and accepted landscape fullscreen browser side rails. The previous phone-layout scenario requires fullscreen controls outside the contained video. The user's new preference replaces that placement contract with an edge-to-edge complete frame and touch controls that avoid native HUD regions.

## Browser layout

The mobile landscape fullscreen rules remove the reserved side rails so `#video` fills the frame, and set its decoded `<video>` element to `object-fit: fill`. The incoming video remains 1280×720. Stretch the complete frame to the viewport instead of cropping: the 800×360 shape widens the image by 25% relative to uniform 16:9 scaling; the 667×375 shape is almost 16:9. No native rendering or gameplay changes are needed.

Place the fullscreen utility row near the top middle, raise the movement/look pads above the lower native HUD, and place primary buttons near the bottom center above the contextual prompt and left of the objective. Use existing actions, release handling and touch ownership. Keep every target at least 44 px in each dimension, with no target-to-target or target-to-HUD collision. Preserve portrait, non-fullscreen and desktop rules.

The native HUD remains the existing game overlay, including private dialogue, save warnings, centered completion, bottom-left radar/credits, lower objective/prompt/speed and top-right identity. Touch controls may cover clear world imagery; they must avoid the reviewed HUD footprints.

## Verification

Update the existing mobile QA to assert fullscreen video bounds equal viewport bounds and computed `object-fit` is `fill`. Compare touch targets with native HUD exclusion boxes transformed from the 1280×720 stream using separate X/Y scales. Check target sizes, target intersections and HUD clearance at 800×360 and 667×375; retain portrait and non-fullscreen assertions.

Review actual decoded fullscreen screenshots for border removal, complete readable HUD and control placement. Run existing CPU browser/input checks and real-media desktop/mobile checks locally, on preview and on the final public player. Preserve the normal two-player host and production saves; this change requires no Unreal capture or GPU test job. Browser emulation, decoded packets and screenshots do not establish physical-phone, off-LAN, acoustic or complete manual story acceptance.

## Current evidence

Implementation and local verification pass. The configured browser build and all 12 unit tests pass. [Local desktop summary](../../../../games/nord-unreal/Browser/.qa/live-2026-10-11T14-26-04-345Z/summary.json) passes 7/7 and [local mobile summary](../../../../games/nord-unreal/Browser/.qa/mobile-2026-10-11T14-24-36-780Z/summary.json) passes 6/6. Both fullscreen geometry reports record viewport-sized video/image bounds, `objectFit: fill`, ten targets with minimum dimension 44 px, transformed native HUD exclusions and no intersections. Root decoded-frame review accepts both 800×360 and 667×375. Portrait, non-fullscreen and existing input coverage remain in the mobile suite.

Preview deployment `dpl_DXFTdRMwuyxDa26QDxzJWYeszNUw` is READY. [Preview desktop summary](../../../../games/nord-unreal/Browser/.qa/live-2026-10-11T14-31-03-114Z/summary.json) passes 7/7 and [preview mobile summary](../../../../games/nord-unreal/Browser/.qa/mobile-2026-10-11T14-31-30-130Z/summary.json) passes 6/6. Production deployment `dpl_55cYWdcQFtXjSYahvpgnZ1NJnM9e` is READY at https://nord-montreal.vercel.app/. [Production desktop summary](../../../../games/nord-unreal/Browser/.qa/live-2026-10-11T14-32-33-132Z/summary.json) passes 7/7 and [production mobile summary](../../../../games/nord-unreal/Browser/.qa/mobile-2026-10-11T14-33-06-974Z/summary.json) passes 6/6. The owner verifies exact parity for all four static file hashes and security/cache headers. Fresh preview/public decoded images are accepted at both fullscreen sizes.

The normal host PID 2416661 and invocation are unchanged: no restart, GPU job or native package change was required. All QA clients are closed. Owner final acceptance authorizes canonical merge and archival at `openspec/changes/archive/2026-10-11-nord-mobile-fill/`. Manual validation checks 17 unique canonical requirements, exactly one requirement replacement with seven delta scenarios, four archive files, six completed tasks and resolved relative evidence links. The OpenSpec CLI is unavailable; CLI validation was not run.

## Limits

The complete image is stretched to the screen shape, including approximately 25% horizontal stretch at 800×360. Geometry checks use exclusion boxes derived from the current native HUD; decoded startup images and those boxes do not establish every possible dynamic dialogue, mission, save-warning or completion combination. Physical-phone safe areas and handling, off-LAN media, audible sound and complete manual solo/co-op story acceptance remain unverified. The tested fullscreen sizes and browser emulation are recorded separately from those limits.
