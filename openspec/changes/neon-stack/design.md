# Design

## Sprite stacking

Every object is a pile of horizontal quads. The camera orbits, so a turn redraws the stack. The slice bitmaps are never rotated. Each texel stores a palette index, a facing, and a height. The fragment shader shades from that facing and height, then keeps four light steps.

Source adapted: the horizontal sprite-stack method described on the Pico-8 BBS thread "3D sprite stacking" (https://www.lexaloffle.com/bbs/?tid=2119), in the form used by small WebGL toys: one instanced quad, nearest filtering, camera yaw instead of rotating the bitmap. The four hard light steps follow the idea in Lucas Pope's *Return of the Obra Dinn* of quantized light with no blur. They are not that game's 1-bit dither. No bloom write-up fit, because the spec forbids a blur; the glow is a 1 px checker ring in the composite pass.

## One draw for the slices

All slices, including the ones a cutaway keeps, go in one instanced buffer. A second pass of the same buffer writes unquantized point light. On a narrow backing buffer (under 800 px, the phone case) that pass is half resolution. The composite samples it with nearest filtering and only then quantizes to four steps, so the bands stay square. A directional light is the only hard shadow: each building has one dark quad on the ground, offset along the sun. Point lights do not use a shadow map.

Slices are opaque. Empty texels take one `discard`. The runner's hidden pixels are a second draw of the same slices with the depth test reversed, in flat paper, and they do not write depth.

## Camera and pixels

The art buffer is the largest whole scale that keeps the width in 256 to 320 px when the backing store allows it. 1280 CSS pixels at 1x is 320 art pixels scaled by 4. The backing ratio starts at `min(devicePixelRatio, 1.5)` and may step by 0.25 after a warmup, never above the device ratio. The blit is `floor(min(backW/artW, backH/artH))` with nearest filtering. CSS sets the canvas box in CSS pixels and does not stretch a tiny art canvas. Pointers go through that letterbox.

Near and far stay a small multiple of the camera distance so a 1-unit gap between slices does not fight at tilt 20 or 87. The camera's focus is snapped to the art-pixel grid once per frame.

## What is not here

No framework, no texture assets, no second animation loop. Rain, the eye's buzz, and the barrel's flicker are values on the one `requestAnimationFrame` callback. Delta is clamped to 0.1 s. Time wraps at 120 s before it is handed to the shader.
