// The draft board: five bots pick one by one, so the player sees who they fight with and against.
import { HERO_IDENTITIES } from './hero-identities.js';
import { draftValue } from './bot-difficulty.js';

export const HANDLES = ['kelpie77', 'mossbright', 'tidepool_jo', 'brinewolf', 'Lantern_Fish', 'saltmarsh', 'gullwing', 'Nix', 'driftwood_k', 'oarsome', 'Mirelight', 'wavecrest', 'deepcurrent', 'Fen_Witch', 'barnacle_b', 'rook_of_reefs', 'quietkeel', 'Sorrel', 'harborghost', 'lowtide_lu'];
// Hero creation order in the match: player, west ally, east ally, enemies west, middle, east.
export const SLOTS = [
  { team: 0, lane: 1 }, { team: 0, lane: 0 }, { team: 0, lane: 2 },
  { team: 1, lane: 0 }, { team: 1, lane: 1 }, { team: 1, lane: 2 },
];
// A snake order: one teammate, two enemies, you, your last teammate, the last enemy.
export const PICK_ORDER = [1, 4, 3, 0, 2, 5];
const LANE_NAMES = ['West', 'Middle', 'East'];
const NEEDS = [['Bruiser', 'Initiator'], ['Mage'], ['Support'], ['Carry']];

function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const roleOf = identity => NEEDS.findIndex(need => identity.filters.some(f => need.includes(f)));

// Score a candidate for a team: fill a missing role, avoid a repeated combat kit.
function score(candidate, team) {
  const covered = new Set(team.map(roleOf));
  let value = covered.has(roleOf(candidate)) ? 0 : 3;
  if (candidate.filters.some(f => NEEDS.some((need, i) => !covered.has(i) && need.includes(f)))) value += 1;
  if (team.some(t => t.kit === candidate.kit)) value -= 10;
  return value;
}

const ALLY_LINES = [
  (h, lane) => `I'll frontline ${lane}. Locking ${h.name}.`,
  (h, lane) => `${h.name} on ${lane}. I'll burst them down.`,
  (h, lane) => `Got you covered. ${h.name}, support ${lane}.`,
  (h, lane) => `Taking ${h.name}. ${lane} is mine, feed me kills.`,
];

// levels: each team's bot profile id. A profile with draft skill weighs kit strength by lane.
export function draftPlan(playerIdentity, seed = 1, levels = ['ally', 'veteran']) {
  const random = rng(seed >>> 0), taken = new Set([playerIdentity]);
  const handles = [...HANDLES];
  for (let i = handles.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [handles[i], handles[j]] = [handles[j], handles[i]]; }
  const picks = Array(6).fill(null), considered = Array(6).fill(null), chat = Array(6).fill('');
  picks[0] = playerIdentity;
  for (const slot of PICK_ORDER) {
    if (slot === 0) continue;
    const team = SLOTS[slot].team, mates = picks.map((id, i) => id !== null && SLOTS[i].team === team ? HERO_IDENTITIES[id] : null).filter(Boolean);
    const ranked = HERO_IDENTITIES.filter(h => !taken.has(h.id)).map(h => ({ h, value: score(h, mates) + random() * 2.2 + draftValue(levels[team], h.kit, SLOTS[slot].lane) })).sort((a, b) => b.value - a.value);
    const choice = ranked[0].h;
    picks[slot] = choice.id; taken.add(choice.id);
    considered[slot] = [ranked[2]?.h.id, ranked[1]?.h.id].filter(id => id !== undefined);
    if (team === 0) chat[slot] = ALLY_LINES[Math.max(0, roleOf(choice))](choice, LANE_NAMES[SLOTS[slot].lane]);
  }
  const kits = picks.map(id => HERO_IDENTITIES[id].kit);
  return {
    seed, picks, considered, chat,
    handles: picks.map((_, i) => i === 0 ? 'You' : handles[i - 1]),
    lineup: { allies: [kits[1], kits[2]], enemies: [kits[3], kits[4], kits[5]] },
  };
}

const card = (plan, slot) => `<article class="draft-card" data-slot="${slot}" data-state="waiting" data-team="${SLOTS[slot].team}"><div class="draft-art"><img alt="" decoding="async"></div><div class="draft-copy"><small class="draft-handle">${slot === 0 ? 'You' : plan.handles[slot]}</small><strong class="draft-name">Waiting</strong><span class="draft-role">${LANE_NAMES[SLOTS[slot].lane]} lane</span></div><span class="draft-status"></span></article>`;

