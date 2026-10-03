// Tell Me — Indian poker against Bram and Fennel. Plain ES, no dependencies.
// Faces leak the player's card. Chips are play chips only.
//
// Assumptions (also listed on the PR):
// - Tie odd chip goes to the earliest seat in order player, Bram, Fennel.
// - Ante is min(2, stack). Bets and calls cap at the stack and the button shows
//   the real amount, with "(all-in)" when it takes the rest of the stack.
// - No side pots. If the player is all-in, each critter's pot total is capped
//   at the player's contribution. The excess is dropped, not paid out.
// - A call is a correct read only on a sole win. A fold is correct only if the
//   player's rank is strictly worse. A tie is not a read, call or fold.
// - Below 4 reads the rating is "Too few reads". At 4 or more: Sharp is 80%
//   or higher, Good is 60 to 79%, Rookie is under 60%.
// - ?fast=1 skips waits. It does not change the deck, tells, or the log.

const SEATS = ["player", "bram", "fennel"];
const STATES = ["smug", "calm", "nervous", "sweating"];
const SUITS = ["♠", "♥", "♦", "♣"];
const HONESTY = { bram: 0.85, fennel: 0.55 };
const CUE_LIE = { bram: 0.8, fennel: 0.6 };
const CUE_TRUTH = { bram: 0.1, fennel: 0.2 };
const BLUFF = { bram: 0.10, fennel: 0.30 };
const ANTE = 2;
const SMALL = 6;
const BIG = 12;
const T = { think: 900, chips: 300, flickLead: 400, flip: 600, advance: 1500, faceFade: 150 };

const params = new URLSearchParams(location.search);
const FAST = params.get("fast") === "1";
const HONEST = params.get("honest") === "1";

