// Breakthrough UI. The model owns the rules. Clicks and __test.choose share choose().
import {
  CARDS,
  ENDINGS,
  IDEA_CLAMP,
  TURN_COUNT,
  clampEffect,
  createRun,
  readIndicators,
} from "./model.js";
import { PREVIEW, paintWorld } from "./map.js";

const $ = (id) => document.getElementById(id);

const COST_LABEL = {
  capital: "Cap",
  research: "Lab",
  political: "Pol",
  industry: "Ind",
  trust: "Trust",
};
const FX_LABEL = {
  emissions: "Emis",
  energy: "Energy",
  prosperity: "Pros",
  ecology: "Eco",
  trust: "Trust",
  capital: "Cap",
  research: "Lab",
  political: "Pol",
  industry: "Ind",
};

export const ART_MANIFEST = {
  "world-base": "art/world-base.webp",
  "sea-level": "art/sea-level.webp",
  smog: "art/smog.webp",
};
for (const region of ["r1", "r2", "r3"]) {
  for (const name of [
    "forest-lush", "forest-thin", "forest-burnt",
    "cities-green", "cities-grey", "cities-smog",
    "power-clean", "power-mixed", "power-coal",
  ]) {
    ART_MANIFEST[`${region}-${name}`] = `art/${region}/${name}.webp`;
  }
}

const artImages = {};
let artProbed = false;

function loadArtFile(file) {
  const slot = Object.keys(ART_MANIFEST).find((key) => ART_MANIFEST[key] === file);
  if (!slot || artImages[slot]) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      artImages[slot] = img;
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = new URL(file, import.meta.url).href;
  });
}

// Painted files are optional. We do not request art/manifest.json unless a
// <link rel="art-manifest"> names it. With no link, a missing manifest makes
// no network call and no 404, and every slot stays procedural.
function probeArt() {
  if (artProbed) return Promise.resolve(artImages);
  artProbed = true;
  const link = document.querySelector("link[rel='art-manifest']");
  if (!link) return Promise.resolve(artImages);
  return fetch(link.getAttribute("href"), { cache: "force-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const files = data && Array.isArray(data.files) ? data.files : [];
      return Promise.all(files.map(loadArtFile)).then(() => artImages);
    })
    .catch(() => artImages);
}

function normalizeSeed(n) {
  const reduced = Number(n) >>> 0;
  return reduced === 0 ? 1 : reduced;
}

function clockSeed() {
  return normalizeSeed((Date.now() % 2147483646) + 1);
}

function freshSeed(avoid) {
  let next = clockSeed();
  if (next === avoid) next = next >= 2147483646 ? 1 : next + 1;
  return next;
}

function readSeedString(raw) {
  if (raw == null || raw === "") return { seed: clockSeed(), bad: false, pinned: false };
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) return { seed: normalizeSeed(n), bad: false, pinned: true };
  }
  return { seed: clockSeed(), bad: true, pinned: false };
}

const params = new URLSearchParams(location.search);
const fast = params.get("fast") === "1";
let seedInfo = readSeedString(params.get("seed"));
let seed = seedInfo.seed;
let badSeed = seedInfo.bad;
const seedPinned = seedInfo.pinned;
const pinnedSeed = seedPinned ? seed : 0;
let run = null;
let ui = "title";
let busy = false;
let flashTimer = 0;
let mapToken = 0;
let shown = null;

if (fast) document.documentElement.dataset.fast = "1";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function motionOn() {
  return !fast && !reduceMotion.matches;
}
function syncReduce() {
  document.documentElement.dataset.reduce = reduceMotion.matches ? "1" : "";
}
syncReduce();
if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", () => {
  syncReduce();
  if (motionOn()) startDrift();
  else {
    driftOn = false;
    pulse = 0;
    paintShown();
  }
  if (motionOn()) startHelpMotion();
  else stopHelpMotion();
});

const SPARK_COLOR = {
  emissions: "#B5472E",
  energy: "#C98B3C",
  prosperity: "#E8B94A",
  ecology: "#5E8C61",
  trust: "#3E7C8F",
};
const SHORT_ENDING = {
  fractured: "Fractured",
  emergency: "Emergency",
  abundance: "Abundance",
  regeneration: "Regen",
  managed: "Managed",
  hotgrowth: "Hot growth",
};

const canvas = $("map");
const mapwrap = $("mapwrap");
let clock = 0;
let pulse = 0;
let driftOn = false;
let mapFrom = null;
let mapTarget = null;
let mapT0 = 0;
let seenEvent = "";
let chartSig = "";
const shownNum = new Map();
const tweenToken = new Map();

function pairs(obj, labels) {
  const bits = [];
  for (const [key, value] of Object.entries(obj || {})) {
    if (!value) continue;
    const sign = value > 0 ? "+" : "";
    bits.push(`${labels[key] || key} ${sign}${value}`);
  }
  return bits.join(" · ");
}

