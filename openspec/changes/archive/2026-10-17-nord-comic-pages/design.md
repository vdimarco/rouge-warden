# Design
Use the approved generated badge as the main illustration, with cream editorial panels, cyan halftone ground, black borders, magenta hard shadows and yellow actions. Existing HTML controls remain real, accessible controls. Reuse icon-512.png in the player and the same export on the arcade page; no new runtime dependency. Scope player styling to home-screen elements so playing and touch controls retain their behavior. Preserve existing title video playback and full-screen trailer handling.

Tokens: ink #0b0a16, paper #fffaf0, cyan #14d8f8, magenta #ed2865, yellow #ffe33f. Condensed heavy headings, Arial body copy, square panels, 4px borders, 8px hard shadows. Desktop badge left, text/actions right, status below; portrait stacks and scrolls within the existing overlay. Arcade includes trailer and controls below.

Source: user-approved comic badge and generated two-screen design reference. Existing CSS radial-gradient halftone pattern reused; no new rendering technique.

Verification: existing unit/browser tests, inspect desktop and 390/320px pages, check horizontal overflow, Start/story, Menu, trailer open/close, real arcade play/install links. Live game and physical phone installation remain outside this presentation check.

## Verification result
60 unit tests and the full Chromium browser suite pass. In-app browser inspected both entry pages at desktop and 390/320px, verified no horizontal overflow, 44px installation link and 58px play link, and Start -> story at 320px. Console warning/error lists were empty. Final screenshots were compared using view_image with the generated reference: layout, badge, heading hierarchy, cream/cyan palette, black borders and hard shadows match the intended direction. Intentional differences: exact user-approved badge instead of the concept's invented badge, real existing trailer and full host/install copy instead of invented download claims, quiet halftone background instead of additional generated city art. No invented actions were shipped.

OpenSpec CLI unavailable; Markdown requirements/scenarios reviewed manually. Physical phones and live streaming not tested. Reference: /home/von/.codex/generated_images/01a14c0a-1899-7c32-ad92-854760d55f16/exec-fee939fe-f8be-4e8a-af32-e59b9343675a.png.
