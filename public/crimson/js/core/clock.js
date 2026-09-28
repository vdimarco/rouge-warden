// js/core/clock.js : game-time timers, tick-driven coroutines, and the story day clock. No setTimeout in flow.
// Everything here moves only when its owner ticks it, so __crimson.step() drives it exactly.
// Times compare with a microsecond of slack, so after(2.0) fires on tick 120 of 1/60 s steps even
// though the float sum of the steps lands a hair under 2.0.
const EPS = 1e-6;
export function createTimers() {
  let now = 0, seq = 0; const list = [];
  return {
    get now() { return now; },
    after(sec, fn, tag = '') { const id = ++seq; list.push({ id, at: now + Math.max(0, sec), fn, tag, every: 0 }); return id; },
    every(sec, fn, tag = '') { const id = ++seq; list.push({ id, at: now + sec, fn, tag, every: sec }); return id; },
    cancel(id) { const i = list.findIndex((t) => t.id === id); if (i >= 0) list.splice(i, 1); },
    cancelTag(tag) { for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === tag) list.splice(i, 1); },
    has(id) { return list.some((t) => t.id === id); },
    clear() { list.length = 0; },
    get count() { return list.length; },
    tick(dt) {
      now += dt;
      for (let g = 0; g < 1000; g++) {
        let k = -1;
        for (let i = 0; i < list.length; i++) if (list[i].at <= now + EPS && (k < 0 || list[i].at < list[k].at || (list[i].at === list[k].at && list[i].id < list[k].id))) k = i;
        if (k < 0) break;
        const t = list[k]; if (t.every > 0) t.at += t.every; else list.splice(k, 1); t.fn();
      }
    },
  };
}

// Coroutines: generator functions that yield what they wait for.
// yield sec (story seconds) | yield () => bool | yield handle ({done}) | yield null (one tick)
// A handle with an error (a child task that threw) throws that error into the waiting parent, so a
// failure climbs up to the root task instead of hanging. onError(task, error, { waited }) hears every
// task that ends with an error it did not catch; waited is true when a live task yielded this task's
// handle, so that parent gets the error next.
export function createCo(timers, { onError = null } = {}) {
  const tasks = []; let seq = 0;
  const ready = (t) => { const w = t.wait; if (w == null) return true; if (typeof w === 'number') return timers.now + EPS >= t.until; if (typeof w === 'function') return !!w(); if (typeof w === 'object' && 'done' in w) return !!w.done; return true; };
  const resume = (t, v, err) => {
    try {
      const r = err ? t.gen.throw(err) : t.gen.next(v);
      if (r.done) { t.done = true; t.result = r.value; return; }
      t.wait = r.value; if (typeof r.value === 'number') t.until = timers.now + r.value;
    } catch (e) {
      t.done = true; t.error = e; console.error('[co]', t.name, e);
      if (onError) onError(t, e, { waited: tasks.some((x) => x !== t && !x.done && x.wait === t) });
    }
  };
  return {
    start(gen, name = 'task') {
      const t = { id: ++seq, name, gen, wait: null, until: 0, done: false, result: undefined, error: null, cancelled: false, cancel() { if (!t.done) { t.done = true; t.cancelled = true; try { t.gen.return(); } catch (e) { /* a finally block threw */ } } } };
      tasks.push(t); resume(t); return t;
    },
    tick() {
      // only the tasks that existed when the tick began: a task started now waits for the next tick
      const n = tasks.length;
      for (let i = 0; i < n; i++) {
        const t = tasks[i];
        if (t.done || !ready(t)) continue;
        const w = t.wait;
        if (w && typeof w === 'object' && w.error && !w.cancelled) resume(t, undefined, w.error);
        else resume(t, w && typeof w === 'object' ? w.result : undefined);
      }
      for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done) tasks.splice(i, 1);
    },
    cancelAll(prefix = '') { for (const t of tasks.slice()) if (t.name.startsWith(prefix)) t.cancel(); },
    get count() { return tasks.length; },
    get list() { return tasks.slice(); },
  };
}

// The story's day clock. 1 real second is `speed` game seconds (60: one game minute). Time-lapse goes
// through S.missions.timeScale (the k argument); nobody writes speed directly.
export const DAYS = ['thu', 'fri', 'sat', 'sun', 'mon', 'tue', 'wed'];
export const toHour = (s) => { const [h, m] = String(s).split(':').map(Number); return h + (m || 0) / 60; };
export function createDay() {
  const D = { day: 'sun', hour: 3, speed: 60, frozen: false,
    set(day, hhmm) { if (day) D.day = day; if (hhmm != null) D.hour = typeof hhmm === 'number' ? hhmm : toHour(hhmm); },
    advance(rdt, k = 1) { if (D.frozen) return; D.hour += rdt * D.speed * k / 3600; while (D.hour >= 24) { D.hour -= 24; D.day = DAYS[(DAYS.indexOf(D.day) + 1) % 7]; } },
    get night() { return D.hour >= 19.75 || D.hour < 5.5; },
    label() { const h = Math.floor(D.hour), m = Math.floor((D.hour - h) * 60), h12 = ((h + 11) % 12) + 1; return `${D.day.toUpperCase()} ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; } };
  return D;
}
