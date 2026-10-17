// Ahead of the Light: the tuning table (final.md 19). Every key the table names is in TUNE with its value (the
// critic's where it changed one), TUNE is frozen all the way down, the table's own relations hold (the nines climb,
// launch speeds sit between the floor and the top, one cap and one mass per leg), the spans in RANGES hold, and
// parseOverrides reads ?KEY=value case-insensitively, with or without underscores, for numbers, per-leg lists, spans
// and boss fields, and marks a run unranked. node qa/ahead-of-the-light/tune.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLUG, TUNE, RANGES, KEYS, OPTIONS, parseOverrides, norm } from '../../public/ahead-of-the-light/core/tune.js';

// Every name in section 19, row by row. CENTRE_Y is three keys (portrait, landscape, desktop); "wells" is WELLS.
const KEYS_19 = [
  'F', 'RING_FLOOR', 'RING_FLOOR_PX', 'RING_PUNCH', 'CENTRE_Y_PORTRAIT', 'CENTRE_Y_LANDSCAPE', 'CENTRE_Y_DESKTOP',
  'ETA_RING_TOP', 'SKY_CAP', 'SKY_PUNCH', 'AHEAD_MIN', 'BEHIND_MIN', 'BEHIND_EDGE', 'KB_PHONE', 'KB_DESK', 'TTC_FULL',
  'WING_FROM', 'WING_PITCH', 'WING_OUT',
  'V0', 'V_K', 'V_ETA_CAP', 'LS_SURGE', 'BEAT_R', 'BPM0', 'SPAWN_BEATS', 'GONE_BEATS', 'LAUNCH_BEATS',
  'LAUNCH_BEATS_FIRST',
  'SHIP_HALF', 'GRAZE', 'GRAZE_SOFT', 'SOFT_BEATS', 'HAIR', 'SKIM_BAND', 'RAIL_HALF', 'GAIN', 'GAIN_FAST', 'GAIN_V0',
  'GAIN_V1', 'TURN_MAX', 'TURN_TAU', 'KEY_TURN', 'KEY_RAMP', 'CAM_LAG', 'CAM_MAX', 'CAM_WHIP',
  'LAUNCH_THREAD', 'LAUNCH_PAST', 'LAUNCH_DOCK', 'ETA_MIN', 'ETA_MAX', 'ENGINE', 'DRAG', 'DRAG_GEAR', 'NINES',
  'LS_DROP', 'RIVAL_ETA_MAX', 'KICK', 'KICK_HAIR', 'SKIM', 'KICK_RIVAL', 'HIT_ETA', 'THREAD_ETA', 'PAIR_ETA',
  'CHAIN_TIMEOUT', 'CHAIN_LIT_BONUS',
  'BURN_ETA', 'BURN_S', 'BURN_CAP', 'OBERTH_ETA', 'OBERTH_ANGLE', 'SCOOP_LEG_MAX',
  'FUEL0', 'FUEL_CAP', 'FUEL_CAP_MAX', 'FUEL_PER_LEG', 'SPILL', 'TAKEDOWN_FUEL', 'SKIP_FUEL', 'PICK_DEG',
  'HULL0', 'HULL_MAX', 'HULL_CAP', 'SHIELD_MAX', 'SHIELD_T', 'FLICKER', 'HITSTOP', 'STUMBLE', 'STUMBLE_S', 'SOFT_S',
  'BUMP', 'PATCH_AT', 'PATCH_LOOK',
  'GAP0', 'GAP_CAP', 'MASS_K', 'BLEED', 'PB_GRAZE', 'PB_HAIR', 'PB_SKIM', 'PB_RIVAL', 'PB_WHIP', 'PB_PAIR',
  'PB_TAKEDOWN', 'PB_THREAD', 'PB_DOCK', 'PB_PAST', 'OVERCAP', 'OVERCAP_DECAY', 'STUMBLE_FLOOR_TTC', 'TTC_LABEL',
  'TTC_WARN', 'TTC_REARM', 'GLARE_IN', 'GLARE_OUT', 'GLARE_PEAK_S', 'BREATHER_S', 'GLARE_ALPHA', 'HEART_BPM', 'EASY_X',
  'WELLS', 'PULL', 'PULL_S', 'WIN_EARLY', 'WIN_LATE', 'GRAB_COST', 'LATCH_S', 'CANCEL_PX', 'SWEEP0', 'SWEEP1',
  'SWEEP_A', 'WORLD_SLOW', 'EXIT_W', 'PERFECT', 'LIFT_COMP', 'LAND_GRACE', 'AIM', 'GAIN_BASE', 'GAIN_DEPTH',
  'RED_SPAN', 'RED_X', 'WHIP_GAIN_X', 'SCORCH_WARN', 'LETGO_LEAD', 'LETGO_MIN', 'WAKE_START', 'TEACH_SWEEP',
  'TEACH_WIN',
  'WAKE_NEAR', 'WAKE_FAR', 'WAKE_HALF', 'SUCTION', 'DRAFT_FILL', 'DRAFT_KEEP', 'TOW', 'PULL_OUT', 'SLING_ETA',
  'SLING_MIN', 'SLING_SURGE', 'SLING_S',
  'CONTACT_Z', 'SHOVE0', 'SHOVE_K', 'SHOVE_MAX', 'SHOVE_S', 'SHOVE_X', 'SLAM_V', 'BUMP_SHOVE', 'REAR_ETA',
  'REAR_SHOVE', 'TAKEDOWN_S', 'TRAP_S', 'TRAP_GAP', 'LEAN_S',
  'TICK_LEAD', 'OUTLINE_LEAD', 'PREVIEW_LEAD', 'SILHOUETTE', 'ALARM_LEAD',
  'SLOWMO_X', 'HEADLIGHT_SLOW', 'LS_FREEZE', 'LS_WHITE', 'RESUME_SLOW', 'MUSIC_NUDGE',
  'DRAG_PX', 'FLICK_PX', 'FLICK_MS', 'FLICK_SPEED', 'TAP_MS', 'TAP_PX', 'TOP_DEAD', 'SCREEN_UNLOCK',
  'THREAD_DEG0', 'THREAD_STEP', 'DOCK_DEG', 'DOCK_SEP', 'GATE_CALL',
  'FREE_REPAIR', 'REPAIR_S', 'REFUEL_S', 'REFUEL_N', 'TUNE_S', 'TTC_FLOOR', 'CLEAN_BONUS', 'ABANDON_S',
  'LAND_S', 'LAND_PER_NINE', 'LAND_FUEL_MAX', 'DOOR_DEG', 'DOOR_MISS_S',
  'YEARS_PER_S', 'RANKS', 'LEG_BEATS', 'RISK_BEATS', 'RISK_DENSITY', 'VOID_X', 'BELT_X',
  'RARITY', 'PITY_STEP', 'FUSION_FROM', 'LEGEND_FROM', 'LEGEND_N', 'OFFER_N', 'BONUS_N', 'RISK_PICKS', 'REROLLS0',
  'TEACH_RUNS',
  'GRID_GAP', 'LEG1_GAPS', 'DRIFT_START', 'DRIFT_GAP', 'RIVAL_FUEL_MIN', 'TICK', 'CANDIDATES', 'LOOK', 'JITTER_HOLD',
  'HOOK_LEAD', 'FLEE_IN', 'FLEE_OUT', 'CONSERVE_AHEAD', 'GAMBLE_BEHIND', 'SLING_CHARGE', 'SLING_GAP', 'SLING_CLEAR',
  'BLOCK_REACT', 'BLOCK_RATE', 'BLOCK_HOLD', 'BLOCK_CD', 'FED_WINDOW', 'NEM_RAMS', 'NEM_YOUR_RAMS', 'NEM_RANGE',
  'NEM_RAM_BIAS',
  'WHALE', 'MAKO', 'MANTA',
  'BARK_GAP', 'BARK_QUIET', 'BARK_DROP', 'BARK_CHARS', 'BARK_START',
];

