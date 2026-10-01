// BREAKTHROUGH climate model. No DOM. Seeded, replay-stable.
// Warming is a stock with a one-pole lag. A longer step closes more of the gap.

export const YEARS = [2026, 2032, 2038, 2044, 2050, 2056, 2062, 2068, 2074, 2080, 2090, 2100];
export const TURN_COUNT = 12;
export const TAU = 46;

export const PARAMS = {
  eventChance: 0.7,
  income: { capital: 1.7, research: 1.15, industry: 0.75, political: 0.85 },
  politicalEnergyDrag: 0.03,
  politicalTrustDrag: 0.45,
  energySurchargeAt: 72,
  trustSurchargeAt: 42,
  policyTrustFull: 50,
  prosBase: 0.05,
  prosEnergy: 0.115,
  prosHeat: 0.55,
  prosHeatAt: 2.0,
  growthEmissions: 0.095,
  growthFloor: 44,
  richLeak: 0.12,
  richLeakAt: 72,
  industryLeak: 0.18,
  industryLeakAt: 7,
  decPerCard: 0.1,
  decCap: 0.7,
  ecoDrift: 0.58,
  ecoHeat: 1.05,
  ecoHeatAt: 1.75,
  trustHeat: 0.45,
  trustHeatAt: 2.05,
  trustPoor: 0.3,
  trustPoorAt: 40,
  trustHeal: 0.12,
  eqBase: 0.66,
  eqPerEmission: 0.026,
  eqPerEcology: 0.009,
};

export const IDEA_CLAMP = {
  emissions: [-8, 3],
  energy: [-6, 6],
  prosperity: [-4, 4],
  ecology: [-4, 6],
  trust: [-1, 1],
  capital: [-3, 3],
  research: [-2, 2],
  political: [-2, 2],
  industry: [-2, 2],
  warming: [0, 0],
};

const BOUNDS = {
  emissions: [0, 125],
  energy: [0, 100],
  prosperity: [0, 100],
  ecology: [0, 100],
  trust: [0, 100],
  capital: [0, 80],
  research: [0, 80],
  political: [0, 80],
  industry: [0, 40],
  warming: [0, 6],
};

export const METER_KEYS = ["emissions", "energy", "prosperity", "ecology", "trust"];
export const RESOURCE_KEYS = ["capital", "research", "political", "industry"];

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function spanYears(turnIndex) {
  if (turnIndex >= 0 && turnIndex < YEARS.length - 1) return YEARS[turnIndex + 1] - YEARS[turnIndex];
  return 6;
}

export function lagAlpha(years) {
  return 1 - Math.exp(-years / TAU);
}

export function stepWarming(warming, eq, years) {
  if (years <= 0) return warming;
  return warming + (eq - warming) * lagAlpha(years);
}

export function equilibrium(emissions, ecology) {
  const raw = PARAMS.eqBase + emissions * PARAMS.eqPerEmission;
  const sink = (ecology - 50) * PARAMS.eqPerEcology;
  return clamp(round2(raw - sink), 0.4, 5);
}

