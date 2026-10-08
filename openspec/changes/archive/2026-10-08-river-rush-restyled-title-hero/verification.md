# Verification

The generated hero and its three responsive crops passed root, UI and independent art review. The original photo edit was rejected by the image service; the delivered asset is an independent illustration with described long-haired character appearance, not an exact photo transformation. Local WebP is 1672×941 and 483,096 bytes.

The arcade build passed. Focused Chromium checks verified desktop 1365×900, phone 390×844 and landscape 844×390, with no horizontal overflow or hit-area overlap. Actual Start, Help/back and read-only Leaderboard/back worked across layouts, and returning restored the hero. The final landscape-only compact spacing was checked separately: full Start ends at y370.8 within 390 px. Normal-motion image failure on the final bundle hides the broken placeholder while keeping all actions usable; reduced-motion art pixels remain static. Initial proofs are retained alongside final refinements in qa/verification.json.

Gameplay source and controls are unchanged. Chromium uses SwiftShader; physical phone performance was not measured, and campaign checks were not repeated for this title-only change. No game state/clock mutations or public score writes were used.

OpenSpec CLI is unavailable. Manual validation accepts one renamed/modified requirement and three observable WHEN/THEN scenarios. Canonical merge/archive passed after live verification.

Source commit 9bb7e46c5e03c17b4b8e0aa637a915d77072de2d is published to GitHub main without force. Vercel dpl_9LNJmBqwPEMSGfzNdJ9pYfMNVKy5 is READY on arcade.uptick.systems for the exact source. Production HTML, JavaScript, CSS and new hero return HTTP 200 and match local bytes exactly; receipts are retained here. The live phone-title smoke passed exact bundle/art loading, visible face and full Start, real Help/back, Leaderboard/back and Start/pause/home, with no errors or public score writes. Root accepted the production screenshot. A perceived image-tool presentation issue was checked: local/live JPEGs are byte-identical and the real Start pixels are painted gold; no runtime issue was found.

Independent canonical preview review passed: 53 unique requirements and 117 unique scenarios, with SHALL/WHEN/THEN retained. The new title requirement matches the delta exactly; all 52 other requirements remain unchanged.

The completed change is archived on 2026-10-08. Canonical River Rush contains 53 unique requirements and 117 scenarios. The archive commit changes only specification/evidence files; gameplay, build and QA runner remain byte-identical to the tested source.