function costText(obj) {
  const bits = [];
  for (const [key, value] of Object.entries(obj || {})) {
    if (!value) continue;
    bits.push(`${Math.abs(value)} ${COST_LABEL[key] || key}`);
  }
  return bits.join(" · ");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cardButton(offer) {
  const btn = el("button", offer.affordable ? "card" : "card dim");
  btn.type = "button";
  btn.dataset.choice = offer.id;
  if (offer.lane) btn.dataset.lane = offer.lane;
  if (!offer.affordable) btn.setAttribute("aria-disabled", "true");
  const lane = offer.kind === "idea" ? "Lab" : offer.lane;
  btn.append(el("span", "lane", lane));
  btn.append(el("strong", "", offer.name));
  btn.append(el("span", "meta", offer.text));
  const cost = costText(offer.cost);
  btn.append(el("span", "meta", cost ? `Cost ${cost}` : "Cost free"));
  const fx = pairs(offer.effect, FX_LABEL);
  if (fx) btn.append(el("span", "fx", fx));
  if (offer.scale != null && offer.scale < 1) btn.append(el("span", "hint", "Low trust softens this."));
  if (offer.synergy && offer.synergy.names.length) {
    btn.append(el("span", "hint", `Completes ${offer.synergy.names.join(", ")}`));
  } else if (offer.synergy && offer.synergy.advances) {
    btn.append(el("span", "hint", "Builds toward a set."));
  }
  return btn;
}

function fitCanvas(node) {
  const rect = node.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round((rect.width || node.clientWidth || 2) * dpr));
  const h = Math.max(2, Math.round((rect.height || node.clientHeight || 2) * dpr));
  if (node.width !== w || node.height !== h) {
    node.width = w;
    node.height = h;
  }
  return dpr;
}

function easeOutCubic(u) {
  return 1 - (1 - u) ** 3;
}