export function projectWarming(warming, emissions, ecology, year) {
  const eq = equilibrium(emissions, ecology);
  const left = Math.max(0, 2100 - year);
  return round2(stepWarming(warming, eq, left));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampEffect(effect) {
  const out = {};
  for (const [key, value] of Object.entries(effect || {})) {
    const range = IDEA_CLAMP[key];
    if (!range || typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = clamp(value, range[0], range[1]);
  }
  return out;
}

export function policyScale(trust) {
  if (trust >= PARAMS.policyTrustFull) return 1;
  const t = clamp(trust, 0, PARAMS.policyTrustFull) / PARAMS.policyTrustFull;
  return round2(0.52 + 0.48 * t);
}

function tagCount(owned, cardsById, tag) {
  let n = 0;
  for (const id of owned) {
    const card = cardsById.get(id);
    if (card && card.tags.includes(tag)) n += 1;
  }
  return n;
}

export const CARDS = [
  { id: "geothermal", name: "Deep Geothermal", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, research: 1 }, effect: { emissions: -5, energy: -5, ecology: 1 },
    text: "Hot rock, steady watts, a small scar on the land." },
  { id: "solar", name: "Perovskite Roofs", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -5, energy: -6 },
    text: "Film on the roofs. Noon power gets cheap." },
  { id: "storage", name: "Iron-Air Banks", lane: "Energy", tags: ["clean"],
    cost: { capital: 2, research: 1 }, effect: { emissions: -2, energy: -5 },
    text: "Store the wind in iron and air. Heavy, local, cheap." },
  { id: "hvdc", name: "Continental Links", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, political: 1 }, effect: { emissions: -2, energy: -4, prosperity: 1 },
    text: "Move spare sun across a border." },
  { id: "nuclear", name: "Factory Reactors", lane: "Energy", tags: ["clean", "decouple"],
    cost: { capital: 3, political: 2, industry: 1 }, effect: { emissions: -5, energy: -3, trust: -5 },
    text: "Small reactors, fast build. The politics are not small." },
  { id: "wind", name: "Offshore Belts", lane: "Energy", tags: ["clean"],
    cost: { capital: 2, political: 1 }, effect: { emissions: -3, energy: -4, ecology: -2 },
    text: "Wind in rows at sea. Fish and birds pay a little." },
  { id: "heatpump", name: "Heat Pump Law", lane: "Industry", tags: ["policy", "decouple"],
    cost: { political: 2, trust: 1 }, effect: { emissions: -3, energy: -1 },
    text: "Boilers retire on a date. Homes need a hand." },
  { id: "ev", name: "Street Current", lane: "Industry", tags: ["decouple"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -3, energy: 2, prosperity: 2 },
    text: "Buses and vans leave oil. The grid feels it." },
  { id: "steel", name: "Hydrogen Mills", lane: "Industry", tags: ["decouple", "industry"],
    cost: { capital: 3, research: 1, industry: 1 }, effect: { emissions: -4, energy: 4 },
    text: "Steel without coal. The furnaces drink power." },
  { id: "cement", name: "Cool Kilns", lane: "Industry", tags: ["decouple", "industry"],
    cost: { capital: 2, research: 2 }, effect: { emissions: -3, ecology: 1, energy: 2 },
    text: "Cement that does not need a blast of fire." },
  { id: "dac", name: "Air Capture Yards", lane: "Industry", tags: ["industry"],
    cost: { capital: 4, research: 2, industry: 1 }, effect: { emissions: -5, energy: 6, ecology: 1 },
    text: "Fans pull carbon from the sky and burn a lot of power." },
  { id: "forest", name: "Forest Return", lane: "Land", tags: ["land"],
    cost: { capital: 1, political: 1 }, effect: { emissions: -1, ecology: 8, prosperity: 1 },
    text: "Trees are slow and the bill is small." },
  { id: "agri", name: "Living Soil", lane: "Land", tags: ["land"],
    cost: { capital: 1, research: 1 }, effect: { emissions: -1, ecology: 6, prosperity: 1 },
    text: "Fields that hold rain and carbon." },
  { id: "ferment", name: "Precision Protein", lane: "Land", tags: ["land", "decouple"],
    cost: { research: 2, capital: 1, trust: 1 }, effect: { emissions: -2, ecology: 5 },
    text: "Food from vats. Pastures can rest." },
  { id: "methane", name: "Methane Leash", lane: "Land", tags: ["policy", "land"],
    cost: { political: 1, research: 1 }, effect: { emissions: -4, ecology: 1 },
    text: "Plug the leaks. A fast cut, if the rules hold." },
  { id: "gridai", name: "Grid Conductor", lane: "Materials", tags: ["clean", "decouple"],
    cost: { research: 2, trust: 2 }, effect: { emissions: -1, energy: -4 },
    text: "Software wastes less power. People want the switch." },
  { id: "materials", name: "Matter Studio", lane: "Materials", tags: [],
    cost: { research: 3, capital: 1 }, effect: { energy: -2, prosperity: 3, research: 1, emissions: 1 },
    text: "New alloys. Little climate cut on their own." },
  { id: "recycle", name: "Closed Loops", lane: "Materials", tags: ["decouple", "industry"],
    cost: { capital: 2, industry: 1 }, effect: { emissions: -1, ecology: 4, energy: -2, prosperity: 1 },
    text: "Mine the dumps. Fewer pits, less waste heat." },
  { id: "robotics", name: "Build Crews", lane: "Materials", tags: ["industry"],
    cost: { capital: 2, research: 1, industry: 1 }, effect: { prosperity: 5, industry: 2, emissions: 3 },
    text: "Cities go up fast. More stuff, more exhaust." },
  { id: "mineral", name: "Rock Bind", lane: "Materials", tags: [],
    cost: { capital: 2, research: 1 }, effect: { emissions: -2, ecology: 2, energy: 2 },
    text: "Lock carbon in stone. The crushers need power." },
];

