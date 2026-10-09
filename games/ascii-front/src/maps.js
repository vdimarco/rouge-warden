const COLS = 30, ROWS = 21;
const TILES = new Set(['.', '#', 'S', '~', '%', 'I']);
const NAMES = [
  'THE OUTSKIRTS', 'CANAL DISTRICT', 'FROZEN CROSSING', 'RING ROAD', 'GREEN AMBUSH', 'STEEL WORKS', 'BREACH POINT',
  'BRICK BOULEVARD', 'FLOOD GATES', 'BLACK ICE', 'INNER CITY', 'HIDDEN SIGNAL', 'IRON GARDEN', 'CROSSFIRE',
  'SPLIT AVENUE', 'RIVER ISLANDS', 'WINTER LINE', 'FORTRESS BELT', 'FOREST OF ECHOES', 'THE FOUNDRY', 'NO MANS LAND',
  'BROKEN BLOCKS', 'DELTA NETWORK', 'GLACIER RUN', 'LAST PERIMETER', 'OVERGROWN', 'STEEL LABYRINTH', 'SIEGE LANES',
  'RED BRICK DAWN', 'DEEP WATER', 'FROSTBITE', 'DEAD FREQUENCY', 'THE DARK WOODS', 'IRON CURTAIN', 'THE LAST SIGNAL',
];

function reserved(col, row) {
  return col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1
    || row === 2 || row === 17 || col === 3 || col === 26 || (col === 15 && row < 18)
    || (row >= 18 && (col >= 2 && col <= 4 || col >= 25 && col <= 27 || col >= 13 && col <= 16));
}

function reserve(terrain) {
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (!reserved(col, row)) continue;
    terrain[row][col] = col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1 ? 'S' : '.';
  }
  for (const col of [3, 15, 26]) terrain[0][col] = '.';
  for (let col = 13; col <= 16; col++) terrain[18][col] = '#';
  terrain[19][13] = terrain[19][16] = '#';
  return terrain;
}

function layout(index) {
  const terrain = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  const theme = index % 7, variant = Math.floor(index / 7);
  const block = (x, y, w, h, type) => {
    for (let row = y; row < Math.min(ROWS - 1, y + h); row++) {
      for (let col = x; col < Math.min(COLS - 1, x + w); col++) terrain[row][col] = type;
    }
  };
  if (theme === 0) {
    for (const x of [5, 11, 18, 24]) for (const y of [4, 10, 14]) block(x, y, 2 + variant % 2, 2, '#');
    block(7, 7 + variant, 3, 2, '~'); block(20, 11 - variant, 3, 2, '%');
    block(12, 7, 2, 1 + variant, 'S'); block(17, 12, 2, 1, 'S');
  } else if (theme === 1) {
    for (const y of [5, 10, 14]) block(5 + variant % 2, y, 20, 1, '~');
    for (const x of [8 + variant, 20 - variant]) for (const y of [5, 10, 14]) block(x, y, 2, 1, '.');
    for (const x of [6, 12, 18, 23]) { block(x, 7, 2, 2, '#'); block(x, 12, 2, 1, '%'); }
    block(10, 15, 3 + variant, 1, 'S');
  } else if (theme === 2) {
    block(5, 4, 20, 12, 'I');
    for (const x of [7, 12, 18, 22]) block(x, 6 + (variant + x) % 3, 2, 4, x % 2 ? '#' : 'S');
    block(9 + variant, 13, 3, 2, '~'); block(18 - variant, 4, 3, 1, '%');
  } else if (theme === 3) {
    for (let ring = 0; ring < 2; ring++) {
      const x = 5 + ring * 4, y = 4 + ring * 3, w = 20 - ring * 8, h = 12 - ring * 6;
      block(x, y, w, 1, '#'); block(x, y + h, w, 1, '#');
      block(x, y, 1, h, ring ? 'S' : '#'); block(x + w - 1, y, 1, h, '#');
      block(x + 2 + variant, y, 2, 1, '.'); block(x + w - 4 - variant, y + h, 2, 1, '.');
    }
    block(12, 10, 2 + variant, 2, '%');
  } else if (theme === 4) {
    for (const x of [5, 10, 17, 23]) {
      block(x, 3 + variant % 2, 2, 13, '%');
      block(x, 6 + (x + variant) % 5, 2, 2, '#');
    }
    block(7, 11 - variant, 2, 3, '~'); block(20, 5 + variant, 2, 3, 'I');
    block(12, 14, 2, 1, 'S');
  } else if (theme === 5) {
    for (const x of [5, 10, 18, 23]) {
      block(x, 4, 1, 11, 'S');
      block(x, 6 + (x + variant) % 6, 1, 3, '.');
      block(x + 1, 4 + variant % 3, 2, 2, '#');
    }
    block(6 + variant, 15, 5, 1, 'I'); block(19 - variant, 11, 3, 2, '%');
  } else {
    for (let lane = 0; lane < 4; lane++) {
      const x = 5 + lane * 6, y = 4 + (lane + variant) % 3;
      block(x, y, 3, 3, lane % 2 ? 'S' : '#');
      block(x, y + 6, 3, 2, '#'); block(x, 14, 3, 2, variant % 2 ? 'I' : '%');
    }
    block(12 - variant, 9, 2, 2, '~');
  }
  // Each later tour changes cross-lane cover as well as its biome's structure.
  for (let i = 0; i <= variant; i++) block(6 + i * 4, 3 + (i * 3 + index) % 12, 2, 1, '#');
  return reserve(terrain);
}

export const MAPS = NAMES.map((name, index) => ({ id: index + 1, name, terrain: layout(index) }));

export function validateMap(terrain) {
  return Array.isArray(terrain) && terrain.length === ROWS && terrain.every(row =>
    (Array.isArray(row) || typeof row === 'string') && row.length === COLS && Array.from(row).every(tile => TILES.has(tile)));
}

export function makeTerrain(stage = 1, customMap = null) {
  const index = Number.isFinite(stage) ? ((Math.trunc(stage) - 1) % MAPS.length + MAPS.length) % MAPS.length : 0;
  const source = validateMap(customMap) ? customMap : MAPS[index].terrain;
  return reserve(source.map(row => Array.from(row)));
}

export function paintTile(game, col, row) {
  if (game.status !== 'editor' || !Number.isInteger(col) || !Number.isInteger(row)
    || col < 0 || col >= COLS || row < 0 || row >= ROWS || reserved(col, row)
    || !TILES.has(game.editorBrush) || game.terrain[row][col] === game.editorBrush) return false;
  game.terrain[row][col] = game.editorBrush;
  return true;
}
