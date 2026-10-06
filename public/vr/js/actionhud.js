// In Full Swing: the screen bits of the city action in flat play. The hero's hearts and the energy gauge (bottom left), a prompt
// line (R GET IN, a punch hint), a red glow at the edges when the hero is hit, and on a phone the CAR button and the driving pad
// (left, right, GAS, BRAKE). main reads the phone buttons from touch: { car, left, right, gas, brake } (car is an edge).
const CSS = `
#actHud{position:fixed;left:14px;bottom:14px;z-index:12;pointer-events:none;font-family:var(--comic,"Bangers",Impact,"Arial Black",sans-serif);color:#140a18}
#actHud[hidden]{display:none}
#actHud .hearts{display:flex;gap:3px;font-size:26px;line-height:1;color:#e8402a;text-shadow:2px 2px 0 #140a18,-1px -1px 0 #140a18,1px -1px 0 #140a18,-1px 1px 0 #140a18}
#actHud .hearts .off{color:#5a4a5e}
#actHud .energy{margin-top:6px;width:150px;height:14px;border:3px solid #140a18;background:#fffdf5;box-shadow:3px 3px 0 #140a18;overflow:hidden}
#actHud .energy i{display:block;height:100%;width:100%;background:#ffd84a;transform-origin:left center;transition:background .2s}
#actHud .energy.low i{background:#e8402a}
#actHud .energy[hidden]{display:none}
#actPrompt{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:6px 16px 3px;background:#ffd84a;border:3px solid #140a18;box-shadow:4px 4px 0 #140a18;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:24px;letter-spacing:.05em;color:#140a18;white-space:nowrap}
#actPrompt[hidden]{display:none}
#actPrompt b{display:inline-block;min-width:1.2em;margin-right:8px;padding:0 6px;background:#fffdf5;border:2px solid #140a18;text-align:center}
#actHit{position:fixed;inset:0;z-index:11;pointer-events:none;opacity:0;box-shadow:inset 0 0 120px 30px rgba(232,40,30,.85);transition:opacity .35s}
#actTouch{position:fixed;inset:0;z-index:13;pointer-events:none}
#actTouch button{pointer-events:auto;position:absolute;width:74px;height:74px;border:4px solid #140a18;border-radius:50%;background:#fffdf5;box-shadow:4px 4px 0 #140a18;font-family:var(--comic,"Bangers",Impact,sans-serif);font-size:20px;color:#140a18;touch-action:none;user-select:none;-webkit-user-select:none}
#actTouch button[hidden]{display:none}
#actTouch button.on{background:#ffd84a}
#actTouch .car{right:18px;top:42%;background:#5ec2e8}
#actTouch .left{left:18px;bottom:22px}#actTouch .right{left:104px;bottom:22px}
#actTouch .gas{right:18px;bottom:22px;background:#7fdc5a}#actTouch .brake{right:104px;bottom:22px;background:#e8806a}
body.cutscene #actHud,body.cutscene #actPrompt,body.cutscene #actTouch{visibility:hidden}
`;

export function createActionHud() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const hud = document.createElement("div");
  hud.id = "actHud"; hud.hidden = true;
  hud.innerHTML = '<div class="hearts"></div><div class="energy" hidden><i></i></div>';
  const prompt = document.createElement("div");
  prompt.id = "actPrompt"; prompt.hidden = true;
  const hit = document.createElement("div");
  hit.id = "actHit";
  const touchEl = document.createElement("div");
  touchEl.id = "actTouch";
  const btn = (k, label) => { const b = document.createElement("button"); b.className = k; b.textContent = label; b.hidden = true; b.type = "button"; touchEl.appendChild(b); return b; };
  const B = { car: btn("car", "CAR"), left: btn("left", "◀"), right: btn("right", "▶"), gas: btn("gas", "GAS"), brake: btn("brake", "BRAKE") };
  document.body.append(hud, prompt, hit, touchEl);
  const hearts = hud.querySelector(".hearts"), energy = hud.querySelector(".energy"), bar = energy.querySelector("i");
  const touch = { car: false, left: false, right: false, gas: false, brake: false };
  for (const k of ["left", "right", "gas", "brake"]) {
    const b = B[k];
    const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle("on", v); };
    b.addEventListener("pointerdown", on(true)); b.addEventListener("pointerup", on(false)); b.addEventListener("pointercancel", on(false)); b.addEventListener("pointerleave", on(false));
  }
  B.car.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.car = true; });
  let shown = { hp: -1, max: -1, e: -2, p: "" }, hitT = 0;
  const H = {
    touch,
    // s: { on, hp, max, energy (0..1, or < 0 to hide), prompt (html or ""), phone, nearCar, driving }
    update(dt, s) {
      hud.hidden = !s.on;
      if (!s.on) { prompt.hidden = true; for (const k in B) B[k].hidden = true; return; }
      const hp = Math.ceil(s.hp - 1e-6);
      if (hp !== shown.hp || s.max !== shown.max) {
        shown.hp = hp; shown.max = s.max;
        hearts.textContent = "";
        for (let i = 0; i < s.max; i++) { const h = document.createElement("span"); h.textContent = "♥"; if (i >= hp) h.className = "off"; hearts.appendChild(h); }
      }
      const e = s.energy < 0 ? -1 : Math.round(s.energy * 50) / 50;
      if (e !== shown.e) {
        shown.e = e;
        energy.hidden = e < 0;
        if (e >= 0) { bar.style.transform = "scaleX(" + e + ")"; energy.classList.toggle("low", e < 0.25); }
      }
      if (s.prompt !== shown.p) { shown.p = s.prompt; prompt.hidden = !s.prompt; prompt.innerHTML = s.prompt || ""; }
      B.car.hidden = !(s.phone && (s.nearCar || s.driving));
      B.car.textContent = s.driving ? "OUT" : "CAR";
      for (const k of ["left", "right", "gas", "brake"]) { B[k].hidden = !(s.phone && s.driving); if (B[k].hidden && touch[k]) { touch[k] = false; B[k].classList.remove("on"); } }
      if (hitT > 0) { hitT -= dt; if (hitT <= 0) hit.style.opacity = "0"; }
    },
    // read and clear the CAR press
    takeCar() { const v = touch.car; touch.car = false; return v; },
    flash() { hit.style.opacity = "1"; hitT = 0.25; },
    info: () => ({ hidden: hud.hidden, hearts: shown.hp, energy: shown.e, prompt: prompt.hidden ? "" : prompt.textContent, car: !B.car.hidden, drive: !B.gas.hidden }),
  };
  return H;
}