function utcSeed(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
function parseSeed() {
  if (!params.has("seed")) return { seed: utcSeed(), daily: true, bad: false };
  const n = Number(params.get("seed"));
  if (!Number.isFinite(n)) return { seed: utcSeed(), daily: true, bad: true };
  return { seed: n >>> 0, daily: false, bad: false };
}
function parseHands() {
  if (!params.has("hands")) return 10;
  const n = Number(params.get("hands"));
  if (!Number.isInteger(n) || n < 1) return 10;
  return Math.min(n, 50);
}

const { seed, daily, bad } = parseSeed();
const handCount = parseHands();
if (FAST) document.documentElement.classList.add("fast");

function mulberry32(a) {
  a >>>= 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(seed);
let stack = 100;
let handsDone = 0;
let playing = false;

const api = (window.__test = {
  score: 100,
  hands: 0,
  seed,
  reads: { correct: 0, total: 0 },
  log: [],
});

const $ = (sel) => document.querySelector(sel);
const note = $("#note");
const stackEl = $("#stack");
const handEl = $("#handnum");
const dailyEl = $("#daily");
const readsEl = $("#reads");
const startDaily = $("#start-daily");
const potCount = $("#pot-count");
const potChips = $("#pot-chips");
const playerCard = $("#player-card");
const playerFront = playerCard.querySelector(".card-front");
const table = $("#table");
const flash = $("#flash");
const buttons = {};
for (const b of document.querySelectorAll("#actions button")) buttons[b.dataset.act] = b;

const seedLabel = daily ? `Daily UTC #${seed}` : `Seed #${seed}`;
dailyEl.textContent = seedLabel;
startDaily.textContent = seedLabel;
if (bad) {
  const warn = $("#seed-warn");
  warn.hidden = false;
  warn.textContent = "Bad seed, using daily";
}
document.documentElement.dataset.phase = "start";

function wait(ms) {
  return new Promise((r) => setTimeout(r, FAST ? 0 : ms));
}
function setPhase(p) {
  document.documentElement.dataset.phase = p;
}
function say(text) {
  note.textContent = text;
}
function nameOf(who) {
  if (who === "player") return "You";
  return who === "bram" ? "Bram" : "Fennel";
}
function rankLabel(r) {
  return { 11: "J", 12: "Q", 13: "K", 14: "A" }[r] || String(r);
}
function faceForRank(rank) {
  if (rank <= 5) return "smug";
  if (rank <= 9) return "calm";
  if (rank <= 12) return "nervous";
  return "sweating";
}
function sync() {
  api.score = stack;
  api.hands = handsDone;
  api.seed = seed;
}
function renderStatus() {
  stackEl.textContent = `${stack} chips`;
  const ended = document.documentElement.dataset.phase === "end";
  const shown = ended ? handsDone : Math.min(handsDone + 1, handCount);
  handEl.textContent = `Hand ${shown}/${handCount}`;
  readsEl.textContent = `Reads ${api.reads.correct}/${api.reads.total}`;
  sync();
}
function rating(correct, total) {
  if (total < 4) return "Too few reads";
  const pct = correct / total;
  if (pct >= 0.8) return "Sharp";
  if (pct >= 0.6) return "Good";
  return "Rookie";
}

function artUrl(file) {
  return new URL("./assets/" + file, import.meta.url).href;
}

// One probe of the painted pack, then a per-file cache. A miss is not requested again.
const ART = new Map();
let packOk = null;
const packWaiters = [];

function settlePack(ok) {
  if (packOk !== null) return;
  packOk = ok;
  const waiting = packWaiters.splice(0);
  for (const fn of waiting) fn(ok);
  loadSfx();
}
function whenPack(fn) {
  if (packOk !== null) fn(packOk);
  else packWaiters.push(fn);
}
function bindArt(img, url, onDone) {
  const state = ART.get(url);
  if (state === "miss") {
    img.classList.remove("ok");
    if (onDone) onDone(false);
    return;
  }
  if (state === "ok") {
    if (img.getAttribute("src") !== url) img.src = url;
    img.classList.add("ok");
    if (onDone) onDone(true);
    return;
  }
  if (state === "pending") return;
  ART.set(url, "pending");
  const finish = (ok) => {
    if (ART.get(url) !== "pending") return;
    ART.set(url, ok ? "ok" : "miss");
    if (ok) img.classList.add("ok");
    else {
      img.classList.remove("ok");
      img.removeAttribute("src");
    }
    if (onDone) onDone(ok);
  };
  img.addEventListener("load", () => finish(true), { once: true });
  img.addEventListener("error", () => finish(false), { once: true });
  img.src = url;
}
function mountArt() {
  const bg = $("#tablebg");
  bindArt(bg, artUrl("table_bg.webp"), (ok) => {
    settlePack(ok);
    if (!ok) return;
    for (const img of document.querySelectorAll("[data-art]")) {
      bindArt(img, artUrl(img.dataset.art));
    }
    const chips = new Image();
    bindArt(chips, artUrl("chips.webp"), (chipsOk) => {
      if (chipsOk) document.documentElement.classList.add("has-chips");
    });
  });
}

const INK = "#1B1B1B";
const CREAM = "#F3E9D2";
function eye(cx, cy, rx, ry, pr) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${CREAM}" stroke="${INK}" stroke-width="3.5"/>` +
    `<circle class="pupil" cx="${cx}" cy="${cy}" r="${pr}" fill="${INK}"/>`;
}
function brow(d) {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
}
const FACES = {
  smug:
    brow("M14 22 L46 36") + brow("M74 44 L108 40") +
    eye(34, 54, 16, 6, 2.4) + eye(86, 56, 16, 6, 2.4) +
    `<path d="M36 78 Q58 74 86 60" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  calm:
    brow("M16 34 H48") + brow("M72 34 H104") +
    eye(34, 54, 11, 11, 4) + eye(86, 54, 11, 11, 4) +
    `<path d="M50 76 H70" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  nervous:
    brow("M14 46 L48 26") + brow("M72 26 L106 46") +
    eye(34, 54, 14, 14, 2) + eye(86, 54, 14, 14, 2) +
    `<path d="M34 74 Q42 66 50 74 T66 74 T82 74 T90 70" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  sweating:
    brow("M12 42 L44 10") + brow("M76 10 L108 42") +
    eye(34, 52, 16, 16, 3) + eye(86, 52, 16, 16, 3) +
    `<ellipse cx="60" cy="78" rx="16" ry="11" fill="${INK}"/>` +
    `<path d="M6 36 C -6 54, -4 70, 8 74 C 18 70, 16 54, 6 36 Z" fill="${CREAM}" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M112 28 C 100 48, 102 66, 114 72 C 126 66, 124 46, 112 28 Z" fill="${CREAM}" stroke="${INK}" stroke-width="2"/>`,
};

function applyFace(who, state) {
  const crit = document.querySelector(".critter." + who);
  crit.dataset.face = state;
  crit.querySelector(".face-svg").innerHTML = FACES[state];
  const img = crit.querySelector(".face-img");
  img.classList.remove("ok");
  const url = artUrl(`${who}_face_${state}.webp`);
  whenPack((ok) => {
    if (!ok) return;
    const cached = ART.get(url);
    if (cached === "ok") {
      if (img.getAttribute("src") !== url) img.src = url;
      img.classList.add("ok");
      return;
    }
    if (cached === "miss" || cached === "pending") return;
    bindArt(img, url);
  });
  crit.classList.add("showface");
}

function fillCard(el, card) {
  const red = card.suit === 1 || card.suit === 2;
  el.classList.toggle("red", red);
  el.innerHTML = `<span class="rank">${rankLabel(card.rank)}</span><span class="suit">${SUITS[card.suit]}</span>`;
}

function renderPot(contrib) {
  const pot = contrib.player + contrib.bram + contrib.fennel;
  potCount.textContent = String(pot);
  potChips.replaceChildren();
  const n = pot === 0 ? 0 : Math.min(8, Math.max(1, Math.round(pot / 6)));
  for (let i = 0; i < n; i++) {
    const chip = document.createElement("i");
    chip.className = "chip " + (i % 2 ? "red" : "gold");
    potChips.appendChild(chip);
  }
}

function flyChips(who, n, kind) {
  const host = $("#app");
  const origin = host.getBoundingClientRect();
  const from = (who === "player" ? stackEl : document.querySelector(".critter." + who)).getBoundingClientRect();
  const to = $("#pot").getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const chip = document.createElement("i");
    chip.className = "chip fly " + (kind === "big" && i % 2 === 0 ? "red" : "gold");
    chip.style.left = from.left - origin.left + 8 + i * 5 + "px";
    chip.style.top = from.top - origin.top + 6 + "px";
    host.appendChild(chip);
    const left = to.left - origin.left + (i % 4) * 10;
    const top = to.top - origin.top;
    requestAnimationFrame(() => {
      chip.style.left = left + "px";
      chip.style.top = top + "px";
    });
    setTimeout(() => chip.remove(), FAST ? 20 : 340);
  }
}

