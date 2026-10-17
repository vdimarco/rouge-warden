# Design

The playable app is `games/nord-unreal/Browser`, deployed at `nord-montreal.vercel.app`. `public/gta` is a separate arcade landing page. The manifest belongs to the player origin; the landing page links there rather than creating a second installed identity.

Use a code-native SVG NORTH monogram in the existing yellow/cyan/magenta palette, with halftone detail. Export 32px favicon, 180px Apple icon, 192px/512px app icons and an opaque maskable icon with the mark safely inset. Both pages use the same favicon and Apple artwork.

Follow [MDN’s installability requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [Chrome’s updated criteria](https://developer.chrome.com/blog/update-install-criteria). A manifest defines a stable root identity, launch route, scope and standalone display. No service worker or asset cache is needed for this online streaming app; avoid stale player/signalling configuration. Installation does not change the host requirement.

The existing menu contains the install action. Defer a browser-provided prompt until a user click, consume each prompt once, handle rejection/dismissal and hide the action when installed or standalone. Other browsers receive manual home-screen instructions. Preserve keyboard focus when the action disappears. The browser build and local test server must serve every new asset with its proper MIME type.

Verify Node state/manifest tests and actual Chromium parsing/installability, desktop and phone-width menu interaction, target sizes, focus return, layout and console health. Keep emulated layouts separate from physical OS installation. This work requires no Unreal, GPU maintenance or streaming-slot reservation.

Local verification passes 51 Node tests and the complete existing mock-signalling browser suite. A disposable normal Chromium profile reports no manifest or installability errors; the original incognito failure is retained. The separate persistent profile is closed before existing browser scenarios run. Menu installation help fits 1280px desktop and 320px/390px touch layouts, with 44px targets and Escape/focus restoration. The arcade page also passes 320px/390px/1280px icon/link, target-size and overflow checks. Browser plugin unavailable; existing Playwright workflow used with GPU disabled and no live game subscription. Actual phone/OS installation remains unchecked.

A real-DOM synthetic accepted-prompt check reproduced disabled-button focus falling to the body. The module now captures focus ownership before disabling, restores Close on accepted installation and restores Install on dismissal/failure without stealing another control’s focus. The strict browser regression and the complete UI suite pass after the fix. This synthetic prompt does not install an OS app.

Both Vercel previews are READY for app commit `1bf146b592bcd82d2bbea0fedfa075e9440ce7ae`: player `dpl_Hb3wFkyYLDVRufX3wPcHB9BEKXqz` and arcade `dpl_AbH1wx53bkEdteHiuRPDhTpN3z94`. All eight player installation assets match source bytes. The protected arcade preview returns the exact matching SVG and HTTP 200 image/png for both PNG exports through authenticated preview access; no access settings were changed. GitHub’s Chromium job passes. Production asset checks follow the feature merge; physical OS installation remains unchecked.
