# Design

Use native buttons with aria-hidden SVG polygon highlights traced over the existing room art; accessible text becomes a small label only on hover or keyboard focus. Keep the SVG/button layer on the same centered width-fitted 3:2 image plane as the renderer. Show the whole room at its original ratio on phone widths so all equipment stays in reach; preserve wide desktop framing. Taller tablet panels letterbox the room rather than crop equipment. No new artwork, dependencies or simulation changes.

CSS container-relative lengths follow [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length). Scope: index.html, style.css, existing browser smoke checks, canonical requirement and this change. No game engine, arcade registration or data changes.
