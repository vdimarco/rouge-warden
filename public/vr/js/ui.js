// STUB: ui (replaced by the ui agent)
// A bare UI with the exact API of spec §10: nothing blocks, fades finish at once, the stance is "standing".
// The pause state is only a flag; on a flat screen a small line says how to go back.
export function createUI({ xr }) {
  const fns = { travel: [], skip: [], exit: [], restart: [] };
  let note = null;
  const showNote = (on) => {
    if (typeof document === "undefined") return;
    if (!note) {
      note = document.createElement("div");
      note.id = "stubPause";
      note.style.cssText = "position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:20;padding:10px 16px;border-radius:8px;background:rgba(26,16,32,.85);color:#fff4d8;font:600 16px system-ui,sans-serif;pointer-events:none";
      note.textContent = "Paused. Click or press Esc to play.";
      document.body.appendChild(note);
    }
    note.hidden = !on;
  };
  const U = {
    paused: false,
    update() {},
    blocking: () => false,
    say() {}, sayLine() {}, toast() {},
    fade: () => Promise.resolve(),
    openPause() { U.paused = true; showNote(!(xr && xr.session)); },
    closePause() { U.paused = false; showNote(false); },
    openMap() {},
    onTravel: (fn) => fns.travel.push(fn),
    onSkipTutorial: (fn) => fns.skip.push(fn),
    onExit: (fn) => fns.exit.push(fn),
    onRestart: (fn) => fns.restart.push(fn),
    askStance: () => Promise.resolve("standing"),
    showCredits() {},
    // test hooks (G.test.ui / uiPress)
    info: () => ({ paused: U.paused, panel: U.paused ? "pause" : null, buttons: U.paused ? [{ id: "resume", local: null, world: null }, { id: "exit", local: null, world: null }] : [] }),
    press(id) {
      if (id === "resume") U.closePause();
      else if (id === "exit") { U.closePause(); for (const f of fns.exit) f(); }
      else if (id === "restart") for (const f of fns.restart) f();
    },
  };
  return U;
}