export const SYNERGIES = [
  { id: "grid", name: "Planetary Grid", parts: ["solar", "storage", "hvdc", "gridai"],
    effect: { emissions: -3, energy: -4, prosperity: 3 },
    text: "Sun, storage, wires, and a conductor." },
  { id: "reactors", name: "Quiet Reactors", parts: ["nuclear", "hvdc"],
    effect: { emissions: -2, energy: -2, trust: 2 },
    text: "Firm power with somewhere to send it." },
  { id: "carbon", name: "Carbon Craft", parts: ["dac", "mineral", "geothermal"],
    effect: { emissions: -3, ecology: 2 },
    text: "Capture, bind, and clean heat for the fans." },
  { id: "land", name: "Land Dividend", parts: ["forest", "agri", "ferment"],
    effect: { emissions: -2, ecology: 6, prosperity: 2 },
    text: "Forests, soil, and new food. The land pays you back." },
  { id: "mills", name: "Clean Mills", parts: ["steel", "cement", "recycle"],
    effect: { emissions: -2, prosperity: 2, energy: -3 },
    text: "Industry that loops. The power hunger eases." },
  { id: "electric", name: "Electric Life", parts: ["heatpump", "ev", "gridai"],
    effect: { emissions: -2, energy: -2, prosperity: 2 },
    text: "Heat, travel, and a smarter grid." },
  { id: "quietmethane", name: "Quiet Methane", parts: ["methane", "ferment"],
    effect: { emissions: -2, ecology: 2 },
    text: "Leaks plugged and herds thinned." },
  { id: "lithium", name: "Post-Lithium", parts: ["materials", "storage"],
    effect: { energy: -3, prosperity: 2 },
    text: "Storage that is not a mining boom." },
  { id: "build", name: "Clean Build", parts: ["robotics", "solar", "cement"],
    effect: { emissions: -1, prosperity: 2, industry: 1 },
    text: "Fast construction on a clean slab." },
];

export const IDEAS = [
  { id: "flow", name: "Flow Battery Ink", cost: { research: 2, capital: 1 },
    effect: { energy: -5, emissions: -3, prosperity: 1 },
    text: "Print a battery. It soaks up spare noon." },
  { id: "enzymes", name: "Methane Enzymes", cost: { research: 2, trust: 4 },
    effect: { emissions: -9, ecology: 2 },
    text: "Microbes eat leaks. People flinch at a release." },
  { id: "cables", name: "Healing Cables", cost: { research: 1, industry: 1 },
    effect: { energy: -4, prosperity: 2 },
    text: "Lines that mend. Fewer blackout weeks." },
  { id: "drones", name: "Seed Drones", cost: { capital: 2, research: 1 },
    effect: { ecology: 6, emissions: -2 },
    text: "Swarms replant the bare hills." },
  { id: "kilns", name: "Solar Kilns", cost: { capital: 2, industry: 1 },
    effect: { emissions: -4, energy: -2 },
    text: "Daylight fires the kilns. Night they sleep." },
  { id: "assembly", name: "Trust Assembly", cost: { political: 1 },
    effect: { trust: 5, prosperity: 1, emissions: 1 },
    text: "A public vote on the next build. Slower, steadier." },
  { id: "kelp", name: "Kelp Grids", cost: { capital: 1, political: 1 },
    effect: { ecology: 5, emissions: -3, energy: 1 },
    text: "Farms in the shallows. Boats burn fuel to tend them." },
  { id: "nightlaw", name: "Night Storage Law", cost: { political: 2, trust: 2 },
    effect: { energy: -4, emissions: -3 },
    text: "Store power or pay. A rule, not a gadget." },
];

function reefEffect(state) {
  if (state.warming >= 1.75) return { ecology: -4, trust: -1, prosperity: -1 };
  return { ecology: 1 };
}

function dryEffect(state) {
  const hot = state.warming >= 1.85;
  return {
    ecology: hot ? -5 : -3,
    prosperity: hot ? -4 : -2,
    trust: -1,
  };
}