export function draftHTML(plan) {
  return `<div class="draft-board" role="region" aria-label="Hero draft"><header><span class="draft-kicker">Draft</span><h2 id="draft-title">Heroes are being chosen</h2><span id="draft-step" aria-live="polite"></span></header>
  <div class="draft-teams"><section class="draft-team ally" aria-label="Your team"><h3>Your team</h3>${[0, 1, 2].map(i => card(plan, i)).join('')}</section><div class="draft-vs" aria-hidden="true">VS</div><section class="draft-team enemy" aria-label="Enemy team"><h3>The other shore</h3>${[3, 4, 5].map(i => card(plan, i)).join('')}</section></div>
  <ol id="draft-chat" class="draft-chat" aria-label="Team chat" aria-live="polite"></ol>
  <footer><button id="draft-back" class="row-btn">Back</button><button id="draft-go" class="primary">Lock all · Start</button></footer></div>`;
}

// Animates the plan into `root`. Returns a controller with skip() and cancel().
export function runDraft(root, plan, { sound, reduced = false, onDone, onBack, pace = 1 } = {}) {
  root.innerHTML = draftHTML(plan);
  const timers = new Set(), wait = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms * pace); timers.add(t); };
  let index = 0, finished = false;
  const cardFor = slot => root.querySelector(`[data-slot="${slot}"]`);
  const show = (slot, id, state) => {
    const el = cardFor(slot), h = HERO_IDENTITIES[id], img = el.querySelector('img');
    el.dataset.state = state; el.style.setProperty('--hero-color', h.color);
    img.src = `./art/portraits/${h.slug}-bust.webp`; img.alt = h.name;
    el.querySelector('.draft-name').textContent = h.name;
    el.querySelector('.draft-role').textContent = `${h.filters.join(' · ')} · ${LANE_NAMES[SLOTS[slot].lane]}`;
    el.querySelector('.draft-status').textContent = state === 'locked' ? 'Locked' : 'Picking';
  };
  const say = (slot, text) => {
    if (!text) return;
    const li = document.createElement('li'); li.innerHTML = `<b></b> <span></span>`;
    li.querySelector('b').textContent = `${plan.handles[slot]}:`; li.querySelector('span').textContent = text;
    root.querySelector('#draft-chat').append(li);
  };
  const lock = slot => { show(slot, plan.picks[slot], 'locked'); sound?.draftLock(SLOTS[slot].team); say(slot, plan.chat[slot]); };
  function finish() {
    if (finished) return; finished = true;
    for (const t of timers) clearTimeout(t); timers.clear();
    for (const slot of PICK_ORDER) if (cardFor(slot).dataset.state !== 'locked') lock(slot);
    root.querySelector('#draft-title').textContent = 'The shore awaits';
    root.querySelector('#draft-step').textContent = 'Battle begins';
    root.querySelector('#draft-go').textContent = 'Starting…'; root.querySelector('#draft-go').disabled = true;
    sound?.draftHorn();
    wait(reduced ? 300 : 1300, () => onDone?.(plan));
  }
  function next() {
    if (index >= PICK_ORDER.length) { finish(); return; }
    const slot = PICK_ORDER[index++], team = SLOTS[slot].team;
    root.querySelector('#draft-step').textContent = slot === 0 ? 'Your pick' : `${plan.handles[slot]} is picking for ${team ? 'the enemy' : 'your team'}`;
    if (slot === 0 || reduced) { lock(slot); wait(slot === 0 ? 650 : 450, next); return; }
    const looks = [...plan.considered[slot], plan.picks[slot]];
    looks.forEach((id, i) => wait(i * 330, () => { if (i < looks.length - 1) { show(slot, id, 'picking'); sound?.draftHover(); } else lock(slot); }));
    wait(looks.length * 330 + 420, next);
  }
  root.querySelector('#draft-go').onclick = finish;
  root.querySelector('#draft-back').onclick = () => { cancel(); onBack?.(); };
  function cancel() { finished = true; for (const t of timers) clearTimeout(t); timers.clear(); }
  next();
  return { skip: finish, cancel, get finished() { return finished; } };
}
