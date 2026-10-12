// Anonymous, capture-only match telemetry. Record actions and transitions, never frames,
// pointer coordinates, chat text or identities. The shared tracker controls production hosts.
const INPUTS = new Set(['touch', 'mouse', 'keyboard', 'gamepad', 'unknown']);
const CONTEXT = ['build_id', 'build_sha', 'performance_tier'];
const number = value => Number.isFinite(value) ? value : undefined;
const label = value => typeof value === 'string' ? value.slice(0, 80) : undefined;
const props = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
const player = state => state?.units?.find(unit => unit.id === state.playerId);
const targetInfo = (state, id) => {
  const unit = state?.units?.find(unit => unit.id === id);
  return unit ? props({ target_kind: label(unit.kind), target_team: number(unit.team), target_hero: number(unit.hero) }) : {};
};
const uuid = () => {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch {}
  return `shore-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

/**
 * start() takes the actual match after its difficulty is set. observe() runs after each
 * simulation step. action() records a released cast, tutorial step, rally or Rift Jump.
 * An attempt_id identifies one request: accepted, queued, cancelled or rejected.
 * A queued request is not proof that the spell later completed.
 * load() records started/ready/failed once each. All methods tolerate a missing or failing sink.
 */
export function createShoreTelemetry({
  capture = (event, properties) => globalThis.ArcadeAnalytics?.captureShore?.(event, properties),
  context = () => ({}), makeId = uuid, now = () => Date.now(),
} = {}) {
  let active = null, inputType = 'unknown';
  const loaded = new Set();
  const freshId = () => { try { return makeId(); } catch { return uuid(); } };
  const loadId = freshId();
  function common() {
    let extra = {};
    try { extra = context() || {}; } catch {}
    const width = number(globalThis.innerWidth), height = number(globalThis.innerHeight);
    return props({
      input_type: inputType, viewport_width: width, viewport_height: height,
      orientation: width && height ? width >= height ? 'landscape' : 'portrait' : undefined,
      ...Object.fromEntries(CONTEXT.map(key => [key, label(extra[key])])),
    });
  }
  function send(event, extra = {}, state = active?.state) {
    try {
      const properties = props({ ...extra, ...common(), ...active?.context,
        match_id: active?.id, match_seconds: state ? Math.round((state.time || 0) * 1000) / 1000 : undefined });
      const pending = capture(event, properties);
      pending?.catch?.(() => {});
    } catch {}
  }
  function summary(state) {
    const p = player(state);
    return props({ duration_seconds: number(state?.time), winner: number(state?.winner),
      level: number(p?.level), kills: number(p?.kills), deaths: number(p?.deaths),
      last_hits: number(p?.lastHits), damage: number(state?.stats?.damage),
      structures: number(state?.stats?.towers), hunts: number(state?.stats?.leviathans) });
  }
  function abandon(state = active?.state, { reason = 'navigation' } = {}) {
    if (!active || active.ended || state !== active.state) return;
    active.ended = true;
    send('shore_match_abandoned', { ...summary(state), reason: label(reason) }, state);
  }
  function end(state = active?.state) {
    if (!active || active.ended || state !== active.state || state.winner == null) return;
    active.ended = true;
    send('shore_match_ended', summary(state), state);
  }
  function start(state, meta = {}) {
    end(active?.state);
    abandon(active?.state, { reason: 'restart' });
    const p = player(state);
    inputType = INPUTS.has(meta.input_type) ? meta.input_type : inputType;
    active = { id: freshId(), state, ended: false,
      context: props({ hero_id: number(p?.hero), hero: label(meta.hero),
        difficulty: label(state.difficulty?.[1] || meta.difficulty), build_sha: label(meta.build_sha) }),
      selected: p?.selectedTarget || 0, recall: p?.recall || 0,
      recallCompletedAt: p?.recallCompletedAt, deaths: p?.deaths || 0, phase: state.phase,
      objective: state.objective, hunts: state.stats?.leviathans || 0,
      structures: new Set(state.units.filter(unit => ['tower', 'core'].includes(unit.kind) && unit.hp <= 0).map(unit => unit.id)),
      attempts: new Set(), rejected: new Map(), tutorial: new Set(),
    };
    send('shore_match_started');
    return active.id;
  }
  function observe(state, { selectedTarget } = {}) {
    if (!active || active.ended || state !== active.state) return;
    const p = player(state);
    if (!p) return;
    const selected = selectedTarget ?? p.selectedTarget ?? 0;
    if (selected !== active.selected) {
      send('shore_target_changed', { target_id: selected || null, previous_target_id: active.selected || null,
        outcome: selected ? 'selected' : 'cleared', ...targetInfo(state, selected) });
      active.selected = selected;
    }
    if (p.recall > 0 && active.recall <= 0) send('shore_recall', { outcome: 'started' });
    else if (active.recall > 0 && p.recall <= 0) send('shore_recall', {
      outcome: p.recallCompletedAt !== active.recallCompletedAt ? 'completed' : 'interrupted',
    });
    active.recall = p.recall || 0; active.recallCompletedAt = p.recallCompletedAt;
    if (p.deaths > active.deaths) send('shore_death', { death_number: p.deaths, level: p.level, respawn_seconds: p.respawn });
    active.deaths = p.deaths;
    if (state.phase !== active.phase) {
      send('shore_realm_shift', { realm: state.phase ? 'woods' : 'town' }); active.phase = state.phase;
    }
    for (const unit of state.units) {
      if ((unit.kind !== 'tower' && unit.kind !== 'core') || unit.hp > 0 || active.structures.has(unit.id)) continue;
      active.structures.add(unit.id);
      send('shore_objective_action', props({ outcome: 'destroyed', objective_kind: unit.guardian ? 'guardian' : unit.kind,
        objective_id: unit.id, team: number(unit.team), lane: number(unit.lane), tier: number(unit.tier) }));
    }
    if (state.objective !== active.objective) {
      if (state.objective) send('shore_objective_action', { outcome: 'spawned', objective_kind: 'hunt', objective_id: state.objective });
      else if (active.objective) send('shore_objective_action', { outcome: 'claimed', objective_kind: 'hunt',
        objective_id: active.objective, team: (state.stats?.leviathans || 0) > active.hunts ? 0 : 1 });
      active.objective = state.objective;
    }
    active.hunts = state.stats?.leviathans || 0;
    end(state);
  }
  function action(name, data = {}) {
    if (!active || active.ended) return;
    if (name === 'cast') {
      if (!['accepted', 'queued', 'cancelled', 'rejected'].includes(data.outcome) || !Number.isInteger(data.slot) || data.slot < 0 || data.slot > 3) return;
      const attempt = label(data.attempt_id);
      if (attempt && active.attempts.has(attempt)) return;
      if (attempt) { active.attempts.add(attempt); if (active.attempts.size > 256) active.attempts.delete(active.attempts.values().next().value); }
      // Repeated held/rejected controls are useful once per reason and slot per second.
      if (data.outcome === 'rejected') {
        const key = `${data.slot}:${label(data.reason) || 'unknown'}`, at = now();
        if (at - (active.rejected.get(key) ?? -Infinity) < 1000) return;
        active.rejected.set(key, at);
      }
      send('shore_cast_attempt', props({ slot: data.slot, outcome: data.outcome, reason: label(data.reason), attempt_id: attempt }));
    } else if (name === 'tutorial') {
      const step = label(data.step), outcome = label(data.outcome) || 'completed', key = `${step}:${outcome}`;
      if (!step || active.tutorial.has(key)) return;
      active.tutorial.add(key); send('shore_tutorial_step', { step, outcome });
    } else if (name === 'rally' || name === 'portal') {
      send(name === 'rally' ? 'shore_team_rally' : 'shore_rift_jump', props({ outcome: label(data.outcome) || 'accepted' }));
    }
  }
  function load(outcome, data = {}) {
    if (!['started', 'ready', 'failed'].includes(outcome) || loaded.has(outcome)) return;
    loaded.add(outcome);
    send(`shore_load_${outcome}`, props({ load_id: loadId, elapsed_ms: number(data.elapsed_ms),
      reason: label(data.reason), performance_tier: label(data.performance_tier) }), null);
  }
  return { start, observe, action, end, abandon, load,
    input(type) { if (INPUTS.has(type)) inputType = type; } };
}