function clearTable() {
  for (const who of ["bram", "fennel"]) {
    const crit = document.querySelector(".critter." + who);
    crit.classList.remove("showface", "collapse", "out");
    crit.dataset.face = "";
    crit.querySelector(".face-svg").innerHTML = "";
    crit.querySelector(".layer-tail").classList.remove("flick");
    const card = crit.querySelector(".ccard");
    card.className = "ccard";
    card.innerHTML = "";
  }
  playerCard.classList.remove("flipping", "revealed", "folded", "deal");
  playerFront.innerHTML = "";
  playerFront.classList.remove("red");
  table.classList.remove("shake");
  flash.className = "";
}

function equity(playerRank, otherRank) {
  const m = Math.max(playerRank, otherRank);
  let above = 0;
  let equal = 0;
  for (let r = 2; r <= 14; r++) {
    let n = 4;
    if (r === playerRank) n--;
    if (r === otherRank) n--;
    if (r > m) above += n;
    else if (r === m) equal += n;
  }
  return (above + 0.5 * equal) / 50;
}

function drawHand() {
  const deck = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  const take = () => deck.splice(Math.floor(rng() * deck.length), 1)[0];
  const cards = { player: take(), bram: take(), fennel: take() };
  const roll = () => ({ face: rng(), wrong: rng(), cue: rng(), bluff: rng() });
  return { cards, rolls: { bram: roll(), fennel: roll() } };
}

