# Art provenance

Original ocean environment generated with the built-in Image Gen tool on 2026-10-24. Original source: `assets/ocean.png` in the retained standalone working source (1536×1024). Shipping asset: `public/silent-depth/assets/ocean.webp` (same size, quality 87, approximately 197 KiB). Format conversion only; scene colors are retained. The original PNG remains in the standalone working source; the deployable asset is in this repository. The runtime uses the WebP asset.

Ships are original projected geometry, with heading-dependent silhouettes, wake, mast, cargo/bridge details and sinking states. Instrument marks, chart symbols, sonar, smoke and impacts are native Canvas graphics. All UI labels and controls are HTML, and the logo/icons are original SVG. System fonts require no network requests. No Silent Hunter game assets or branding are used.

## Final environment prompt

> A peaceful empty ocean at dawn, wide panoramic 3:2 illustration for a nautical navigation game's background. Absolutely no boats, ships, people, weapons, combat, text, symbols, interface, or objects. Quiet dark blue-gray Pacific ocean fills lower 48 percent, hazy far horizon is a nearly straight line at exactly 52 percent from top, distant low cloud bank on horizon, soft pale gray-blue overcast sky with fine broad cloud texture. Muted desaturated mineral blue, steel gray, subtle pale warm light just over the horizon. Soft realistic painted matte landscape, subtle film grain, atmospheric and beautifully lit, calm small waves, no huge waves, no land. Horizon remains straight, extremely wide sense of open space, not dramatic fantasy. The image is a reusable environment plate, keep the sea unobstructed.

The full UI concept generation was rejected by output moderation. It was not retried. The separate environment plate above contains no ships or combat. See design.md for the written visual reference and the intentional code-rendered ship deviation. No CLI image fallback was used.


## Control room

The user's commander-hub request added an original generated control room, saved as `public/silent-depth/assets/control-room.webp` (1536×1024, quality 87). The built-in Image Gen tool generated the image; no CLI fallback was used. The image contains no baked interface: all station labels are real accessible buttons, and the ship simulation drives the instruments.

Prompt: A quiet empty 1940s research submarine control room, realistic painted cinematic environment, viewed at standing eye level from the aft doorway. Separate chart table at left with paper charts and red desk lamp, polished silver observation column in the middle, navy-green brass-rimmed instrument console and levers at right, near-right listening position with vintage headphones, round bulkhead doorway. Navy green steel, teak floor, brass/copper pipes, warm ivory lamps, muted green/amber palette. No people, conflict, weapons, explosions, flags, logos, text or UI; keep each station clearly visible.

Cabinet art is a crop of the actual periscope screenshot, encoded as a 480px WebP under 60KB at `public/arcade/key/silent-depth.webp`.

## Moving sea

The ocean is now a live GPU texture-displacement/reflection pass (`public/silent-depth/ocean.js`), informed by the sine-wave height/slope method in [NVIDIA GPU Gems ch. 1](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models). Independent swells and ripples advect the fine photograph detail below a stable horizon. The image's sky is unchanged. No added library or provider calls are needed at runtime. A static ocean remains available after graphics loss or when WebGL cannot initialize.