export const EVENTS = [
  { id: "dry", name: "Dry Season", auto: true, effect: dryEffect,
    text: "Rivers thin. Cities ration a month of water." },
  { id: "spike", name: "Price Spike",
    text: "Power bills jump. Kitchens go dark at the edges.",
    options: [
      { id: "spike:aid", name: "Subsidize power", cost: { capital: 2 }, effect: { energy: -3, trust: 1 },
        text: "The treasury covers the bill." },
      { id: "spike:bite", name: "Let prices bite", effect: { prosperity: -4, trust: -2, energy: 2 },
        text: "Households absorb it. Anger sticks." },
    ] },
  { id: "march", name: "Square March",
    text: "A crowd wants the next plant voted, not announced.",
    options: [
      { id: "march:hear", name: "Hear them", cost: { political: 1 }, effect: { trust: 4 },
        text: "You give the square a real say." },
      { id: "march:clear", name: "Clear the square", effect: { trust: -6, political: 1 },
        text: "The plan stays. The trust does not." },
    ] },
  { id: "copper", name: "Copper Pinch", auto: true, effect: { energy: 3, industry: -1 },
    text: "Wire gets scarce. New lines wait on the dock." },
  { id: "blowout", name: "Well Blowout", auto: true, effect: { emissions: 5, trust: -2, ecology: -2 },
    text: "A super-emitter lets go. The plume is on every screen." },
  { id: "export", name: "Export Rush", auto: true, effect: { prosperity: 5, emissions: 4 },
    text: "Factories hum for foreign orders. The stacks hum too." },
  { id: "border", name: "Border Pressure",
    text: "Heat inland pushes families toward your cities.",
    options: [
      { id: "border:open", name: "Welcome them", cost: { political: 1 }, effect: { trust: 3, prosperity: -2 },
        text: "Room is made. Budgets stretch." },
      { id: "border:shut", name: "Close the ports", effect: { trust: -6, prosperity: 1 },
        text: "The books look finer. The story does not." },
    ] },
  { id: "harvest", name: "Kind Harvest", auto: true, effect: { ecology: 3, prosperity: 2 },
    text: "Rain landed on time. Silos and soil both recover." },
  { id: "storm", name: "Storm Year", auto: true, effect: { prosperity: -4, capital: -1, ecology: -2 },
    text: "Three coasts take a beating. Rebuilds start in the mud." },
  { id: "lobby", name: "Smoke Deal",
    text: "Old plants offer cash to stay open another decade.",
    options: [
      { id: "lobby:take", name: "Take the money", effect: { capital: 3, trust: -6, emissions: 4 },
        text: "The treasury swells. So does the smoke." },
      { id: "lobby:refuse", name: "Refuse", cost: { political: 1 }, effect: { trust: 2 },
        text: "You send them out. Allies grumble." },
    ] },
  { id: "reef", name: "Reef Report", auto: true, effect: reefEffect,
    text: "Divers come back with a count of what is left." },
  { id: "glut", name: "Panel Glut", auto: true, effect: { energy: -4, prosperity: 1, emissions: -1 },
    text: "Panels pile up at the docks. Noon power gets cheaper." },
  { id: "blackout", name: "Three Dark Nights",
    text: "The grid fails on the hottest week of the year.",
    options: [
      { id: "blackout:coal", name: "Coal sprint", effect: { energy: -3, emissions: 4, trust: -1 },
        text: "Old stacks come back. Lights return, smoke too." },
      { id: "blackout:share", name: "Share the shortage", effect: { prosperity: -3, trust: 2, emissions: -1 },
        text: "You ration. Tempers hold, barely." },
    ] },
];

export const ENDINGS = [
  { id: "fractured", name: "Fractured World",
    blurb: "Trust ran out. The plans were real, and nobody would stand still for them." },
  { id: "emergency", name: "Long Emergency",
    blurb: "The heat kept climbing and the surplus did not. People got by, and then they did not." },
  { id: "abundance", name: "Abundance",
    blurb: "Clean power, a living landscape, and enough to share. It took most of the century." },
  { id: "regeneration", name: "Regeneration Century",
    blurb: "The land led. Forests, soil, and coasts did the slow work the stacks would not." },
  { id: "managed", name: "Managed Transition",
    blurb: "The worst was headed off. Not a garden, not a wreck. A world that held." },
  { id: "hotgrowth", name: "Hot Growth Era",
    blurb: "The markets roared and the ice did not care. Rich, and late." },
];