function tellOf(rank, roll, who) {
  const truth = faceForRank(rank);
  const lie = !HONEST && roll.face >= HONESTY[who];
  let face = truth;
  if (lie) {
    const others = STATES.filter((s) => s !== truth);
    face = others[Math.min(2, Math.floor(roll.wrong * 3))];
  }
  const cue = HONEST ? false : roll.cue < (lie ? CUE_LIE[who] : CUE_TRUTH[who]);
  return { face, cue };
}

function critterOpen(who, E, bluffRoll) {
  if (E >= 0.55) return "big";
  if (E >= 0.35) return "small";
  if (bluffRoll < BLUFF[who]) return "small";
  return "check";
}
function critterFace(E, kind) {
  return E >= (kind === "big" ? 0.4 : 0.3) ? "call" : "fold";
}

function choosePlayer(kind, betKind) {
  return new Promise((resolve) => {
    const open = kind === "open";
    const acts = open ? ["check", "small", "big"] : ["call", "fold"];
    for (const act of ["check", "small", "big", "call", "fold"]) {
      const btn = buttons[act];
      btn.hidden = !acts.includes(act);
      btn.disabled = false;
      btn.onclick = null;
    }
    const stakeHtml = (title, amount) => {
      if (amount === stack) return `<span>${title} ${amount} (all-in)</span>`;
      return `<span>${title}</span><small>${amount}</small>`;
    };
    for (const act of ["check", "small", "big", "call", "fold"]) buttons[act].classList.remove("allin");
    buttons.check.innerHTML = "<span>Check</span>";
    const smallN = Math.min(SMALL, stack);
    const bigN = Math.min(BIG, stack);
    buttons.small.innerHTML = stakeHtml("Small", smallN);
    buttons.big.innerHTML = stakeHtml("Big", bigN);
    if (smallN === stack) buttons.small.classList.add("allin");
    if (bigN === stack) buttons.big.classList.add("allin");
    buttons.small.disabled = stack <= 0;
    buttons.big.disabled = stack <= 0;
    const callN = Math.min(betKind === "big" ? BIG : SMALL, stack);
    buttons.call.innerHTML = stakeHtml("Call", callN);
    if (callN === stack) buttons.call.classList.add("allin");
    buttons.fold.innerHTML = "<span>Fold</span>";
    say("Your turn");
    setPhase("act");
    const onClick = (ev) => {
      const btn = ev.currentTarget;
      if (btn.disabled || btn.hidden) return;
      for (const act of acts) {
        buttons[act].disabled = true;
        buttons[act].onclick = null;
      }
      setPhase("resolve");
      const serial = Number(document.documentElement.dataset.serial || 0) + 1;
      document.documentElement.dataset.serial = String(serial);
      sfx("tap");
      resolve(btn.dataset.act);
    };
    for (const act of acts) buttons[act].onclick = onClick;
  });
}

function hideActions() {
  for (const btn of Object.values(buttons)) {
    btn.hidden = true;
    btn.onclick = null;
  }
}

// --- audio: buffers if the files exist, silence if they do not ---
let ctx = null;
let master = null;
let muted = false;
const buffers = {};
let amb = null;
let sfxStarted = false;
const SFX = ["deal", "tap", "bet_small", "bet_big", "call", "fold", "flip", "win", "win_big", "lose", "end", "amb_cabin"];

