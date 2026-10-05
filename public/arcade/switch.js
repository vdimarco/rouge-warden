// The game switcher: every game's menu opens this list to jump straight to another cabinet.
// Usage: add <script src="/arcade/switch.js"></script> and give any menu button a data-switch attribute.
// The script finds those buttons, works out which game this page is from its URL, and opens the list.
(() => {
  const GAMES = [
    { id: "tidebreak", name: "Shore of the Ancients", sub: "3v3 folklore MOBA", url: "/tidebreak/", art: "/tidebreak/art/shore-ancients-hero.webp", color: "#d2e46d" },
    { id: "brawl", name: "Cottage Brawl", sub: "8-fighter platform battle", url: "/brawl/", art: "/brawl/art/hero-chaos.webp", color: "#ffca51" },
    { id: "worlds", name: "Small Worlds", sub: "Six mobile experiments", url: "/lab/worlds/", art: "/arcade/worlds.webp", color: "#c7e5ac" },
    { id: "plungerd", name: "Get Plunger'd", sub: "Cottage Brawl", url: "/plungerd/", art: "/arcade/plungerd.webp", color: "#e6c35c" },
    { id: "drain", name: "Down the Drain", sub: "Get Plunger'd", url: "/fall/", art: "/arcade/key/drain.webp", color: "#5fb8d0" },
    { id: "crimson", name: "Crimson Rogue", sub: "紅の月の下で", url: "/crimson/", art: "/crimson/art/keyart2.webp", color: "#d0485f" },
    // still in the works on its own branch: its tile shows only once /wild/ is live
    { id: "wild", name: "Breath of the Lake", sub: "Get Plunger'd", url: "/wild/", art: "/arcade/wild.webp", color: "#8fcf7a", probe: true },
    { id: "fish", name: "Reel It In", sub: "Loon Lake", url: "/fish/", art: "/arcade/fish.webp", color: "#ffb04a" },
    { id: "vr", name: "In Full Swing", sub: "Meta Quest VR", url: "/vr/", art: "/arcade/vr.webp", color: "#ff8a3a" },
    { id: "olympus", name: "Olympus", sub: "Last Flame", url: "/olympus/", art: "/arcade/key/olympus.webp", color: "#edc06b" },
    { id: "moonwell", name: "Moonwell", sub: "Endless pinball islands", url: "/moonwell/", art: "/arcade/key/moonwell.webp", color: "#edc779" },
    { id: "primordia", name: "Primordia", sub: "A Lenia arcade", url: "/primordia/", art: "/arcade/key/primordia.webp", color: "#3ff0e0" },
    { id: "breakthrough", name: "Breakthrough", sub: "Climate strategy", url: "/breakthrough2/", art: "/arcade/key/breakthrough.webp", color: "#f0c56a" },
    { id: "follow-suit", name: "Follow Suit", sub: "A card roguelike", url: "/follow-suit/", art: "/arcade/key/follow-suit.webp", color: "#e9c46a" },
    { id: "river-rush", name: "River Rush", sub: "The golden key run", url: "/river-rush/", art: "/arcade/key/river-rush.webp", color: "#f9c65b" },
    // credits: false keeps a game off the end card of Crimson Rogue (the Lab tile covers the four toys)
  // The Lab and the games it lists. A game inside the Lab has a longer address than the Lab, and the longest match wins.
    { id: "lab", name: "The Lab", sub: "Early prototypes and toys", url: "/lab/", art: "/arcade/key/lab.webp", color: "#f0b848" },
    { id: "neon", name: "Neon Ronin", sub: "Gyro sword duels", url: "/neon/", art: "/arcade/neon.webp", color: "#caff54" },
    { id: "echo", name: "Loon Echo", sub: "Rescue the flock", url: "/echo/", art: "/arcade/echo.webp", color: "#9ff2de" },
    { id: "tellme", name: "Tell Me", sub: "A card game with critters", url: "/tellme/", art: "/arcade/tellme.webp", color: "#f4e4bd" },
    { id: "plunge", name: "Take the Plunge", sub: "Dive and fly south", url: "/lab/plunge/", art: "/arcade/plunge.webp", color: "#ffce7e", credits: false },
    { id: "creek", name: "Up the Creek", sub: "Your phone is the paddle", url: "/lab/creek/", art: "/arcade/creek.webp", color: "#92e8ce", credits: false },
    { id: "tilt", name: "Full Tilt", sub: "A pinball voyage", url: "/lab/tilt/", art: "/arcade/tilt.webp", color: "#f5a6e5", credits: false },
    { id: "rules", name: "House Rules", sub: "Build a Down the Drain layer", url: "/lab/rules/", art: "/arcade/rules.webp", color: "#ffd56b", credits: false },
  ];
  // a game marked probe shows only when its page answers
  const live = {};
  for (const g of GAMES) if (g.probe) live[g.id] = fetch(g.url, { method: "HEAD", cache: "no-store" }).then((r) => r.ok, () => false);
  // the longest matching address wins, so /lab/worlds/ is Small Worlds and not The Lab
  const thisGame = () => (GAMES.filter((g) => location.pathname.startsWith(g.url)).sort((a, b) => b.url.length - a.url.length)[0] || {}).id;
  // the arcade look: a dark room, a neon heading, and each game as a small lit screen with its own glow
  const css = `
.gsw { --pink: #ff3fa4; --cyan: #3ff0ff; --gold: #ffcf4a; --ink: #f3ead3; --muted: #9a93b0; --pixel: "Press Start 2P", ui-monospace, monospace; --display: "Bungee", Impact, "Arial Black", sans-serif;
  position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: start center; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; font: 16px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); cursor: default;
  background: radial-gradient(ellipse 90% 50% at 50% 0%, rgba(120, 40, 170, 0.55), transparent 70%), radial-gradient(ellipse 70% 40% at 50% 100%, rgba(63, 240, 255, 0.12), transparent 70%), linear-gradient(#0d0820, #07050f 70%); }
.gsw::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: repeating-linear-gradient(rgba(0, 0, 0, 0.18) 0 1px, transparent 1px 3px); }
.gsw[hidden] { display: none; }
.gsw-card { position: relative; width: min(1040px, 100%); padding-top: 8px; }
.gsw, .gsw * { box-sizing: border-box; }
.gsw h2 { margin: 0; text-align: center; font: 400 clamp(26px, 5.4vw, 48px)/1.1 var(--display); letter-spacing: 0.08em; color: #ffe6f4; text-transform: none;
  text-shadow: 0 0 4px #fff, 0 0 12px var(--pink), 0 0 26px var(--pink), 0 0 48px var(--pink); }
.gsw p { margin: 10px 0 20px; text-align: center; font: 10px/1.6 var(--pixel); letter-spacing: 0.16em; text-transform: uppercase; color: #d6fcff; text-shadow: 0 0 6px var(--cyan), 0 0 14px var(--cyan); }
.gsw-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }
.gsw-game { --c: var(--gold); position: relative; display: flex; flex-direction: column; text-align: left; padding: 8px; border: 0; border-radius: 12px; color: inherit; font: inherit; cursor: pointer; text-decoration: none;
  background: linear-gradient(color-mix(in srgb, var(--c) 22%, #1a1228), #0d0918 70%);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 45%, transparent), inset 0 2px 0 rgba(255, 255, 255, 0.08), 0 6px 0 #05030b, 0 10px 18px rgba(0, 0, 0, 0.5);
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; }
.gsw-game:hover, .gsw-game:focus-visible { outline: none; transform: translateY(-4px);
  box-shadow: inset 0 0 0 2px var(--c), inset 0 2px 0 rgba(255, 255, 255, 0.12), 0 10px 0 #05030b, 0 0 22px color-mix(in srgb, var(--c) 70%, transparent), 0 0 46px color-mix(in srgb, var(--c) 30%, transparent); }
/* the screen: CRT corners, scanlines, a curve of shadow and a glare */
.gsw-scr { position: relative; display: block; aspect-ratio: 16 / 9; border-radius: 10px / 12px; overflow: hidden; background: #000; box-shadow: 0 0 0 3px #05030b, 0 0 0 4px rgba(255, 255, 255, 0.06); }
.gsw-scr img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease-out, filter 0.3s; filter: saturate(0.92) brightness(0.92); }
.gsw-game:hover .gsw-scr img, .gsw-game:focus-visible .gsw-scr img { transform: scale(1.06); filter: none; }
.gsw-scr::before { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: repeating-linear-gradient(rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.6) 100%); }
.gsw-scr::after { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(125deg, rgba(255, 255, 255, 0.16), transparent 38%); }
.gsw-press { position: absolute; z-index: 2; left: 50%; bottom: 8%; transform: translateX(-50%); padding: 4px 7px; white-space: nowrap; font: 8px/1.4 var(--pixel); letter-spacing: 0.08em; color: #fff; background: rgba(0, 0, 0, 0.65); text-shadow: 0 0 6px var(--c); opacity: 0; }
.gsw-game:hover .gsw-press, .gsw-game:focus-visible .gsw-press { opacity: 1; animation: gsw-blink 0.9s infinite steps(1); }
@keyframes gsw-blink { 50% { opacity: 0; } }
.gsw-game .gsw-txt { display: block; padding: 10px 4px 4px; }
.gsw-game b { display: block; font: 400 16px/1.2 var(--display); letter-spacing: 0.02em; color: var(--c); text-shadow: 0 0 10px color-mix(in srgb, var(--c) 55%, transparent); }
.gsw-game small { display: block; margin-top: 6px; font: 8px/1.6 var(--pixel); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.gsw-game.here { cursor: default; }
.gsw-game.here .gsw-scr img { filter: grayscale(0.7) brightness(0.45); }
.gsw-game.here .gsw-scr::after { content: "NOW PLAYING"; display: grid; place-items: center; font: 10px/1 var(--pixel); letter-spacing: 0.1em; color: var(--gold); text-shadow: 0 0 8px var(--gold); background: none; }
.gsw-game.here .gsw-press { display: none; }
/* the list is long, so the exits stay at the bottom of the window while you scroll */
.gsw-row { position: sticky; bottom: calc(-1 * max(16px, env(safe-area-inset-bottom))); z-index: 3; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 22px -16px 0; padding: 12px 16px max(12px, env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(7, 5, 15, 0.96) 30%); }
.gsw-row a, .gsw-row button { min-height: 44px; padding: 12px 16px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(20, 12, 36, 0.9); color: var(--ink); font: 10px/1.4 var(--pixel); letter-spacing: 0.04em; cursor: pointer; text-decoration: none; }
.gsw-row .gsw-close { color: #07050f; background: var(--cyan); border-color: var(--cyan); box-shadow: 0 0 14px rgba(63, 240, 255, 0.45); }
.gsw-row a:hover, .gsw-row button:hover, .gsw-row a:focus-visible, .gsw-row button:focus-visible { outline: none; border-color: #fff; box-shadow: 0 0 16px rgba(255, 255, 255, 0.35); }
@media (max-width: 560px) {
  .gsw-list { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .gsw-game { flex-direction: row; align-items: center; gap: 12px; padding: 6px; }
  .gsw-scr { width: 44%; flex: none; }
  .gsw-game .gsw-txt { padding: 0; min-width: 0; }
  .gsw-game b { font-size: 14px; }
  .gsw p { margin-bottom: 14px; }
  .gsw-row a, .gsw-row button { padding: 12px; font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) { .gsw-game, .gsw-scr img { transition: none; } .gsw-game:hover, .gsw-game:focus-visible { transform: none; } .gsw-game:hover .gsw-press, .gsw-game:focus-visible .gsw-press { animation: none; } }`;
  let box = null, here = null;
  function build() {
    // the arcade fonts; a game page that has them already loads nothing new, and without them the list falls back to system fonts
    if (!document.querySelector("link[href*='Press+Start+2P']")) {
      const ln = document.createElement("link");
      ln.rel = "stylesheet";
      ln.href = "https://fonts.googleapis.com/css2?family=Bungee&family=Press+Start+2P&display=swap";
      document.head.appendChild(ln);
    }
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    box = document.createElement("div");
    box.className = "gsw";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    // on the arcade page itself the list is the ALL GAMES view: no run ends, and there is no arcade to go back to
    const home = location.pathname === "/" || location.pathname === "/index.html";
    box.setAttribute("aria-label", home ? "All games" : "Switch game");
    box.innerHTML = home
      ? "<div class='gsw-card'><h2>ALL GAMES</h2><p>Pick a game to play.</p><div class='gsw-list'></div><div class='gsw-row'><button type='button' class='gsw-close'>◀ Back to the machines</button></div></div>"
      : "<div class='gsw-card'><h2>SWITCH GAME</h2><p>Pick a cabinet. Your current run ends.</p><div class='gsw-list'></div><div class='gsw-row'><a href='/'>◀ Back to the arcade</a><button type='button' class='gsw-close'>Keep playing</button></div></div>";
    // keep the game from seeing clicks and keys meant for the switcher
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart", "keydown", "keyup"]) box.addEventListener(ev, (e) => e.stopPropagation());
    box.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.repeat) close(); }); // a held Esc must not reopen what it closed
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector(".gsw-close").onclick = close;
    // a game that turns its own frame (Reel It In keeps itself upright on the phone) marks a host, so the list turns with it
    (document.querySelector("[data-switch-host]") || document.body).appendChild(box);
  }
  async function open(current) {
    if (!box) build();
    here = current || thisGame();
    const shown = [];
    for (const g of GAMES) if (!g.probe || g.id === here || (await live[g.id])) shown.push(g);
    const list = box.querySelector(".gsw-list");
    list.innerHTML = "";
    for (const g of shown) {
      const a = document.createElement("a");
      a.className = "gsw-game" + (g.id === here ? " here" : "");
      a.href = g.id === here ? "#" : g.url;
      a.style.setProperty("--c", g.color);
      a.innerHTML = "<span class='gsw-scr'><img alt=''><span class='gsw-press'>PRESS START</span></span><span class='gsw-txt'><b></b><small></small></span>";
      const img = a.querySelector("img");
      img.loading = "lazy";
      img.src = g.art;
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
  // wire every [data-switch] button; the button's own clicks and keys must not reach the game (no fight starts, no pause resumes)
  function wire() {
    for (const b of document.querySelectorAll("[data-switch]")) {
      if (b.dataset.switchWired) continue;
      b.dataset.switchWired = "1";
      for (const ev of ["pointerdown", "mousedown", "touchstart", "keydown"]) b.addEventListener(ev, (e) => { if (ev !== "keydown" || e.key === "Enter" || e.key === " ") e.stopPropagation(); });
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); open(); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  window.GameSwitch = { open, close, wire, get isOpen() { return !!box && !box.hidden; }, GAMES };
})();

