// One scale for every authored world anchor and the river.
export const SIZE = 6400;
export const MAP_SCALE = SIZE / 4800;
export const CENTER = { x: SIZE / 2, y: SIZE / 2 };
export const arenaPoint = (x, y) => ({ x: x * MAP_SCALE, y: y * MAP_SCALE });