function loadSfx() {
  if (sfxStarted || !ctx || packOk !== true) return;
  sfxStarted = true;
  for (const name of SFX) {
    fetch(artUrl(name + ".mp3")).then(async (res) => {
      if (!res.ok || !ctx) return;
      try {
        const raw = await res.arrayBuffer();
        buffers[name] = await ctx.decodeAudioData(raw);
        if (name === "amb_cabin") startAmbience();
      } catch (e) { /* missing or undecodable */ }
    }).catch(() => {});
  }
}
function setupAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch (e) {
    return;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  loadSfx();
}
function startAmbience() {
  if (!ctx || !buffers.amb_cabin || amb) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers.amb_cabin;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0.22;
  src.connect(gain);
  gain.connect(master);
  try { src.start(); } catch (e) { return; }
  amb = src;
}
function sfx(name, rate = 1) {
  if (!ctx || !buffers[name] || document.hidden) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  src.connect(master);
  try { src.start(); } catch (e) { /* already running or closed */ }
}
function unlock() {
  if (!ctx) setupAudio();
  if (ctx && ctx.state === "suspended") ctx.resume();
  startAmbience();
}
$("#mute").addEventListener("click", () => {
  muted = !muted;
  $("#mute").setAttribute("aria-pressed", muted ? "true" : "false");
  $("#mute").textContent = muted ? "Muted" : "Sound";
  if (master) master.gain.value = muted ? 0 : 1;
  sfx("tap");
});

function resetGame() {
  rng = mulberry32(seed);
  stack = 100;
  handsDone = 0;
  api.reads.correct = 0;
  api.reads.total = 0;
  api.log.length = 0;
  clearTable();
  renderPot({ player: 0, bram: 0, fennel: 0 });
  setPhase("deal");
  renderStatus();
  say("");
  hideActions();
  $("#end").hidden = true;
  $("#end-extra").textContent = "";
}