const ENDING_IDS = ENDINGS.map((e) => e.id);

export function endingName(id) {
  const found = ENDINGS.find((e) => e.id === id);
  return found ? found.name : "Unwritten";
}

export function judge(state) {
  // Priority is fixed. Hot Growth is only the remainder, so it cannot swallow a sharper ending.
  if (state.trust <= 28 || state.political < 2) return "fractured";
  if (state.warming >= 2.08 && state.prosperity <= 44) return "emergency";
  if (
    state.warming <= 2.02 &&
    state.prosperity >= 58 &&
    state.ecology >= 55 &&
    state.energy <= 58 &&
    state.emissions <= 62 &&
    state.trust >= 34
  ) return "abundance";
  if (state.ecology >= 66 && state.warming <= 2.2 && state.prosperity >= 42 && state.trust >= 32) {
    return "regeneration";
  }
  if (
    state.warming <= 2.10 &&
    state.prosperity >= 40 &&
    state.trust >= 33 &&
    state.ecology >= 42 &&
    state.emissions <= 72
  ) return "managed";
  if (state.warming <= 2.0 && state.prosperity < 50) return "managed";
  return "hotgrowth";
}

const cardsById = new Map(CARDS.map((card) => [card.id, card]));
const ideasById = new Map(IDEAS.map((idea) => [idea.id, idea]));
const eventsById = new Map(EVENTS.map((event) => [event.id, event]));

function blankState() {
  return {
    capital: 7,
    research: 5,
    political: 4,
    industry: 4,
    trust: 52,
    emissions: 76,
    energy: 71,
    prosperity: 46,
    ecology: 49,
    warming: 1.4,
  };
}

function snapshot(state) {
  const out = {};
  for (const key of Object.keys(BOUNDS)) out[key] = state[key];
  out.warming = state.warming;
  return out;
}

function writeMeter(state, key, value) {
  const range = BOUNDS[key];
  if (!range) return;
  state[key] = round2(clamp(value, range[0], range[1]));
}

function addMeters(state, effect) {
  for (const [key, value] of Object.entries(effect || {})) {
    if (!(key in BOUNDS) || typeof value !== "number" || !Number.isFinite(value) || value === 0) continue;
    writeMeter(state, key, state[key] + value);
  }
}

function resolveEffect(effect, state) {
  const raw = typeof effect === "function" ? effect(state) : effect;
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value === "number" && value !== 0) out[key] = value;
  }
  return out;
}

function canAfford(cost, state) {
  for (const [key, value] of Object.entries(cost || {})) {
    if ((state[key] || 0) + 1e-9 < value) return false;
  }
  return true;
}

function pay(state, cost) {
  for (const [key, value] of Object.entries(cost || {})) writeMeter(state, key, state[key] - value);
}

function pricedCost(card, state) {
  const cost = { ...(card.cost || {}) };
  const policy = card.tags && card.tags.includes("policy");
  if (policy && state.trust < PARAMS.trustSurchargeAt) cost.political = (cost.political || 0) + 1;
  if (state.energy > PARAMS.energySurchargeAt) cost.political = (cost.political || 0) + 1;
  return cost;
}

function scaledEffect(card, state) {
  const effect = { ...(card.effect || {}) };
  if (card.tags && card.tags.includes("policy")) {
    const scale = policyScale(state.trust);
    for (const key of METER_KEYS) {
      if (typeof effect[key] === "number") effect[key] = round2(effect[key] * scale);
    }
  }
  return effect;
}

function take(list, n, rng) {
  const pool = list.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
  return arr;
}

export function synergyProgress(cardId, ownedIds, firedIds) {
  const owned = new Set(ownedIds);
  const fired = new Set(firedIds);
  let completes = 0;
  let advances = 0;
  const names = [];
  for (const syn of SYNERGIES) {
    if (fired.has(syn.id) || !syn.parts.includes(cardId)) continue;
    const have = syn.parts.filter((part) => owned.has(part) || part === cardId).length;
    if (have === syn.parts.length) {
      completes += 1;
      names.push(syn.name);
    } else if (have >= syn.parts.length - 1) advances += 1;
  }
  return { completes, advances, names, value: completes * 4 + advances * 1.6 };
}

