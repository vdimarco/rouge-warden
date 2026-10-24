# Design
Atlas rectangles change only on successful spawn/replacement and swap removal. Matrix and tint alpha remain dynamic. Keep pending atlas ranges until renderer consumption: animation-only updates must not clear a spawn upload queued before rendering. Inspect all FX callers and upload-reference fixture before code. Reuse existing dirty helper, no persistent result cache or new dependency.

Removal also refreshes the atlas live-prefix range so a pending spawn range cannot retain an obsolete larger count. Renderer consumption clears ranges; animation-only updates leave them untouched.
