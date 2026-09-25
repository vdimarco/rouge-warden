// The game switcher: every game's menu opens this list to jump straight to another cabinet.
// Usage: <script src="/arcade/switch.js"></script>, then GameSwitch.open("drain") from a menu button.
(() => {
  const GAMES = [
    { id: "plungerd", name: "Get Plunger'd", sub: "Cottage Brawl", url: "/plungerd/", art: "/arcade/plungerd.webp", color: "#e6c35c" },
    { id: "drain", name: "Down the Drain", sub: "Get Plunger'd", url: "/fall/", art: "/arcade/drain.webp", color: "#5fb8d0" },
    { id: "crimson", name: "Crimson Rouge", sub: "紅の月の下で", url: "/crimson/", art: "/crimson/art/keyart2.webp", color: "#d0485f" },
  ];
  const css = `
.gsw { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); background: rgba(5, 6, 10, 0.97); overflow-y: auto; overscroll-behavior: contain; font: 16px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eeeae2; cursor: default; }
.gsw[hidden] { display: none; }
.gsw-card { width: min(760px, 100%); }
.gsw, .gsw * { box-sizing: border-box; }
.gsw h2 { margin: 0 0 4px; font: 800 26px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0.08em; color: #eeeae2; text-transform: none; }
.gsw p { margin: 0 0 14px; color: #a8a498; }
.gsw-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.gsw-game { display: flex; flex-direction: column; text-align: left; padding: 0; border: 2px solid #2c3140; border-radius: 10px; background: #141822; color: inherit; font: inherit; cursor: pointer; overflow: hidden; text-decoration: none; }
.gsw-game:hover, .gsw-game:focus-visible { border-color: var(--c); outline: none; }
.gsw-game img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #0b0e14; }
.gsw-game span { display: block; padding: 8px 12px 10px; }
.gsw-game b { display: block; font-size: 18px; color: var(--c); }
.gsw-game small { color: #a8a498; }
.gsw-game.here { cursor: default; border-style: dashed; }
.gsw-game.here img { opacity: 0.35; }
.gsw-game.here b { color: #a8a498; }
.gsw-game.here small::after { content: " · playing now"; color: #eeeae2; }
.gsw-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.gsw-row a, .gsw-row button { padding: 10px 16px; border-radius: 6px; border: 1px solid #4a5263; background: transparent; color: #eeeae2; font: inherit; cursor: pointer; text-decoration: none; }
.gsw-row a:hover, .gsw-row button:hover { border-color: #eeeae2; }
@media (max-width: 560px) { .gsw-list { grid-template-columns: minmax(0, 1fr); gap: 8px; } .gsw-game { flex-direction: row; align-items: center; } .gsw-game img { width: 42%; flex: none; } .gsw-game b { font-size: 16px; } }`;
  let box = null, here = null;
  function build() {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    box = document.createElement("div");
    box.className = "gsw";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Switch game");
    box.innerHTML = "<div class='gsw-card'><h2>SWITCH GAME</h2><p>Pick a cabinet. Your current run ends.</p><div class='gsw-list'></div><div class='gsw-row'><a href='/'>◀ Back to the arcade</a><button type='button' class='gsw-close'>Keep playing</button></div></div>";
    // keep the game from seeing clicks and keys meant for the switcher
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart", "keydown", "keyup"]) box.addEventListener(ev, (e) => e.stopPropagation());
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector(".gsw-close").onclick = close;
    document.body.appendChild(box);
  }
  function open(current) {
    if (!box) build();
    here = current;
    const list = box.querySelector(".gsw-list");
    list.innerHTML = "";
    for (const g of GAMES) {
      const a = document.createElement("a");
      a.className = "gsw-game" + (g.id === here ? " here" : "");
      a.href = g.id === here ? "#" : g.url;
      a.style.setProperty("--c", g.color);
      a.innerHTML = "<img alt=''><span><b></b><small></small></span>";
      a.querySelector("img").src = g.art;
      a.querySelector("b").textContent = g.name;
      a.querySelector("small").textContent = g.sub;
      if (g.id === here) a.onclick = (e) => { e.preventDefault(); close(); };
      list.appendChild(a);
    }
    box.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    (list.querySelector(".gsw-game:not(.here)") || list.firstChild).focus({ preventScroll: true });
  }
  function close() { if (box) box.hidden = true; }
  window.GameSwitch = { open, close, get isOpen() { return !!box && !box.hidden; }, GAMES };
})();