async function playHand(h) {
  const drawn = drawHand();
  const cards = drawn.cards;
  const tells = {
    bram: tellOf(cards.player.rank, drawn.rolls.bram, "bram"),
    fennel: tellOf(cards.player.rank, drawn.rolls.fennel, "fennel"),
  };
  const E = {
    bram: equity(cards.player.rank, cards.fennel.rank),
    fennel: equity(cards.player.rank, cards.bram.rank),
  };
  const contrib = { player: 0, bram: 0, fennel: 0 };
  const actions = [];
  const inHand = new Set(SEATS);
  let betKind = null;
  let bettor = null;
  const opened = new Set();
  const responded = new Set();
  const flicked = { bram: false, fennel: false };

  clearTable();
  setPhase("deal");
  renderStatus();
  say("");
  const commit = (who, amount) => {
    if (who === "player") {
      const paid = Math.min(amount, stack);
      stack -= paid;
      contrib.player += paid;
      renderStatus();
      return paid;
    }
    contrib[who] += amount;
    return amount;
  };
  for (const s of SEATS) commit(s, ANTE);
  renderPot(contrib);

  const times = [80, 250, 420];
  const dealOrder = ["fennel", "bram", "player"];
  const pitches = [0.97, 1, 1.03];
  let elapsed = 0;
  for (let i = 0; i < 3; i++) {
    await wait(times[i] - elapsed);
    elapsed = times[i];
    const who = dealOrder[i];
    if (who === "player") {
      playerCard.classList.add("deal");
    } else {
      const el = document.querySelector(".critter." + who + " .ccard");
      fillCard(el, cards[who]);
      el.classList.add("show");
    }
    sfx("deal", pitches[i]);
  }
  await wait(Math.max(0, 700 - elapsed));
  applyFace("bram", tells.bram.face);
  applyFace("fennel", tells.fennel.face);
  await wait(T.faceFade);

  function startFlick(who) {
    const el = document.querySelector(".critter." + who + " .layer-tail");
    el.classList.remove("flick");
    void el.offsetWidth;
    el.classList.add("flick");
    setTimeout(() => el.classList.remove("flick"), FAST ? 30 : 350);
  }
  async function think(who) {
    setPhase("think");
    say(nameOf(who) + "…");
    if (tells[who].cue && !flicked[who]) {
      flicked[who] = true;
      await wait(T.think - T.flickLead);
      startFlick(who);
      await wait(T.flickLead);
    } else {
      await wait(T.think);
    }
  }
  async function applyAct(who, act) {
    const row = { who, act, chips: 0 };
    actions.push(row);
    const you = who === "player";
    if (act === "small" || act === "big") {
      betKind = act;
      bettor = who;
      row.chips = commit(who, act === "big" ? BIG : SMALL);
      say(you ? `You put in ${row.chips}` : `${nameOf(who)} puts in ${row.chips}`);
      sfx(act === "big" ? "bet_big" : "bet_small");
      flyChips(who, act === "big" ? 4 : 2, act);
      renderPot(contrib);
      await wait(T.chips);
    } else if (act === "call") {
      row.chips = commit(who, betKind === "big" ? BIG : SMALL);
      say(you ? "You call" : `${nameOf(who)} calls`);
      sfx("call");
      flyChips(who, betKind === "big" ? 4 : 2, betKind);
      renderPot(contrib);
      await wait(T.chips);
    } else if (act === "fold") {
      inHand.delete(who);
      say(you ? "You fold" : `${nameOf(who)} folds`);
      sfx("fold");
      if (who === "player") playerCard.classList.add("folded");
      else document.querySelector(".critter." + who).classList.add("out");
      await wait(FAST ? 0 : 200);
    } else {
      say(you ? "You check" : `${nameOf(who)} checks`);
      await wait(who === "player" ? 40 : 80);
    }
  }

  const order = [0, 1, 2].map((i) => SEATS[(h + i) % 3]);
  let cursor = 0;
  let guard = 0;
  while (guard++ < 8) {
    let seat = null;
    for (let n = 0; n < 3; n++) {
      const s = order[cursor % 3];
      cursor++;
      if (!inHand.has(s)) continue;
      if (betKind === null) {
        if (!opened.has(s)) { seat = s; break; }
      } else if (s !== bettor && !responded.has(s)) {
        seat = s;
        break;
      }
    }
    if (!seat) break;
    if (betKind === null) {
      let act;
      if (seat === "player") act = await choosePlayer("open", null);
      else {
        act = critterOpen(seat, E[seat], drawn.rolls[seat].bluff);
        await think(seat);
      }
      opened.add(seat);
      await applyAct(seat, act);
    } else {
      let act;
      if (seat === "player") act = await choosePlayer("face", betKind);
      else {
        act = critterFace(E[seat], betKind);
        await think(seat);
      }
      responded.add(seat);
      await applyAct(seat, act);
    }
  }
  hideActions();

  setPhase("show");
  for (const who of ["bram", "fennel"]) document.querySelector(".critter." + who).classList.add("collapse");
  playerCard.classList.remove("folded");
  fillCard(playerFront, cards.player);
  playerCard.classList.add("flipping");
  sfx("flip");
  await wait(T.flip);
  playerCard.classList.add("revealed");

  const still = SEATS.filter((s) => inHand.has(s));
  const best = Math.max(...still.map((s) => cards[s].rank));
  const winners = SEATS.filter((s) => inHand.has(s) && cards[s].rank === best);
  const playerAllIn = stack === 0;
  const inPot = {
    player: contrib.player,
    bram: playerAllIn ? Math.min(contrib.bram, contrib.player) : contrib.bram,
    fennel: playerAllIn ? Math.min(contrib.fennel, contrib.player) : contrib.fennel,
  };
  const pot = inPot.player + inPot.bram + inPot.fennel;
  const payouts = { player: 0, bram: 0, fennel: 0 };
  const base = Math.floor(pot / winners.length);
  let rem = pot - base * winners.length;
  for (const w of winners) {
    payouts[w] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  stack += payouts.player;

  const playerCalled = actions.some((a) => a.who === "player" && a.act === "call");
  const playerFolded = actions.some((a) => a.who === "player" && a.act === "fold");
  const endedTie = winners.length > 1;
  const liveOpps = ["bram", "fennel"].filter((s) => inHand.has(s));
  const bestOpp = liveOpps.length ? Math.max(...liveOpps.map((s) => cards[s].rank)) : null;
  const wouldTie = playerFolded && bestOpp !== null && cards.player.rank === bestOpp;
  let read = null;
  if ((playerCalled || playerFolded) && !endedTie && !wouldTie) {
    if (playerCalled) read = { correct: winners.length === 1 && winners[0] === "player" };
    else read = { correct: bestOpp === null || cards.player.rank < bestOpp };
  }

  const entry = {
    cards: {
      player: { rank: cards.player.rank, suit: cards.player.suit },
      bram: { rank: cards.bram.rank, suit: cards.bram.suit },
      fennel: { rank: cards.fennel.rank, suit: cards.fennel.suit },
    },
    faces: { bram: tells.bram.face, fennel: tells.fennel.face },
    cues: { bram: tells.bram.cue, fennel: tells.fennel.cue },
    actions,
    result: {
      winners,
      pot,
      contrib: { player: contrib.player, bram: contrib.bram, fennel: contrib.fennel },
      payouts,
      stack,
      read,
    },
  };
  api.log.push(entry);
  handsDone++;
  if (read) {
    api.reads.total++;
    if (read.correct) api.reads.correct++;
  }
  renderStatus();
  renderPot(inPot);

  const gained = payouts.player > contrib.player;
  const share = winners.includes("player") && payouts.player > 0;
  flash.className = gained ? "win" : "lose";
  if (winners.length > 1) say("Split pot");
  else if (winners[0] === "player") say("You take the pot");
  else if (playerFolded && read && read.correct) say("Right fold");
  else if (playerFolded && read) say("Wrong fold");
  else if (playerFolded) say("Tie");
  else say(`${nameOf(winners[0])} takes it`);
  if (share && betKind === "big" && winners.length === 1) {
    table.classList.add("shake");
    sfx("win_big");
  } else if (share) {
    table.classList.add("shake");
    sfx("win");
  } else {
    sfx("lose");
  }
  await wait(FAST ? 0 : 400);

  setPhase("between");
  await new Promise((res) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      table.removeEventListener("pointerdown", finish);
      res();
    };
    table.addEventListener("pointerdown", finish);
    setTimeout(finish, FAST ? 0 : T.advance);
  });
}

