// Map size and the scales derived from it. Positions are fractions of SIZE (layout.js),
// footprints keep a fixed size, and counts of scattered things follow the map.
export const SIZE = 9600;
export const CENTER = { x: SIZE / 2, y: SIZE / 2 };
// Cover, brush, river width and bridges keep the size tuned on the 6400 map.
export const FEATURE_SCALE = 4 / 3;
// Scenery counts were tuned on the 6400 map. Area counts and river-length counts follow SIZE.
export const AREA_SCALE = (SIZE / 6400) ** 2, LENGTH_SCALE = SIZE / 6400;
// Bot rotation and assist distances follow the map, not the screen.
export const ROTATION_SCALE = SIZE / 6400;
export const at = (fx, fy) => ({ x: fx * SIZE, y: fy * SIZE });
// Team 1 gets team 0's half mirrored across the river.
export const mirror = p => ({ ...p, y: SIZE - p.y });
// The old 4800 authoring grid. Only old tools still use it.
export const MAP_SCALE = SIZE / 4800;
export const arenaPoint = (x, y) => ({ x: x * MAP_SCALE, y: y * MAP_SCALE });
