// The arena layout as fractions of SIZE. Only team 0's southern half is written here;
// world.js mirrors it across the river (y' = 1 - y) so both teams get the same map.
// Footprints (w, h, radius) are in the 4800 authoring grid and use FEATURE_SCALE, so
// they keep their size when SIZE changes.
export const BASE = [.5, .895];
// Lane knots from team 0's base toward the river. The last knot lies on the axis (y = .5).
// The middle lane swings west, back through the centre line and east of the Wild Hunt pit,
// so it is not much shorter than the side lanes.
export const LANE_KNOTS = [
  [[.356, .857], [.232, .775], [.156, .658], [.132, .5]],
  [[.5, .805], [.425, .7], [.53, .597], [.6, .5]],
  [[.646, .852], [.769, .767], [.846, .65], [.87, .5]],
];
// Tower stations by path distance from the team's own base, in world units [outer, middle, inner].
// Distances are fixed (not fractions) so tower spacing stays a fixed number of tower ranges.
export const TOWER_ARC = [[3700, 2450, 1250], [3250, 2180, 1100], [3700, 2450, 1250]];
// Base guardians flank the court where the three lanes meet it.
export const GUARDIANS = [[.462, .862], [.538, .862]];
// Rift gates. Each river gate pairs with the gate across the river on the other side
// of the map. A base gate sends a hero to the team's own river gate on the side the hero faces.
export const RIVER_GATES = [[.215, .585], [.745, .58]];
export const BASE_GATE = [.536, .826];
// Spirit camps: two in the wide west jungle near the river, two in the wide east jungle near the base.
export const CAMP_SPOTS = [[.33, .62], [.29, .735], [.655, .75], [.695, .64]];
// Brush patches (centre only; radius is fixed).
export const BRUSH_SPOTS = [
  [.19, .555], [.07, .62], [.235, .735], [.43, .83], [.395, .64], [.53, .705],
  [.565, .655], [.64, .56], [.795, .6], [.905, .64], [.745, .745], [.68, .8],
];
// Cover blocks: unequal islands of ruins, groves, hamlets and rock. town/woods name the art
// for each realm; w and h are in the 4800 grid; height is art height in world units.
export const COVER_SPOTS = [
  { x: .25, y: .65, w: 470, h: 330, town: 'ruin-yard', woods: 'ruin-yard', height: 620, biome: 'ruins' },
  { x: .45, y: .58, w: 390, h: 270, town: 'root-arch', woods: 'root-arch', height: 640, biome: 'grove' },
  { x: .165, y: .85, w: 560, h: 260, town: 'cliff-ridge', woods: 'cliff-ridge', height: 520, biome: 'ruins' },
  { x: .79, y: .845, w: 540, h: 240, town: 'rock-shelf', woods: 'rock-shelf', height: 510, biome: 'heath' },
  { x: .35, y: .775, w: 390, h: 240, town: 'mill-yard', woods: 'mill-yard', height: 550, biome: 'village' },
  { x: .75, y: .685, w: 340, h: 260, town: 'forest-island', woods: 'forest-island', height: 650, biome: 'grove' },
  { x: .37, y: .69, w: 250, h: 190, town: 'house-a', woods: 'willow', height: 410, biome: 'village' },
  { x: .63, y: .66, w: 270, h: 200, town: 'observatory', woods: 'oak', height: 430, biome: 'ruins' },
  { x: .59, y: .77, w: 260, h: 250, town: 'greenhouse', woods: 'forest-island', height: 480, biome: 'grove' },
  { x: .30, y: .58, w: 290, h: 200, town: 'market', woods: 'hollow-log', height: 280, biome: 'village' },
  { x: .955, y: .6, w: 260, h: 350, town: 'forest-island', woods: 'forest-island', height: 590, biome: 'grove' },
  { x: .055, y: .72, w: 220, h: 310, town: 'cliff-ridge', woods: 'cliff-ridge', height: 450, biome: 'heath' },
  { x: .665, y: .925, w: 260, h: 190, town: 'house-b', woods: 'juniper', height: 390, biome: 'village' },
];
// The river crosses the axis at every lane. Knots are [x, y]; y stays near .5 at the three crossings
// (where each lane meets the axis) and meanders between them. The Wild Hunt pit (the centre) is a shallow ford.
export const RIVER_KNOTS = [[0, .514], [.06, .52], [.132, .5], [.21, .474], [.305, .466], [.405, .488], [.5, .5], [.599, .5], [.675, .528], [.77, .524], [.87, .5], [.94, .472], [1, .478]];
export const RIVER_POOLS = [[.27, .07], [.735, .08]]; // [x, random x spread]
// Ground districts (southern half; the north half mirrors the shapes with its own materials).
export const DISTRICT_SPOTS = [
  { name: 'Millwater', x: .27, y: .64, rx: .14, ry: .1, angle: .35, material: 1, color: '#af9873', plants: ['birches', 'ferns', 'reeds', 'hollow-log', 'willow'] },
  { name: 'Briarwood', x: .7, y: .74, rx: .15, ry: .13, angle: -.4, material: 0, color: '#385958', plants: ['forest-island', 'pines', 'juniper', 'ferns', 'mushrooms', 'hollow-log'] },
  { name: 'Hearth Meadow', x: .48, y: .66, rx: .1, ry: .09, angle: .2, material: 2, color: '#8c9a62', plants: ['oak', 'birches', 'ferns', 'boulders'] },
  { name: 'Low Fells', x: .14, y: .86, rx: .13, ry: .1, angle: -.25, material: 3, color: '#979976', plants: ['boulders', 'juniper', 'birches', 'branch'] },
];
export const NORTH_DISTRICTS = [
  { name: 'Sunken Abbey', material: 3, color: '#a29c75', plants: ['birches', 'boulders', 'oak', 'branch'] },
  { name: 'Splitstone Rise', material: 0, color: '#979976', plants: ['boulders', 'birches', 'juniper', 'branch'] },
  { name: 'Ashen Glade', material: 2, color: '#7d8a5c', plants: ['oak', 'pines', 'ferns', 'mushrooms'] },
  { name: 'Thorn Fells', material: 1, color: '#9a8a6a', plants: ['juniper', 'boulders', 'branch', 'birches'] },
];
// Landmarks [name, x, y, height] and grove clusters [x, y, radius] for the southern half.
export const LANDMARK_SPOTS = [['shrine', .385, .905, 310], ['ivy-wall', .19, .76, 270], ['abbey', .34, .63, 330], ['house-b', .37, .74, 355], ['pier', .27, .515, 210]];
export const GROVE_SPOTS = [
  [.05, .56, .04], [.06, .79, .05], [.14, .95, .05], [.3, .97, .04], [.27, .87, .035], [.45, .72, .03],
  [.55, .9, .035], [.72, .95, .045], [.95, .78, .05], [.94, .93, .04], [.62, .7, .03], [.4, .6, .025],
];
