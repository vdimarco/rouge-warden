# Render-scale cap

The view already draws in CSS pixels. `resize` sets the canvas bitmap from the scale, then `setTransform(scale, …)` maps drawing back into that CSS space. Pointer samples use `getBoundingClientRect`, which is also CSS pixels, and the sim hit tests use the aim fraction of that box. Lowering the scale shrinks the bitmap and leaves both mappings where they are.

The scale is `min(devicePixelRatio, 1920 / cssWidth)`, then `min` with the existing cap of 2 and the low-fps cap. At 2560 CSS pixels and a device pixel ratio of 1, the bitmap is 1920 wide. At 1280 and 390 with a device pixel ratio of 1, `1920 / cssWidth` is above 1, so the bitmap stays 1:1 with the layout.

No grass, water, outline, or painted-look technique applies. The cap follows the usual canvas backing-store pattern in [MDN, Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas): the bitmap size is the CSS size times a device-pixel scale, and CSS does not stretch a 1:1 bitmap on its own. The only change is stopping that scale once the bitmap would pass 1920 px wide.
