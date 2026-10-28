# Design

Use the existing Canvas renderer: circular lens clip, dark rubber surround, concentric metal rim, etched angular reticle/bearing scale, subtle coating/reflection and edge vignette. Remove floating ship brackets; the contact panel identifies tracked ships. No new art assets or dependencies. Reuse sea/ship rendering and reduced-motion/pause clocks.

The [US Navy Submarine Periscope Manual, chapter 7](https://www.maritime.org/doc/fleetsub/pscope/chap7a.php) supplies 1.5×/6× power and 32°/8° true fields. Adapt those values for rendering, panning, labels and observation. [MDN Canvas clip](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip) supplies the save/clip/restore technique; radial gradients provide lens falloff. This is a visual/gameplay approximation, not a complete optical simulation.

Replace coarse SVG polygons with paths traced in the existing control-room image coordinates, including the headphones rather than the whole listening desk. Keep visual geometry independent of the minimum 44px invisible native-button target. Scope: engine FOV helper and observation, renderer/projection/hit test, main input/labels, room HTML/CSS, relevant engine/browser checks, capability spec. No persistence or API changes.

Flow under test: control room → equipment → raised periscope → pan/zoom/select → lower/raise → full touch patrol; inspect desktop and portrait lens and contour placement. Dedicated Browser plugin/skill unavailable; use the installed Playwright/Chromium.
