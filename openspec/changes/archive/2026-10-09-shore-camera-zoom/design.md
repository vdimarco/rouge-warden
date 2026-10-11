# Design

Keep the bronze and gold HUD. Center Rift Jump beneath the score and objective clocks; move the portrait objective panel below it so both stay readable. Keep a 44px touch target and safe-area offsets. Keep the button visible away from gates with a disabled Find a gate hint; preserve cooldown and gate activation.

Zoom uses a distance multiplier from 1 to 2.4. Wheel down and fingers moving together reveal more terrain; wheel up and fingers spreading restore the closer view. Apply changes immediately and recalibrate the footprint, ground projection and pan scale without resizing WebGL buffers. Scale atmospheric fog near/far distances by zoom so distant terrain stays legible; preserve fog of war. Keep transient first-spell guidance and software-renderer notes clear of Rift Jump and the portrait objective panel. Resize, recenter and realm changes retain the zoom. Hero selection retains its own lens.

Only battlefield wheel events and two battlefield touch pointers control zoom. Starting a pinch cancels screen movement and orders. Suppress taps and movement from both fingers until both lift, including cancellation and capture loss. Joystick and skill touches do not enter the pinch. Menus, pause and defeated heroes disable these gestures.

Verification: pointer sequences and wheel normalization in Node; all Shore Node suites; real Chromium wheel and touch dispatch, picking and HUD rectangles in desktop, portrait and landscape layouts. Capture screenshots of the zoomed view. OpenSpec CLI is unavailable; validate document structure directly.