function worldStep(state, owned, years) {
  const y = years / 6;
  const clean = tagCount(owned, cardsById, "clean");
  const dec = Math.min(PARAMS.decCap, tagCount(owned, cardsById, "decouple") * PARAMS.decPerCard);
  const notes = [];

  let pol = PARAMS.income.political;
  if (state.energy > 58) pol -= (state.energy - 58) * PARAMS.politicalEnergyDrag;
  if (state.trust < 36) pol -= PARAMS.politicalTrustDrag;
  pol = Math.max(0, pol);
  writeMeter(state, "capital", state.capital + PARAMS.income.capital * y);
  writeMeter(state, "research", state.research + PARAMS.income.research * y);
  writeMeter(state, "industry", state.industry + PARAMS.income.industry * y);
  writeMeter(state, "political", state.political + pol * y);

  const beforePros = state.prosperity;
  let dPros = PARAMS.prosBase * y;
  dPros += (58 - state.energy) * PARAMS.prosEnergy * y;
  if (state.warming > PARAMS.prosHeatAt) dPros -= (state.warming - PARAMS.prosHeatAt) * PARAMS.prosHeat * y;
  writeMeter(state, "prosperity", state.prosperity + dPros);
  if (state.energy > 60 && state.prosperity < beforePros - 0.3) notes.push("Costly energy drags prosperity.");
  if (state.energy < 42 && state.prosperity > beforePros + 0.3) notes.push("Cheap power lifts prosperity.");

  const beforeEm = state.emissions;
  let dEm = Math.max(0, state.prosperity - PARAMS.growthFloor) * PARAMS.growthEmissions * (1 - dec) * y;
  if (state.prosperity > PARAMS.richLeakAt) {
    dEm += (state.prosperity - PARAMS.richLeakAt) * PARAMS.richLeak * (1 - dec) * y;
  }
  if (state.industry > PARAMS.industryLeakAt) {
    dEm += (state.industry - PARAMS.industryLeakAt) * PARAMS.industryLeak * (1 - dec) * y;
  }
  writeMeter(state, "emissions", state.emissions + dEm);
  if (state.emissions > beforeEm + 0.3 && dec < 0.45) notes.push("Growth pushes emissions up.");

  let dEco = -PARAMS.ecoDrift * y;
  if (state.warming > PARAMS.ecoHeatAt) dEco -= (state.warming - PARAMS.ecoHeatAt) * PARAMS.ecoHeat * y;
  const ecoBefore = state.ecology;
  writeMeter(state, "ecology", state.ecology + dEco);

  let dTrust = 0.2;
  if (state.warming > PARAMS.trustHeatAt) dTrust -= (state.warming - PARAMS.trustHeatAt) * PARAMS.trustHeat * y;
  if (state.prosperity < PARAMS.trustPoorAt) dTrust -= PARAMS.trustPoor * y;
  if (state.energy < 44 && state.prosperity > 56 && state.warming < 1.9) dTrust += PARAMS.trustHeal * y;
  writeMeter(state, "trust", state.trust + dTrust);

  const eq = equilibrium(state.emissions, state.ecology);
  const warmed = round2(clamp(stepWarming(state.warming, eq, years), 0, 6));
  if (state.ecology < 42 && warmed > state.warming + 0.01) notes.push("A thin landscape stores less carbon.");
  else if (state.ecology > 68 && eq < equilibrium(state.emissions, ecoBefore)) notes.push("Healthy land slows the heat.");
  state.warming = warmed;
  return { notes: notes.slice(0, 2), decoupling: round2(dec), clean };
}

function derived(state, year) {
  const eq = equilibrium(state.emissions, state.ecology);
  return {
    equilibrium: eq,
    projected: projectWarming(state.warming, state.emissions, state.ecology, year),
  };
}

