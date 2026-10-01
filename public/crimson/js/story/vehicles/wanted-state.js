export function createWantedState() {
  const state = { heat: 0, stars: 0, dispatch: 0, search: 0, arrest: 0, status: 'clear', crimes: 0 };
  function reset() {
    Object.assign(state, { heat: 0, stars: 0, dispatch: 0, search: 0, arrest: 0, status: 'clear', crimes: 0 });
  }
  function report(fatal = false) {
    if (!state.stars) state.dispatch = 3;
    state.heat = Math.min(10, state.heat + (fatal ? 2 : 1));
    state.stars = Math.min(5, Math.ceil(state.heat / 2));
    state.crimes++;
    state.search = 0;
    state.status = state.dispatch > 0 ? 'dispatch' : 'pursuit';
  }
  function tick(dt, { seen = false, held = false } = {}) {
    if (!state.stars || !(dt > 0)) return null;
    if (state.dispatch > 0) {
      state.dispatch = Math.max(0, state.dispatch - dt);
      if (!state.dispatch) state.status = 'pursuit';
      return null;
    }
    state.status = seen ? 'pursuit' : 'search';
    state.search = seen ? 0 : state.search + dt;
    state.arrest = held ? state.arrest + dt : Math.max(0, state.arrest - dt * 2);
    if (state.arrest >= 6) { reset(); return 'busted'; }
    if (state.search >= 18 + state.stars * 4) { reset(); return 'escaped'; }
    return null;
  }
  return { state, report, tick, reset };
}