function showEnd() {
  setPhase("end");
  hideActions();
  const { correct, total } = api.reads;
  const rate = rating(correct, total);
  $("#end-stack").textContent = `${stack} chips`;
  $("#end-reads").textContent = `Reads ${correct}/${total}`;
  $("#end-rate").textContent = rate;
  $("#end-rate").dataset.rate = rate;
  $("#end-hands").textContent = handsDone === 1 ? "1 hand" : `${handsDone} hands`;
  $("#end-extra").textContent = stack === 0 && handsDone < handCount ? "Out of chips" : "";
  $("#end").hidden = false;
  const pitch = rate === "Sharp" ? 1.16 : rate === "Rookie" ? 0.86 : 1;
  sfx("end", pitch);
  renderStatus();
}

async function launch() {
  if (playing) return;
  playing = true;
  $("#start").hidden = true;
  $("#end").hidden = true;
  try {
    for (let h = 0; h < handCount; h++) {
      if (stack <= 0) break;
      await playHand(h);
    }
    showEnd();
  } finally {
    playing = false;
  }
}

$("#start").addEventListener("click", () => {
  unlock();
  launch();
});
$("#again").addEventListener("click", () => {
  sfx("tap");
  resetGame();
  launch();
});

mountArt();
setupAudio();
renderStatus();
renderPot({ player: 0, bram: 0, fennel: 0 });