// Keys this build added to the table (each logged in race/contract.md).
const ADDED = ['PUNCH_S', 'ETA0', 'SCOOP_LIFTER_MAX', 'FULL_TANK_SHIELD', 'CAP_OVERFLOW_SHIELD', 'QUIT_GAP',
  'RIVAL_GAP0', 'RIVAL_HIT_ETA', 'RIVAL_STUMBLE'];

test('the slug prefixes the save keys', () => {
  assert.equal(SLUG, 'ahead-of-the-light');
});

test('every key of section 19 is in TUNE, and nothing else but the logged additions', () => {
  for (const k of KEYS_19) assert.ok(k in TUNE, `TUNE.${k} is missing`);
  const extra = Object.keys(TUNE).filter((k) => !KEYS_19.includes(k));
  assert.deepEqual(extra.sort(), [...ADDED].sort());
  for (const k of Object.keys(TUNE)) {
    const v = TUNE[k];
    const ok = (x) => (typeof x === 'number' && Number.isFinite(x)) || (Array.isArray(x) && x.every(ok))
      || (x && typeof x === 'object' && Object.values(x).every(ok));
    assert.ok(ok(v), `TUNE.${k} holds only finite numbers`);
  }
});

test('the values are the table\'s, with the critic\'s changes', () => {
  const want = {
    F: 0.494, RING_FLOOR: 0.30, RING_FLOOR_PX: 112, RING_PUNCH: 0.26, ETA_RING_TOP: 3.8, SKY_CAP: 5.0, SKY_PUNCH: 6.0,
    AHEAD_MIN: 0.20, BEHIND_MIN: 22, BEHIND_EDGE: 12, KB_PHONE: 1.4, KB_DESK: 0.85, TTC_FULL: 300,
    WING_FROM: 8, WING_PITCH: 5, WING_OUT: 7, V0: 1.605, V_K: 0.16, BEAT_R: 0.86, BPM0: 112, CAM_MAX: 240,
    LAUNCH_THREAD: 1.6, LAUNCH_PAST: 1.0, LAUNCH_DOCK: 0.8, HIT_ETA: 0.7, BURN_ETA: 0.4, BURN_CAP: 2.6,
    OBERTH_ETA: 0.8, SCOOP_LEG_MAX: 2, SHIELD_T: 5, STUMBLE: 1.0, STUMBLE_S: 0.4, GAP0: 7, BLEED: 1.0,
    PB_GRAZE: 0.12, PB_HAIR: 0.30, PB_THREAD: 2.0, PB_DOCK: 1.5, PB_PAST: 0.5, STUMBLE_FLOOR_TTC: 2.9,
    TTC_WARN: 6, TTC_REARM: 9, GLARE_IN: 3.0, GLARE_OUT: 4.5, LEAN_S: 0.3, SLAM_V: 200, LAND_S: 3, LAND_PER_NINE: 1,
    LAND_FUEL_MAX: 3, YEARS_PER_S: 0.25, OFFER_N: 3, BONUS_N: 4, RISK_PICKS: 1, TEACH_RUNS: 3, TICK: 0.05,
    BARK_CHARS: 24, GATE_CALL: 12, TTC_FLOOR: 4,
    RIVAL_GAP0: 8, RIVAL_HIT_ETA: 0.4, RIVAL_STUMBLE: 0.4, REPAIR_S: 0.6, REFUEL_S: 0.4, TUNE_S: 0.8,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(TUNE[k], v, k);
  assert.deepEqual(TUNE.NINES, [1.4722, 2.6467, 3.8002, 4.9517]);
  // WP9's tuned values (HIT_ETA 0.5 → 0.7, the masses of legs 2 to 8, RISK_PICKS 2 → 1; race/tuning.md) and the
  // playtest's (race/playtest.md: the caps of legs 2 to 8, SHIELD_T 8 → 5, GAP0 8 → 7, the dock's prices and floor)
  assert.deepEqual(TUNE.GAP_CAP, [8, 3.5, 3, 3, 3, 3, 2.8, 2.8]);
  assert.deepEqual(TUNE.MASS_K, [1.00, 0.70, 0.66, 0.63, 0.61, 0.58, 0.55, 0.51]);
  assert.deepEqual(TUNE.FUEL_PER_LEG, [1, 3, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(TUNE.LEG_BEATS, [96, 120, 128, 136, 144, 152, 160, 128]);
  assert.deepEqual(TUNE.RANKS, [15, 40, 65]);
  assert.deepEqual(TUNE.LEG1_GAPS, [0.6, 1.2, 1.8]);
  assert.deepEqual(TUNE.AIM, [1.5, 1.0, 0.5]);
  assert.deepEqual(TUNE.WELLS.medium, { core: 5, reach: 40, mass: 1.0 });
  assert.deepEqual(TUNE.WELLS.landmark, { core: 9, reach: 50, mass: 2.0 });
  assert.equal(TUNE.WHALE.tow, 1.12);
  assert.equal(TUNE.MAKO.shove, 1.5);
  assert.equal(TUNE.MANTA.startGap, 2);
});

test('TUNE is frozen all the way down', () => {
  assert.ok(Object.isFrozen(TUNE));
  assert.ok(Object.isFrozen(TUNE.GAP_CAP));
  assert.ok(Object.isFrozen(TUNE.RARITY[0]));
  assert.ok(Object.isFrozen(TUNE.WELLS.small));
  assert.throws(() => { 'use strict'; TUNE.GAP0 = 9; });
  assert.throws(() => { TUNE.WHALE.tow = 2; });
});

test('the table\'s own relations hold', () => {
  const T = TUNE;
  for (let i = 1; i < T.NINES.length; i++) assert.ok(T.NINES[i] > T.NINES[i - 1], 'the nines climb');
  // each nine is the rapidity of 0.9, 0.99, 0.999, 0.9999 c
  T.NINES.forEach((n, i) => assert.ok(Math.abs(Math.tanh(n) - (1 - 10 ** -(i + 1))) < 1e-4, `nine ${i + 1}`));
  assert.ok(T.ETA_MIN < T.LAUNCH_DOCK && T.LAUNCH_DOCK < T.LAUNCH_PAST && T.LAUNCH_PAST < T.LAUNCH_THREAD);
  assert.ok(T.LAUNCH_THREAD < T.BURN_CAP && T.BURN_CAP < T.NINES[1], 'burns alone never light HEADLIGHT');
  assert.ok(T.NINES[3] < T.ETA_MAX && T.RIVAL_ETA_MAX < T.NINES[3], 'rivals stop short of LIGHT SPEED');
  for (const k of ['GAP_CAP', 'MASS_K', 'FUEL_PER_LEG', 'LEG_BEATS']) assert.equal(T[k].length, 8, k);
  for (let i = 1; i < 8; i++) {
    assert.ok(T.GAP_CAP[i] <= T.GAP_CAP[i - 1] && T.MASS_K[i] < T.MASS_K[i - 1], 'caps and masses fall toward home');
  }
  assert.ok(T.GAP0 <= T.GAP_CAP[0] && T.RIVAL_GAP0 <= T.GAP_CAP[0], 'a run starts at or under leg 1\'s cap');
  assert.equal(T.LEG_BEATS.reduce((a, b) => a + b, 0), 1064, '1,064 beats in all (11.1)');
  assert.equal(T.RARITY.length, 5);
  for (const row of T.RARITY) assert.equal(row.reduce((a, b) => a + b, 0), 100, `rarity row ${row}`);
  assert.ok(T.TTC_WARN < T.TTC_REARM && T.GLARE_IN < T.GLARE_OUT && T.GLARE_IN < T.TTC_WARN);
  assert.ok(T.STUMBLE_FLOOR_TTC < T.GLARE_IN, 'a hit outside the glare puts you in it, never past it');
  assert.ok(T.WIN_EARLY > 0 && T.WIN_LATE > 0 && T.SWEEP0 < T.SWEEP1);
  assert.ok(T.FUEL0 <= T.FUEL_CAP && T.FUEL_CAP <= T.FUEL_CAP_MAX && T.HULL0 <= T.HULL_MAX && T.HULL_MAX <= T.HULL_CAP);
  assert.ok(T.RANKS[0] < T.RANKS[1] && T.RANKS[1] < T.RANKS[2]);
  const sizes = Object.values(T.WELLS);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(sizes[i].reach > sizes[i - 1].reach && sizes[i].mass > sizes[i - 1].mass, 'wells grow');
  }
});

test('the spans in RANGES hold, and TUNE carries the same pairs', () => {
  assert.deepEqual(Object.keys(RANGES).sort(), ['DRIFT_GAP', 'DRIFT_START', 'HEART_BPM', 'WHALE.bowWave']);
  for (const [k, span] of Object.entries(RANGES)) {
    assert.equal(span.length, 2, k);
    assert.ok(Number.isFinite(span[0]) && Number.isFinite(span[1]) && span[0] < span[1], `${k}: ${span}`);
    const v = k.split('.').reduce((o, p) => o[p], TUNE);
    assert.deepEqual(v, span, k);
  }
  assert.deepEqual(RANGES.HEART_BPM, [60, 140]);
  assert.deepEqual(RANGES.DRIFT_START, [1, 4]);
  assert.deepEqual(RANGES.DRIFT_GAP, [3, 6]);
});

test('URL names are unique once case and underscores are gone, and never clash with the URL options', () => {
  const seen = new Map();
  for (const k of KEYS) {
    const n = k.split('.').map(norm).join('.');
    assert.ok(!seen.has(n), `${k} and ${seen.get(n)} read the same in a URL`);
    seen.set(n, k);
  }
  for (const o of OPTIONS) assert.ok(!seen.has(norm(o)), `option ${o} clashes with a key`);
  assert.ok(KEYS.includes('WELLS.medium.reach') && KEYS.includes('WHALE.tow') && KEYS.includes('GAP_CAP'));
});

test('overrides parse: numbers, any case, with or without underscores', () => {
  const a = parseOverrides('?gapcap=6&HIT_ETA=0.9&hiteta=0.9&ttc_full=200&Sweep1=170');
  assert.deepEqual(a.tune.GAP_CAP, [6, 6, 6, 6, 6, 6, 6, 6]);
  assert.equal(a.tune.HIT_ETA, 0.9);
  assert.equal(a.tune.TTC_FULL, 200);
  assert.equal(a.tune.SWEEP1, 170);
  assert.equal(a.ranked, false);
  assert.deepEqual(Object.keys(a.set).sort(), ['GAP_CAP', 'HIT_ETA', 'SWEEP1', 'TTC_FULL']);
  assert.ok(Object.isFrozen(a.tune) && Object.isFrozen(a.tune.GAP_CAP));
  assert.equal(TUNE.HIT_ETA, 0.7, 'the base table is untouched');
  assert.deepEqual(TUNE.GAP_CAP, [8, 3.5, 3, 3, 3, 3, 2.8, 2.8]);
});

test('overrides parse: per-leg lists, spans, rows and object fields; bad values are ignored', () => {
  const b = parseOverrides('?gap_cap=9,8,7,6,5,4,4,4&heartbpm=70,150&whale.tow=1.3&wells.medium.reach=45'
    + '&rarity=70,30,0;60,35,5;55,35,10;50,35,15;40,40,20');
  assert.deepEqual(b.tune.GAP_CAP, [9, 8, 7, 6, 5, 4, 4, 4]);
  assert.deepEqual(b.tune.HEART_BPM, [70, 150]);
  assert.equal(b.tune.WHALE.tow, 1.3);
  assert.equal(b.tune.WHALE.half, 10, 'the rest of the object is kept');
  assert.equal(b.tune.WELLS.medium.reach, 45);
  assert.deepEqual(b.tune.RARITY[4], [40, 40, 20]);
  assert.equal(b.set['WHALE.tow'], 1.3);
  const bad = parseOverrides('?gapcap=8,7&heartbpm=150,70&hit_eta=fast&ttcfull=&whale.tow=x&nosuchkey=3');
  assert.deepEqual(bad.tune, TUNE, 'nothing changed');
  assert.deepEqual(bad.ignored.sort(), ['gapcap', 'heartbpm', 'hit_eta', 'ttcfull', 'whale.tow'].sort());
  assert.equal(bad.ranked, true, 'ignored values keep the run ranked');
});

test('URL options are read, and only seed and daily keep a run ranked', () => {
  const r = parseOverrides('?seed=KOMAZI&daily=1');
  assert.deepEqual(r.options, { seed: 'KOMAZI', daily: '1' });
  assert.equal(r.ranked, true);
  assert.deepEqual(r.set, {});
  const u = parseOverrides('?Leg=virgo&lane=M87&bot=mid&cam=fixed');
  assert.deepEqual(u.options, { leg: 'virgo', lane: 'M87', bot: 'mid', cam: 'fixed' });
  assert.equal(u.ranked, false);
  assert.equal(parseOverrides(new URLSearchParams('gap0=6')).tune.GAP0, 6, 'a URLSearchParams works');
  assert.equal(parseOverrides({ GAP0: '5' }).tune.GAP0, 5, 'a plain object works');
  assert.deepEqual(parseOverrides('').tune, TUNE);
  assert.deepEqual(parseOverrides().tune, TUNE);
});