function tweenNumber(node, key, value, format, delay) {
  if (!node) return;
  const next = Number(value);
  const prev = shownNum.has(key) ? shownNum.get(key) : next;
  shownNum.set(key, next);
  const token = (tweenToken.get(key) || 0) + 1;
  tweenToken.set(key, token);
  if (!motionOn() || !Number.isFinite(prev) || prev === next) {
    node.textContent = format(next);
    return;
  }
  const t0 = performance.now() + (delay || 0);
  const step = (now) => {
    if (tweenToken.get(key) !== token) return;
    const raw = (now - t0) / 480;
    const u = Math.max(0, Math.min(1, raw));
    node.textContent = format(prev + (next - prev) * easeOutCubic(u));
    if (raw < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function paintDelta(node, key, value) {
  if (!node) return;
  node.className = "delta";
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) {
    node.textContent = "·";
    return;
  }
  const up = value > 0;
  const badUp = key === "emissions" || key === "energy";
  node.classList.add(up ? "up" : "down", (up !== badUp) ? "good" : "bad");
  const mag = Math.abs(value) >= 1 ? String(Math.abs(Math.round(value))) : Math.abs(value).toFixed(1);
  node.textContent = `${up ? "↑" : "↓"}${mag}`;
}

function headingLine(ind, phase) {
  if (!ind) return "Path opens with the century";
  if (phase === "end") return `Ended in ${ind.heading.name}`;
  return `Heading toward ${ind.heading.name}`;
}

function tipLine(ind) {
  if (!ind) return "The mark is the 2.0° tip";
  const tip = ind.tip;
  if (!tip.crossed) return "Holds under the 2.0° tip";
  if (tip.already) return `Past the 2.0° tip since ${tip.year}`;
  return `Crosses 2.0° around ${tip.year}`;
}

function viewOf(state) {
  if (!state) return { ...PREVIEW };
  return {
    warming: state.warming,
    emissions: state.emissions,
    energy: state.energy,
    prosperity: state.prosperity,
    ecology: state.ecology,
    trust: state.trust,
  };
}

function paintShown() {
  fitCanvas(canvas);
  paintWorld(canvas, shown || PREVIEW, artImages, {
    t: motionOn() ? clock : 0,
    pulse: motionOn() ? pulse : 0,
  });
}

function startDrift() {
  if (driftOn || !motionOn()) return;
  driftOn = true;
  let last = performance.now();
  const loop = (now) => {
    if (!motionOn() || document.hidden) {
      driftOn = false;
      return;
    }
    const dt = Math.min(48, now - last);
    last = now;
    clock = now * 0.001;
    if (pulse > 0) pulse *= Math.pow(0.9, dt / 16.7);
    if (mapFrom && mapTarget) {
      const u = Math.min(1, (now - mapT0) / 700);
      const e = u * u * (3 - 2 * u);
      const next = {};
      for (const key of Object.keys(mapTarget)) {
        next[key] = mapFrom[key] + (mapTarget[key] - mapFrom[key]) * e;
      }
      shown = next;
      if (u >= 1) {
        shown = { ...mapTarget };
        mapFrom = null;
      }
    }
    paintShown();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function showMap(state, animate) {
  mapTarget = viewOf(state);
  mapToken += 1;
  if (!motionOn() || !animate || !shown) {
    shown = { ...mapTarget };
    mapFrom = null;
    paintShown();
    if (motionOn()) startDrift();
    return;
  }
  mapFrom = { ...shown };
  mapT0 = performance.now();
  startDrift();
}

function seriesRange(values) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (max - min < 0.3) {
    const mid = (max + min) / 2;
    min = mid - 0.15;
    max = mid + 0.15;
  }
  return { min, max };
}

function paintSpark(node, ind, key) {
  if (!node) return;
  const dpr = fitCanvas(node);
  const ctx = node.getContext("2d");
  const w = node.width;
  const h = node.height;
  ctx.clearRect(0, 0, w, h);
  if (!ind || !ind.history.length) return;
  const past = ind.history.map((point) => ({ i: point.i, v: point[key] }));
  const future = ind.forward.map((point) => ({ i: point.i, v: point[key] }));
  const all = past.concat(future);
  const range = seriesRange(all.map((point) => point.v));
  const xOf = (i) => (i / TURN_COUNT) * (w - 2) + 1;
  const yOf = (v) => (1 - (v - range.min) / (range.max - range.min)) * (h - 2) + 1;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = SPARK_COLOR[key] || "#2B2A33";
  ctx.beginPath();
  past.forEach((point, index) => {
    const x = xOf(point.i);
    const y = yOf(point.v);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  if (!future.length) return;
  ctx.setLineDash([3 * dpr, 2 * dpr]);
  ctx.beginPath();
  const last = past[past.length - 1];
  ctx.moveTo(xOf(last.i), yOf(last.v));
  for (const point of future) ctx.lineTo(xOf(point.i), yOf(point.v));
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintTrajectory(ind) {
  const node = $("path-chart");
  const dpr = fitCanvas(node);
  const ctx = node.getContext("2d");
  const w = node.width;
  const h = node.height;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `600 ${10 * dpr}px "DM Sans", sans-serif`;
  if (!ind || !ind.history.length) {
    ctx.fillStyle = "#8A8378";
    ctx.fillText("Path opens with the century", 8 * dpr, h * 0.55);
    return;
  }
  const history = ind.history;
  const forward = ind.forward;
  const level = ind.tip.level;
  const samples = [level];
  for (const point of history) samples.push(point.warming);
  for (const point of forward) samples.push(point.warming, point.lo, point.hi);
  const range = seriesRange(samples);
  const pad = Math.max(0.08, (range.max - range.min) * 0.08);
  const min = range.min - pad;
  const max = range.max + pad;
  const plotL = 4 * dpr;
  const plotR = w - 4 * dpr;
  const plotT = 12 * dpr;
  const plotB = h - 14 * dpr;
  const xOf = (i) => plotL + (Math.max(0, Math.min(TURN_COUNT, i)) / TURN_COUNT) * (plotR - plotL);
  const yOf = (v) => plotT + (max - v) / (max - min) * (plotB - plotT);
  const yTip = yOf(level);
  ctx.save();
  ctx.strokeStyle = "rgba(181, 71, 46, 0.9)";
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(plotL, yTip);
  ctx.lineTo(plotR, yTip);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#B5472E";
  ctx.font = `700 ${10 * dpr}px "DM Sans", sans-serif`;
  ctx.fillText("2.0°", plotL, Math.max(10 * dpr, yTip - 3 * dpr));

  const now = history[history.length - 1];
  if (forward.length) {
    ctx.beginPath();
    ctx.moveTo(xOf(now.i), yOf(now.warming));
    for (const point of forward) ctx.lineTo(xOf(point.i), yOf(point.hi));
    for (let k = forward.length - 1; k >= 0; k -= 1) ctx.lineTo(xOf(forward[k].i), yOf(forward[k].lo));
    ctx.closePath();
    ctx.fillStyle = "rgba(62, 124, 143, 0.22)";
    ctx.fill();
  }
  if (history.length > 1) {
    ctx.beginPath();
    ctx.moveTo(xOf(history[0].i), plotB);
    for (const point of history) ctx.lineTo(xOf(point.i), yOf(point.warming));
    ctx.lineTo(xOf(now.i), plotB);
    ctx.closePath();
    ctx.fillStyle = "rgba(181, 71, 46, 0.14)";
    ctx.fill();
  }
  ctx.beginPath();
  history.forEach((point, index) => {
    const x = xOf(point.i);
    const y = yOf(point.warming);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#B5472E";
  ctx.lineWidth = 2 * dpr;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  if (forward.length) {
    ctx.beginPath();
    ctx.moveTo(xOf(now.i), yOf(now.warming));
    for (const point of forward) ctx.lineTo(xOf(point.i), yOf(point.warming));
    ctx.strokeStyle = "#3E7C8F";
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.fillStyle = "#F3E9D6";
  ctx.strokeStyle = "#B5472E";
  ctx.lineWidth = 2 * dpr;
  ctx.arc(xOf(now.i), yOf(now.warming), 3.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (ind.tip.crossed && ind.tip.i != null) {
    const x = xOf(ind.tip.i);
    const y = yTip;
    ctx.beginPath();
    ctx.fillStyle = "#E8B94A";
    ctx.moveTo(x, y - 5 * dpr);
    ctx.lineTo(x + 4.5 * dpr, y);
    ctx.lineTo(x, y + 5 * dpr);
    ctx.lineTo(x - 4.5 * dpr, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#8A8378";
  ctx.font = `600 ${10 * dpr}px "DM Sans", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(String(history[0].year), plotL, h - 2 * dpr);
  ctx.textAlign = "right";
  ctx.fillText("2100", plotR, h - 2 * dpr);
  ctx.restore();
}

function renderMeters(state, ind) {
  let index = 0;
  for (const node of document.querySelectorAll(".meter")) {
    const key = node.dataset.k;
    const value = state ? state[key] : PREVIEW[key];
    const bar = node.querySelector("i");
    let fill = bar.querySelector("b");
    if (!fill) {
      fill = document.createElement("b");
      fill.className = "fill";
      bar.append(fill);
    }
    const portion = Math.max(0, Math.min(1, value / 100));
    if (!fill.dataset.ready) {
      fill.dataset.ready = "1";
      fill.style.setProperty("--p", motionOn() ? "0" : String(portion));
      if (motionOn()) {
        requestAnimationFrame(() => fill.style.setProperty("--p", String(portion)));
      }
    } else {
      fill.style.setProperty("--p", String(portion));
    }
    tweenNumber(node.querySelector(".num"), key, value, (n) => String(Math.round(n)), 40 + index * 40);
    paintDelta(node.querySelector(".delta"), key, ind ? ind.deltas[key] : 0);
    paintSpark(node.querySelector(".spark"), ind, key);
    index += 1;
  }
  if (!state) {
    tweenNumber($("warm-now"), "warming", PREVIEW.warming, (n) => `${n.toFixed(1)}° now`, 0);
    $("warm-chase").textContent = "Chasing the century";
    $("warm-proj").textContent = "2100 still open";
    $("resources").textContent = "Cap 7 · Lab 5 · Pol 4 · Ind 4";
    $("turn-label").textContent = "Twelve turns";
    $("yearchip").textContent = "2026";
    return;
  }
  tweenNumber($("warm-now"), "warming", state.warming, (n) => `${n.toFixed(1)}° now`, 0);
  tweenNumber($("warm-chase"), "eq", state.equilibrium, (n) => `Chasing ${n.toFixed(1)}°`, 40);
  tweenNumber($("warm-proj"), "proj", state.projected, (n) => `${n.toFixed(1)}° by 2100`, 80);
  $("resources").textContent = `Cap ${state.capital} · Lab ${state.research} · Pol ${state.political} · Ind ${state.industry}`;
  $("turn-label").textContent = state.phase === "end"
    ? "2100"
    : `Turn ${state.turn} of ${TURN_COUNT}`;
  const span = state.span === 10 ? "10 year step" : `${state.span} year step`;
  $("yearchip").textContent = state.phase === "end" ? "2100" : `${state.year} · ${span}`;
}

function renderSignals(state, ind) {
  const head = headingLine(ind, state && state.phase);
  const tip = tipLine(ind);
  $("path-ending").textContent = head;
  $("path-tip").textContent = tip;
  $("path").setAttribute("aria-label", `${head}. ${tip}`);
  const sig = ind
    ? `${ind.history.length}:${ind.forward.length}:${ind.history[ind.history.length - 1].warming}:${ind.heading.id}:${ind.tip.i}`
    : "title";
  if (sig !== chartSig) {
    chartSig = sig;
    const chart = $("path-chart");
    if (motionOn()) {
      chart.classList.remove("tick");
      void chart.offsetWidth;
      chart.classList.add("tick");
    }
  }
  paintTrajectory(ind);
  paintRace(ind);
  if (!ind) {
    $("stockline").textContent = "";
    $("ledger").textContent = "";
    $("pressures").replaceChildren();
    $("outlook").replaceChildren();
    $("journal").replaceChildren();
    return;
  }
  const move = ind.stock.closes;
  const sign = move > 0 ? "+" : "";
  const pct = Math.round(ind.stock.alpha * 100);
  $("stockline").textContent = `Stock ${ind.stock.warming.toFixed(1)}° · target ${ind.stock.target.toFixed(1)}° · lag ${pct}% · ${sign}${move.toFixed(2)}° this step`;
  const led = ind.ledger;
  const signed = (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
  $("ledger").textContent = `Stacks ${signed(led.added)} · Avoided ${signed(led.avoided)} · Net ${signed(led.net)} · Land sink ${signed(led.sink)}°`;
  const pressures = $("pressures");
  pressures.replaceChildren();
  if (!ind.pressures.length) {
    pressures.append(el("p", "muted", "No strong pressure this step."));
  } else {
    for (const row of ind.pressures) {
      const up = row.value > 0;
      const chip = el("span", up ? "pressure up" : "pressure down");
      chip.textContent = `${row.from} → ${row.to} ${up ? "↑" : "↓"}${Math.abs(row.value).toFixed(2)}`;
      pressures.append(chip);
    }
  }
  const outlook = $("outlook");
  outlook.replaceChildren();
  for (const row of ind.outlook) {
    const item = el("div", row.id === ind.heading.id ? "outlook heading" : "outlook");
    item.append(el("span", "name", SHORT_ENDING[row.id] || row.name));
    const bar = document.createElement("i");
    const fill = document.createElement("b");
    fill.style.setProperty("--p", String(Math.max(0, Math.min(1, row.share))));
    bar.append(fill);
    item.append(bar);
    item.append(el("em", "", `${Math.round(row.share * 100)}%`));
    outlook.append(item);
  }
  const journal = $("journal");
  journal.replaceChildren();
  const entries = run ? run.log() : [];
  if (!entries.length) {
    journal.append(el("li", "", "No turns yet."));
    return;
  }
  for (const entry of entries) {
    const eventBit = entry.event ? ` ${entry.event.name}.` : "";
    const syn = entry.synergies.length ? ` ${entry.synergies.join(", ")}.` : "";
    const pathBit = entry.pathway
      ? (entry.pathway.breakthrough ? " Breakthrough." : entry.pathway.stalled ? " Stalled." : " Advanced.")
      : "";
    journal.append(el("li", "", `${entry.year} ${entry.pick.name}.${eventBit}${pathBit}${syn} ${entry.after.warming.toFixed(1)}°`));
  }
}

function renderOffers() {
  const hand = $("hand");
  const ideas = $("ideas");
  const news = $("news");
  hand.replaceChildren();
  ideas.replaceChildren();
  if (!run || ui !== "play") {
    news.hidden = true;
    $("lab-note").textContent = "Opens when the century begins.";
    $("pass").hidden = true;
    renderPathways(null);
    return;
  }
  const offers = run.offers();
  const state = run.state();
  $("pass").hidden = state.phase === "end" || state.phase === "event";
  if (offers.event) {
    news.hidden = false;
    $("news-title").textContent = offers.event.name;
    $("news-text").textContent = offers.event.text;
    const box = $("news-options");
    box.replaceChildren();
    for (const option of offers.event.options || []) {
      const btn = el("button", option.affordable === false ? "option dim" : "option");
      btn.type = "button";
      btn.dataset.choice = option.id;
      if (option.affordable === false) btn.setAttribute("aria-disabled", "true");
      const cost = costText(option.cost);
      const fx = pairs(option.effect, FX_LABEL);
      btn.append(el("strong", "", option.name));
      btn.append(el("span", "meta", option.text));
      if (cost) btn.append(el("span", "meta", `Cost ${cost}`));
      if (fx) btn.append(el("span", "fx", fx));
      box.append(btn);
    }
  } else {
    news.hidden = true;
  }
  for (const card of offers.cards) hand.append(cardButton(card));
  renderPathways(offers);
  if (offers.lab.ready) {
    $("lab-note").textContent = "One wild card. No reroll.";
    for (const idea of offers.ideas) ideas.append(cardButton(idea));
  } else {
    const left = offers.lab.turnsLeft;
    $("lab-note").textContent = left === 1 ? "Back in 1 turn." : `Back in ${left} turns.`;
  }
}

function notePulse(offers) {
  const id = offers && offers.event ? offers.event.id : "";
  if (id && id !== seenEvent) {
    seenEvent = id;
    pulse = 1;
    if (motionOn()) startDrift();
  }
  if (!id) seenEvent = "";
}

function render(animateMap) {
  const state = run ? run.state() : null;
  const ind = state && ui !== "title" ? readIndicators(state, run.log()) : null;
  $("seedline").textContent = `Seed ${seed}`;
  $("title-seed").textContent = `Seed ${seed}`;
  $("seed-warn").hidden = !badSeed;
  renderMeters(state, ind);
  renderSignals(state, ind);
  renderOffers();
  if (run && ui === "play") notePulse(run.offers());
  showMap(state, animateMap);
  document.documentElement.dataset.phase = state ? state.phase : "title";
}

function dismiss(id) {
  const node = $(id);
  if (!node || node.hidden) return;
  if (!motionOn()) {
    node.hidden = true;
    node.classList.remove("leaving");
    return;
  }
  if (node.classList.contains("leaving")) return;
  node.classList.add("leaving");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    node.hidden = true;
    node.classList.remove("leaving");
  };
  node.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 520);
}

function makeRing(progress, need) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("class", "ring");
  svg.setAttribute("aria-hidden", "true");
  const c = (2 * Math.PI * RING_R).toFixed(2);
  for (const cls of ["track", "value"]) {
    const circle = document.createElementNS(SVGNS, "circle");
    circle.setAttribute("cx", "18");
    circle.setAttribute("cy", "18");
    circle.setAttribute("r", String(RING_R));
    circle.setAttribute("class", cls);
    if (cls === "value") {
      circle.style.setProperty("--c", c);
      circle.style.setProperty("--p", String(Math.max(0, Math.min(1, progress / need))));
    }
    svg.append(circle);
  }
  return svg;
}

function pathRow(spec) {
  const row = el("article", "path");
  row.dataset.key = spec.key;
  const box = el("div", "ringbox");
  box.append(makeRing(spec.progress, spec.need));
  const pips = el("span", "pips");
  for (let i = 0; i < 3; i += 1) pips.append(el("i", ""));
  box.append(pips);
  row.append(box);
  const copy = el("div", "pathcopy");
  copy.append(el("strong", "", ""));
  copy.append(el("span", "stage", ""));
  copy.append(el("p", "tip", ""));
  copy.append(el("p", "stall", ""));
  row.append(copy);
  const btn = el("button", "invest");
  btn.type = "button";
  row.append(btn);
  return row;
}

function updatePathRow(row, spec) {
  row.classList.toggle("broke", !!spec.done);
  const ring = row.querySelector(".ring .value");
  if (ring) ring.style.setProperty("--p", String(Math.max(0, Math.min(1, spec.progress / spec.need))));
  const pipNodes = row.querySelectorAll(".pips i");
  spec.pips.forEach((pip, i) => {
    pipNodes[i].className = pip === "wait" ? "" : pip;
  });
  row.querySelector("strong").textContent = spec.name;
  row.querySelector(".stage").textContent = STAGE_LABEL[spec.stage] || spec.stage;
  row.querySelector(".tip").textContent = spec.tip;
  row.querySelector(".stall").textContent = spec.stallText;
  const btn = row.querySelector("button");
  btn.classList.toggle("dim", !spec.affordable && !spec.done);
  if (spec.done) {
    btn.textContent = "Done";
    btn.disabled = true;
    btn.removeAttribute("data-choice");
    btn.removeAttribute("aria-disabled");
  } else {
    btn.textContent = "Invest";
    btn.disabled = false;
    btn.dataset.choice = spec.id;
    btn.setAttribute("aria-label", `Invest in ${spec.name}`);
    if (spec.affordable) btn.removeAttribute("aria-disabled");
    else btn.setAttribute("aria-disabled", "true");
  }
  row.title = `${spec.text} ${spec.tip} ${spec.stallText}`;
}

function renderPathways(offers) {
  const root = $("pathways");
  const list = offers && offers.pathways;
  if (!list || !list.length) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  if (root.dataset.built !== "1") {
    root.dataset.built = "1";
    root.append(el("h2", "", "Pathways"));
    root.append(el("p", "path-lead", "Six tracks for the hard parts of net zero. One step a turn. They share the same limited resources as a card."));
    root.append(el("div", "path-rows"));
  }
  const rows = root.querySelector(".path-rows");
  if (rows.children.length !== list.length) {
    rows.replaceChildren(...list.map(pathRow));
  }
  list.forEach((spec, i) => updatePathRow(rows.children[i], spec));
}

function paintRace(ind) {
  const race = ind && ind.race;
  const node = $("race");
  if (!race || !(race.years > 0)) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  $("race-status").textContent = race.summary;
  const scale = Math.max(race.demand, race.met, 0.2);
  $("race-demand").style.setProperty("--p", String(Math.max(0, Math.min(1, race.demand / scale))));
  $("race-met").style.setProperty("--p", String(Math.max(0, Math.min(1, race.met / scale))));
  $("race-demand-n").textContent = race.demand.toFixed(1);
  $("race-met-n").textContent = race.met.toFixed(1);
  const fossil = $("race-fossil");
  fossil.textContent = race.fossilLabel;
  fossil.className = race.fossilDown ? "down" : race.fossil > 0.02 ? "up" : "";
  $("race-curtail").textContent = race.curtailed >= 0.05
    ? `Curtailment ${race.curtailed.toFixed(1)}. Clean supply the wires cannot take.`
    : "No meaningful curtailment this step.";
  node.setAttribute("aria-label", `${race.summary} ${race.fossilLabel}`);
}

function showFlash(entry) {
  if (!entry) return;
  const arrived = Math.min(2100, entry.year + entry.span);
  $("flash-year").textContent = String(arrived);
  const bits = [entry.pick.name];
  if (entry.synergies.length) bits.push(entry.synergies.join(", "));
  if (entry.notes[0]) bits.push(entry.notes[0]);
  $("flash-line").textContent = bits.join(". ");
  $("flash").hidden = false;
  clearTimeout(flashTimer);
  if (fast) {
    $("flash").hidden = true;
    busy = false;
    return;
  }
  busy = true;
  flashTimer = setTimeout(() => {
    $("flash").hidden = true;
    busy = false;
  }, 680);
}

function showBreakthrough(info, entry) {
  if (!info) return;
  $("break-name").textContent = info.name;
  $("break-line").textContent = info.line;
  const arrived = entry ? Math.min(2100, entry.year + entry.span) : "";
  $("break-year").textContent = arrived ? String(arrived) : "";
  const node = $("break");
  node.hidden = false;
  node.classList.toggle("moment", motionOn());
  clearTimeout(flashTimer);
  if (fast) {
    busy = false;
    return;
  }
  busy = motionOn();
  flashTimer = setTimeout(() => {
    node.hidden = true;
    node.classList.remove("moment");
    busy = false;
  }, motionOn() ? 900 : 700);
}

function showEnding() {
  $("break").hidden = true;
  const state = run.state();
  const info = ENDINGS.find((item) => item.id === state.ending) || ENDINGS[ENDINGS.length - 1];
  $("end-name").textContent = info.name;
  $("end-blurb").textContent = info.blurb;
  $("end-kicker").textContent = "2100";
  const scaled = Object.entries(state.pathways || []).filter(([, n]) => n >= 3).map(([key]) => key);
  const names = {
    aviation: "Aviation fuels",
    shipping: "Shipping fuels",
    heavy: "Heavy industry",
    storage: "Long-duration storage",
    grids: "Grids",
    removal: "Carbon removal",
  };
  $("end-paths").textContent = scaled.length
    ? `At scale: ${scaled.map((key) => names[key] || key).join(", ")}.`
    : "No pathway reached scale.";
  $("end-stats").textContent = `${state.warming.toFixed(1)}° now · peak ${state.peak.toFixed(1)}° · prosperity ${Math.round(state.prosperity)} · ecology ${Math.round(state.ecology)} · trust ${Math.round(state.trust)}`;
  $("end-seed").textContent = `Seed ${seed}`;
  const list = $("timeline");
  list.replaceChildren();
  for (const entry of run.log()) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = String(entry.year);
    const eventBit = entry.event ? ` ${entry.event.name}.` : "";
    const syn = entry.synergies.length ? ` ${entry.synergies.join(", ")}.` : "";
    const pathBit = entry.pathway
      ? (entry.pathway.breakthrough ? " Breakthrough." : entry.pathway.stalled ? " Stalled." : " Advanced.")
      : "";
    li.append(strong);
    li.append(` ${entry.pick.name}.${eventBit}${pathBit}${syn} ${entry.after.warming.toFixed(1)}°`);
    list.append(li);
  }
  $("ending").hidden = false;
  ui = "end";
}

const REFUSAL = {
  afford: "You cannot pay that.",
  event: "Settle the news first.",
  unoffered: "That card is not in this hand.",
  unknown: "That is not a card.",
  ended: "The century is already written.",
  title: "Begin the century first.",
  busy: "The year is still turning.",
  done: "That pathway is already at scale.",
};

const STAGE_LABEL = {
  ready: "Research",
  pilot: "Pilot",
  scale: "Scale",
  breakthrough: "Breakthrough",
};
const SVGNS = "http://www.w3.org/2000/svg";
const RING_R = 14;

function choose(id) {
  if (!run || ui !== "play") return { ok: false, reason: "title" };
  if (busy) return { ok: false, reason: "busy" };
  $("break").hidden = true;
  $("break").classList.remove("moment");
  const before = run.state().turn;
  const result = run.choose(id);
  if (!result.ok) {
    if (result.reason === "cooldown") {
      const left = run.state().lab.turnsLeft;
      $("note").textContent = left === 1
        ? "Idea Lab is closed for 1 turn."
        : `Idea Lab is closed for ${left} turns.`;
    } else {
      $("note").textContent = REFUSAL[result.reason] || "Not now.";
    }
    return result;
  }
  $("note").textContent = "";
  pulse = 1;
  const state = run.state();
  render(result.resolved !== "event");
  if (state.phase === "end") {
    showEnding();
    return result;
  }
  if (result.breakthrough) showBreakthrough(result.breakthrough, run.log().at(-1));
  else if (result.resolved !== "event" && state.turn !== before) showFlash(run.log().at(-1));
  return result;
}

function startGame(next) {
  if (typeof next === "number" && Number.isInteger(next)) {
    seed = normalizeSeed(next);
    badSeed = false;
  } else if (typeof next === "string") {
    const parsed = readSeedString(next);
    seed = parsed.seed;
    badSeed = parsed.bad;
  }
  clearTimeout(flashTimer);
  busy = false;
  $("flash").hidden = true;
  run = createRun(seed);
  ui = "play";
  seenEvent = "";
  chartSig = "";
  $("ending").hidden = true;
  $("ending").classList.remove("leaving");
  $("note").textContent = "";
  dismiss("title");
  dismiss("howto");
  render(motionOn());
  return { ok: true, seed };
}

function playAgain() {
  if (seedPinned) {
    seed = pinnedSeed;
    badSeed = false;
  } else {
    seed = freshSeed(seed);
    badSeed = false;
  }
  return startGame();
}

let helpIndex = 0;
let helpTimer = 0;

function showHelpScene(index) {
  const scenes = [...document.querySelectorAll("#howto .help-scene")];
  if (!scenes.length) return;
  helpIndex = (index + scenes.length) % scenes.length;
  scenes.forEach((scene, i) => {
    const on = i === helpIndex;
    scene.classList.toggle("is-on", on);
    scene.setAttribute("aria-hidden", on ? "false" : "true");
  });
  document.querySelectorAll("#howto .help-dot").forEach((dot, i) => {
    const on = i === helpIndex;
    dot.classList.toggle("is-on", on);
    dot.setAttribute("aria-selected", on ? "true" : "false");
  });
  const step = $("help-step");
  if (step) step.textContent = `${helpIndex + 1} of ${scenes.length}`;
}

function stopHelpMotion() {
  clearInterval(helpTimer);
  helpTimer = 0;
}

function startHelpMotion() {
  stopHelpMotion();
  if (!motionOn() || $("howto").hidden) return;
  helpTimer = setInterval(() => showHelpScene(helpIndex + 1), 4600);
}

function openHelp() {
  $("howto").hidden = false;
  showHelpScene(helpIndex);
  startHelpMotion();
}
function closeHelp() {
  $("howto").hidden = true;
  stopHelpMotion();
}

$("sheet").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-choice]");
  if (!btn) return;
  choose(btn.dataset.choice);
});
$("start").addEventListener("click", () => startGame());
$("again").addEventListener("click", () => playAgain());
$("help").addEventListener("click", openHelp);
$("howto-open").addEventListener("click", openHelp);
$("howto-close").addEventListener("click", closeHelp);
$("help-stage").addEventListener("click", () => {
  showHelpScene(helpIndex + 1);
  startHelpMotion();
});
$("howto").addEventListener("click", (event) => {
  const dot = event.target.closest(".help-dot");
  if (!dot) return;
  showHelpScene(Number(dot.dataset.help));
  startHelpMotion();
});

window.addEventListener("resize", () => {
  paintShown();
  if (run && ui !== "title") {
    const ind = readIndicators(run.state(), run.log());
    paintTrajectory(ind);
    for (const node of document.querySelectorAll(".meter")) {
      paintSpark(node.querySelector(".spark"), ind, node.dataset.k);
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && motionOn()) startDrift();
});

const exposeTest = params.get("test") === "1" || params.get("fast") === "1" || params.has("seed");
if (exposeTest) {
  window.__test = {
    state() {
      const base = run ? run.state() : {
        phase: "title",
        turn: 0,
        year: 2026,
        span: 0,
        warming: PREVIEW.warming,
        projected: null,
        ending: null,
        endingName: null,
      };
      return { ...base, seed, badSeed, fast, busy, ui };
    },
    log() {
      return run ? run.log() : [];
    },
    offers() {
      return run && ui === "play" ? run.offers() : null;
    },
    choose,
    start(next) {
      return startGame(next);
    },
    ending() {
      return run ? run.ending() : null;
    },
    tweak(partial) {
      if (!run) return null;
      const state = run.tweak(partial);
      shown = viewOf(state);
      render(false);
      return state;
    },
    clampEffect,
    ideaClamp: IDEA_CLAMP,
    cardCount: CARDS.length,
    indicators() {
      if (!run || ui === "title") return null;
      return readIndicators(run.state(), run.log());
    },
    motion: () => motionOn(),
  };
}

render(false);
probeArt().then(() => paintShown());
