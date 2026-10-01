# Design

Reduce the painted texture blend and its shallow opacity. Add slow, warped noise contours as a light pattern, faded by depth, sun visibility, viewing angle, and pixel footprint. Distort the paint with the existing wave gradient so lure ripples affect it. Retain the existing bed geometry, reflected shore, and deep-water opacity. No new assets or render passes.

The reference is a short top-down pond recording; this change adapts its visual properties rather than copying its code or claiming full scene refraction.

## Stronger visual revision

The initial effect was too subtle from the fishing camera. Reduce the asset blend to 12%, use a daylight jade-to-deep-teal depth gradient, and reflect the animated sky and shore in painted mode. Increase ripple texture displacement and use larger, brighter light contours with slower depth attenuation. Lower near-shore opacity to expose more bed. Keep sunlight gating and pixel-footprint fading. No extra texture samples, render passes, or geometry.