export function createRun(seed) {
  const rng = mulberry32(seed);
  const state = blankState();
  const owned = [];
  const fired = [];
  const log = [];
  const eventQueue = shuffle(EVENTS.map((event) => event.id), rng);
  let turnIndex = 0;
  let phase = "act";
  let ending = null;
  let hand = [];
  let ideaOffer = [];
  let labLock = 0;
  let pending = null;
  let autoEvent = null;
  let peak = state.warming;

  function rememberPeak() {
    if (state.warming > peak) peak = state.warming;
  }

  function beginTurn() {
    autoEvent = null;
    pending = null;
    const years = spanYears(turnIndex);
    const year = YEARS[turnIndex];
    if (turnIndex >= labLock && ideaOffer.length === 0) {
      ideaOffer = take(IDEAS.map((idea) => idea.id), 2, rng);
    }
    const roll = rng();
    const chance = turnIndex === 0 ? 1 : PARAMS.eventChance;
    if (roll < chance && eventQueue.length) {
      const event = eventsById.get(eventQueue.shift());
      if (event.auto) {
        const effect = resolveEffect(event.effect, state);
        addMeters(state, effect);
        rememberPeak();
        autoEvent = { id: event.id, name: event.name, text: event.text, choiceId: null, effect };
      } else {
        pending = event;
      }
    }
    const remaining = CARDS.map((card) => card.id).filter((id) => !owned.includes(id));
    hand = take(remaining, 3, rng);
    phase = pending ? "event" : "act";
    return { years, year };
  }

  function publicOffers() {
    const year = phase === "end" ? 2100 : YEARS[Math.min(turnIndex, YEARS.length - 1)];
    const cards = hand.map((id) => {
      const card = cardsById.get(id);
      const cost = pricedCost(card, state);
      const effect = scaledEffect(card, state);
      const progress = synergyProgress(id, owned, fired);
      return {
        id: card.id,
        name: card.name,
        lane: card.lane,
        kind: "card",
        text: card.text,
        tags: card.tags.slice(),
        cost,
        effect,
        scale: card.tags.includes("policy") ? policyScale(state.trust) : 1,
        affordable: canAfford(cost, state),
        synergy: progress,
      };
    });
    const ready = turnIndex >= labLock;
    const ideas = ready ? ideaOffer.map((id) => {
      const idea = ideasById.get(id);
      const effect = clampEffect(idea.effect);
      return {
        id: idea.id,
        name: idea.name,
        kind: "idea",
        text: idea.text,
        cost: { ...idea.cost },
        effect,
        raw: { ...idea.effect },
        affordable: canAfford(idea.cost, state),
        available: true,
      };
    }) : [];
    let event = null;
    if (pending) {
      event = {
        id: pending.id,
        name: pending.name,
        text: pending.text,
        options: pending.options.map((option) => ({
          id: option.id,
          name: option.name,
          text: option.text,
          cost: { ...(option.cost || {}) },
          effect: resolveEffect(option.effect, state),
          affordable: canAfford(option.cost, state),
        })),
      };
    } else if (autoEvent) {
      event = {
        id: autoEvent.id,
        name: autoEvent.name,
        text: autoEvent.text,
        options: null,
        effect: autoEvent.effect,
      };
    }
    return {
      year,
      turn: Math.min(turnIndex + 1, TURN_COUNT),
      span: phase === "end" ? 0 : spanYears(turnIndex),
      cards,
      ideas,
      lab: { ready, turnsLeft: Math.max(0, labLock - turnIndex) },
      event,
      canPass: phase === "act",
    };
  }

  function finishIfNeeded() {
    if (turnIndex < TURN_COUNT) return false;
    phase = "end";
    hand = [];
    pending = null;
    ending = judge(state);
    if (!ENDING_IDS.includes(ending)) ending = "hotgrowth";
    return true;
  }

  function chooseAction(id) {
    if (phase === "end") return { ok: false, reason: "ended" };
    if (pending) {
      const option = pending.options.find((item) => item.id === id);
      if (!option) {
        if (ideasById.has(id) && turnIndex < labLock) return { ok: false, reason: "cooldown" };
        return { ok: false, reason: "event" };
      }
      if (!canAfford(option.cost, state)) return { ok: false, reason: "afford" };
      pay(state, option.cost);
      const effect = resolveEffect(option.effect, state);
      addMeters(state, effect);
      rememberPeak();
      autoEvent = {
        id: pending.id,
        name: pending.name,
        text: pending.text,
        choiceId: option.id,
        effect,
      };
      pending = null;
      phase = "act";
      return { ok: true, resolved: "event" };
    }
    if (id === "pass") return commitPick({ id: "pass", name: "Hold steady", kind: "pass" });
    if (ideasById.has(id)) {
      if (turnIndex < labLock) return { ok: false, reason: "cooldown" };
      if (!ideaOffer.includes(id)) return { ok: false, reason: "unoffered" };
      const idea = ideasById.get(id);
      if (!canAfford(idea.cost, state)) return { ok: false, reason: "afford" };
      return commitPick({ id: idea.id, name: idea.name, kind: "idea" });
    }
    if (!cardsById.has(id)) return { ok: false, reason: "unknown" };
    if (!hand.includes(id)) return { ok: false, reason: "unoffered" };
    const card = cardsById.get(id);
    if (!canAfford(pricedCost(card, state), state)) return { ok: false, reason: "afford" };
    return commitPick({ id: card.id, name: card.name, kind: "card" });
  }

  function commitPick(pick) {
    const year = YEARS[turnIndex];
    const span = spanYears(turnIndex);
    const before = snapshot(state);
    const notes = [];
    const sparked = [];
    if (pick.kind === "card") {
      const card = cardsById.get(pick.id);
      const cost = pricedCost(card, state);
      pay(state, cost);
      addMeters(state, scaledEffect(card, state));
      owned.push(card.id);
      for (const syn of SYNERGIES) {
        if (fired.includes(syn.id)) continue;
        if (!syn.parts.every((part) => owned.includes(part))) continue;
        fired.push(syn.id);
        addMeters(state, syn.effect);
        sparked.push(syn.name);
        notes.push(syn.name + " locks in.");
      }
    } else if (pick.kind === "idea") {
      const idea = ideasById.get(pick.id);
      pay(state, idea.cost);
      const applied = clampEffect(idea.effect);
      addMeters(state, applied);
      ideaOffer = [];
      labLock = turnIndex + 3;
    } else {
      notes.push("You hold steady.");
    }
    const step = worldStep(state, owned, span);
    rememberPeak();
    const afterYear = Math.min(2100, year + span);
    const view = derived(state, afterYear);
    log.push({
      turn: turnIndex + 1,
      year,
      span,
      event: autoEvent ? {
        id: autoEvent.id,
        name: autoEvent.name,
        choiceId: autoEvent.choiceId,
        effect: autoEvent.effect,
      } : null,
      pick: { id: pick.id, name: pick.name, kind: pick.kind },
      synergies: sparked.slice(),
      before,
      after: snapshot(state),
      projected: view.projected,
      equilibrium: view.equilibrium,
      notes: notes.concat(step.notes).slice(0, 3),
    });
    turnIndex += 1;
    if (!finishIfNeeded()) beginTurn();
    return { ok: true };
  }

  function tweak(partial) {
    for (const [key, value] of Object.entries(partial || {})) {
      if (key in BOUNDS && typeof value === "number" && Number.isFinite(value)) writeMeter(state, key, value);
    }
    rememberPeak();
    return publicState();
  }

  function publicState() {
    const year = phase === "end" ? 2100 : YEARS[Math.min(turnIndex, YEARS.length - 1)];
    const view = derived(state, year);
    return {
      seed,
      phase,
      turn: phase === "end" ? TURN_COUNT : turnIndex + 1,
      turnIndex: phase === "end" ? TURN_COUNT : turnIndex,
      year,
      span: phase === "end" ? 0 : spanYears(Math.min(turnIndex, TURN_COUNT - 1)),
      capital: state.capital,
      research: state.research,
      political: state.political,
      industry: state.industry,
      emissions: state.emissions,
      energy: state.energy,
      prosperity: state.prosperity,
      ecology: state.ecology,
      trust: state.trust,
      warming: state.warming,
      peak,
      equilibrium: view.equilibrium,
      projected: view.projected,
      owned: owned.slice(),
      synergies: fired.slice(),
      lab: { ready: turnIndex >= labLock && phase !== "end", turnsLeft: Math.max(0, labLock - turnIndex) },
      ending,
      endingName: ending ? endingName(ending) : null,
    };
  }

  beginTurn();

  return {
    choose: chooseAction,
    offers: publicOffers,
    state: publicState,
    log: () => log.map((entry) => JSON.parse(JSON.stringify(entry))),
    ending: () => ending,
    tweak,
  };
}

export function playChoices(seed, chooser) {
  const run = createRun(seed);
  const actions = [];
  let guard = 0;
  while (run.state().phase !== "end") {
    const offers = run.offers();
    const id = chooser(offers, run.state());
    const result = run.choose(id);
    actions.push({ id, result: result.ok ? "ok" : result.reason });
    guard += 1;
    if (!result.ok) {
      const fallback = offers.event ? null : "pass";
      if (fallback) run.choose(fallback);
      else break;
    }
    if (guard > 80) break;
  }
  return { ending: run.ending(), state: run.state(), log: run.log(), actions };
}
