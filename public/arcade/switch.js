// The game switcher: every game's menu opens this list to jump straight to another cabinet.
// Usage: add <script src="/arcade/switch.js"></script> and give any menu button a data-switch attribute.
// The script finds those buttons, works out which game this page is from its URL, and opens the list.
(() => {
  const GAMES = [
    { id: "ascii-front", name: "ASCII Front", sub: "ASCII tank roguelite", url: "/ascii-front/", art: "/ascii-front/key.svg", color: "#d2f584" },
    { id: "battle-tanks", name: "Battle Tanks", sub: "Flank · bombard · extract", url: "/battle-tanks/", art: "/battle-tanks/key.svg", color: "#8df6d5" },
    { id: "afterlight", name: "Afterlight", sub: "One journey · six changing worlds", url: "/afterlight/", art: "/arcade/key/firefly-courier.svg", color: "#b6e5ce" },
    {"id": "lighthouse-keeper", "name": "Lighthouse Keeper", "sub": "Guide boats through the fog", "url": "/lighthouse-keeper/", "art": "/arcade/key/lighthouse-keeper.svg", "color": "#bdd5eb"},
    {"id": "echoes-under-ice", "name": "Echoes Under Ice", "sub": "Recover the fjord’s lost bells", "url": "/echoes-under-ice/", "art": "/arcade/key/echoes-under-ice.svg", "color": "#b6e5ce"},
    {"id": "last-train-home", "name": "Last Train Home", "sub": "Follow reflections before departure", "url": "/last-train-home/", "art": "/arcade/key/last-train-home.svg", "color": "#ff85b5"},
    {"id": "firefly-courier", "name": "Firefly Courier", "sub": "Carry a little light through the forest", "url": "/firefly-courier/", "art": "/arcade/key/firefly-courier.svg", "color": "#f2c97e"},
    {"id": "mirage-runner", "name": "Mirage Runner", "sub": "Sail the dunes beneath the stars", "url": "/mirage-runner/", "art": "/arcade/key/mirage-runner.svg", "color": "#f5c98e"},
    {"id": "orbital-gardener", "name": "Orbital Gardener", "sub": "Grow a garden under Earthrise", "url": "/orbital-gardener/", "art": "/arcade/key/orbital-gardener.svg", "color": "#a8d3f6"},
    { id: "last-light", name: "Last Light", sub: "An ASCII sailing adventure", url: "/last-light/", art: "/last-light/art/sunset.svg", color: "#ffcd62" },
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
    { id: "river-rush", name: "River Rush", sub: "Three wild rivers", url: "/river-rush/", art: "/arcade/key/river-rush.webp", color: "#f9c65b" },
    // credits: false keeps a game off the end card of Crimson Rogue (the Lab tile covers the four toys)
  // The Lab and the games it lists. A game inside the Lab has a longer address than the Lab, and the longest match wins.
    { id: "lab", name: "The Lab", sub: "Early prototypes and toys", url: "/lab/", art: "/arcade/key/lab.webp", color: "#f0b848" },
    { id: "neon", name: "Neon Ronin", sub: "Gyro sword duels", url: "/neon/", art: "/arcade/key/neon.webp", color: "#caff54" },
    { id: "echo", name: "Loon Echo", sub: "Rescue the flock", url: "/echo/", art: "/arcade/echo.webp", color: "#9ff2de" },
    { id: "tellme", name: "Tell Me", sub: "A card game with critters", url: "/tellme/", art: "/arcade/tellme.webp", color: "#f4e4bd" },
    { id: "plunge", name: "Take the Plunge", sub: "Dive and fly south", url: "/lab/plunge/", art: "/arcade/plunge.webp", color: "#ffce7e", credits: false },
    { id: "creek", name: "Up the Creek", sub: "Your phone is the paddle", url: "/lab/creek/", art: "/arcade/creek.webp", color: "#92e8ce", credits: false },
    { id: "tilt", name: "Full Tilt", sub: "A pinball voyage", url: "/lab/tilt/", art: "/arcade/tilt.webp", color: "#f5a6e5", credits: false },
    { id: "rules", name: "House Rules", sub: "Build a Down the Drain layer", url: "/lab/rules/", art: "/arcade/rules.webp", color: "#ffd56b", credits: false },
  ];
  const home = location.pathname === "/" || location.pathname === "/index.html";
  const readPlays = () => { try { const v = JSON.parse(localStorage.getItem('cottage-plays') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
  const count = id => { const n = readPlays()[id]; return Number.isSafeInteger(n) && n > 0 ? n : 0; };
  function record(id) { if (!GAMES.some(g => g.id === id)) return; try { localStorage.setItem('cottage-plays', JSON.stringify({...readPlays(), [id]: Math.min(count(id) + 1, 1000000)})); } catch {} }
  // a game marked probe shows only when its page answers
  const live = {};
  for (const g of GAMES) if (g.probe) live[g.id] = fetch(g.url, { method: "HEAD", cache: "no-store" }).then((r) => r.ok, () => false);
  // the longest matching address wins, so /lab/worlds/ is Small Worlds and not The Lab
  const thisGame = () => (GAMES.filter((g) => location.pathname.startsWith(g.url)).sort((a, b) => b.url.length - a.url.length)[0] || {}).id;
  // the arcade look: a dark room, a neon heading, and each game as a small lit screen with its own glow
  const css = `.board-launch{color:inherit;text-decoration:none;display:block;}.board-detail{display:block;color:#aeb8c4;font:12px/1.6 system-ui;margin-top:10px;}.board-like{align-self:flex-start;margin:10px 4px 4px;background:#201126;border:1px solid #80516b;border-radius:5px;padding:10px 14px;min-height:44px;color:#ffb1d4;font:10px var(--pixel);cursor:pointer;}.board-like:disabled{opacity:.55;cursor:default;}.board-sort{display:flex;flex-wrap:wrap;gap:8px;}.board-sort button,.board-refresh{min-height:44px;border:1px solid #3a4658;background:#101622;border-radius:5px;padding:10px 16px;color:#bccad4;font:14px system-ui;cursor:pointer;}.board-sort button[aria-pressed="true"]{background:#ffcf4a;color:#191006;border-color:#ffcf4a;}.board-live{display:flex;justify-content:space-between;align-items:center;gap:15px;margin:16px 0 8px;font:13px/1.5 system-ui;color:#aeb8c4;}.board-definitions{margin:0 0 28px;font:13px/1.7 system-ui;color:#aeb8c4;}.board-definitions summary{cursor:pointer;color:#6df7e5;}.board-definitions div{max-width:850px;padding-top:10px;}.board-launch:focus-visible,.board-like:focus-visible,.board-sort button:focus-visible,.board-refresh:focus-visible{outline:2px solid #6df7e5;outline-offset:4px;}
.gsw.scoreboard { background: radial-gradient(ellipse at 15% 0%,#311740,transparent 55%),radial-gradient(ellipse at 100% 30%,#07333e,transparent 55%),#080b13; }
.scoreboard .gsw-card { width:min(1240px,100%); }
.board-head { display:flex;align-items:center;justify-content:space-between;gap:18px;margin:12px 0 44px; }
.board-kicker {font:11px/1.6 var(--pixel);color:#9db2b8;}
.room-link {color:#071017;background:#6df7e5;text-decoration:none;border-radius:5px;padding:15px;font:11px/1.5 var(--pixel);box-shadow:0 0 25px #6df7e533;}
.gsw.scoreboard h2 {text-align:left;font-size:clamp(32px,5.5vw,72px);letter-spacing:-.03em;max-width:850px;text-shadow:0 0 30px #ff3fa455;}
.scoreboard .board-tag {text-align:left;font:18px/1.5 system-ui;letter-spacing:0;color:#b8a6bf;text-shadow:none;text-transform:none;}
.board-stats {display:flex;gap:50px;padding:22px 0 30px;border-bottom:1px solid #ffffff22;margin-bottom:28px;}
.board-stats strong {display:block;font:32px/1.4 var(--display);color:#ffcf4a;}.board-stats span {font:9px/1.8 var(--pixel);color:#9fb0bf;}
.board-tools {display:flex;justify-content:space-between;gap:20px;align-items:center;margin:28px 0 20px;}.board-tools h3 {font:20px var(--display);margin:0 0 5px;}.board-tools span {font:13px system-ui;color:#aeb8c4;}.board-tools label {font:8px/1.8 var(--pixel);color:#9fb0bf;}.board-tools input {display:block;width:240px;max-width:100%;background:#101622;color:white;border:1px solid #3a4658;border-radius:5px;padding:12px;font:15px system-ui;}
.scoreboard .gsw-list {grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;}.scoreboard .gsw-game {padding:10px;min-width:0;border-radius:7px;}.scoreboard .gsw-game[hidden] {display:none;}.board-rank {position:absolute;z-index:3;top:18px;left:18px;background:#0a0a14dd;color:#fff;font:15px var(--pixel);padding:10px;border:1px solid #ffffff55;}.scoreboard .gsw-game[data-rank="1"] .board-rank {background:#ffcf4a;color:#191006;}.scoreboard .gsw-game[data-rank="2"] .board-rank {background:#c6d8e5;color:#101723;}.scoreboard .gsw-game[data-rank="3"] .board-rank {background:#d99a6f;color:#28140c;}.board-plays {display:block;color:#6df7e5;font:10px var(--pixel);padding-top:16px;}.scoreboard .gsw-game b {font-size:20px;}.scoreboard .gsw-game small {min-height:28px;}.scoreboard .gsw-game:is([data-rank="1"],[data-rank="2"],[data-rank="3"]) {margin-bottom:12px;box-shadow:inset 0 0 0 1px var(--c),0 0 28px #ffcf4a11;}.scoreboard .gsw-row {justify-content:space-between;}
@media(max-width:700px){.board-head{margin-bottom:24px;align-items:flex-start;}.board-kicker{font-size:8px;}.room-link{font-size:8px;padding:10px;}.board-stats{gap:20px;}.board-stats strong{font-size:26px;}.board-stats span{font-size:7px;}.board-tools{align-items:flex-start;flex-direction:column;}.board-tools label,.board-tools input{width:100%;}.scoreboard .gsw-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.scoreboard .gsw-game{flex-direction:column;align-items:stretch;gap:0;padding:7px;}.scoreboard .gsw-scr{width:100%;}.scoreboard .gsw-txt{padding:12px 3px 6px;}.scoreboard .gsw-game b{font-size:15px;}.scoreboard .gsw-game small{font:8px/1.6 system-ui;}.board-rank{font-size:10px;top:12px;left:12px;padding:6px;}.board-plays{font-size:8px;}.scoreboard .gsw-row a,.scoreboard .gsw-row button{font-size:8px;}}

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
@media (prefers-reduced-motion: reduce) { .gsw-game, .gsw-scr img { transition: none; } .gsw-game:hover, .gsw-game:focus-visible { transform: none; } .gsw-game:hover .gsw-press, .gsw-game:focus-visible .gsw-press { animation: none; } }
/* The catalog is the first screen. Keep navigation floating over the cabinets. */
.gsw.scoreboard{padding:10px 16px 24px;}.scoreboard .gsw-card{padding-top:0;}.scoreboard .board-head{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;margin:0;padding:8px 12px;border:1px solid #ffffff26;border-radius:12px;background:#0d1222ed;backdrop-filter:blur(18px);box-shadow:0 10px 32px #0008;}.scoreboard .board-head h2{font:16px/1.2 var(--display);letter-spacing:.025em;white-space:nowrap;text-shadow:0 0 15px #ff3fa455;}.board-controls{display:flex;align-items:center;justify-content:center;gap:14px;min-width:0;}.scoreboard .board-sort{gap:3px;flex-wrap:nowrap;}.scoreboard .board-sort button{min-height:32px;padding:5px 8px;font:11px/1 system-ui;border-color:transparent;background:transparent;border-radius:5px;}.scoreboard .board-sort button[aria-pressed="true"]{background:#ffcf4a;color:#191006;}.board-controls input{min-width:0;width:150px;height:30px;border:1px solid #ffffff26;border-radius:5px;background:#ffffff08;color:white;padding:5px 8px;font:12px system-ui;}.board-nav{display:flex;align-items:center;gap:10px;}.scoreboard .room-link{background:transparent;color:#6df7e5;box-shadow:none;padding:7px 0;font:11px system-ui;white-space:nowrap;}.board-menu{position:relative;font:11px system-ui;}.board-menu summary{list-style:none;cursor:pointer;padding:8px;border:1px solid #ffffff26;border-radius:5px;}.board-menu summary::-webkit-details-marker{display:none;}.board-menu>div{position:absolute;right:0;top:38px;width:180px;padding:7px;display:grid;gap:4px;background:#101626;border:1px solid #4a4866;border-radius:8px;box-shadow:0 10px 30px #000b;}.board-menu button,.board-menu a{display:block;min-height:36px;padding:9px;text-align:left;background:transparent;color:#d6d8e5;border:0;font:12px system-ui;text-decoration:none;cursor:pointer;}.board-menu button:hover,.board-menu a:hover{background:#ffffff12;}.scoreboard .board-live{margin:7px 4px 12px;font:10px/1.5 system-ui;}.scoreboard .gsw-list{gap:14px;}.scoreboard .gsw-game{padding:7px;}.scoreboard .gsw-game:is([data-rank="1"],[data-rank="2"],[data-rank="3"]){margin-bottom:0;}.scoreboard .gsw-game b{font-size:17px;}.scoreboard .gsw-game small{min-height:0;font:10px/1.5 system-ui;margin-top:4px;}.scoreboard .gsw-txt{padding:10px 4px 4px;}.scoreboard .board-plays{font:11px/1.4 system-ui;padding-top:8px;}.scoreboard .board-detail{font-size:10px;margin-top:4px;}.scoreboard .board-like{min-height:32px;padding:6px 9px;margin:5px 4px 3px;font:10px system-ui;}.scoreboard .board-rank{top:14px;left:14px;padding:6px;font:10px/1.3 var(--pixel);}.scoreboard .board-definitions{margin:24px 4px 0;}.scoreboard .board-stats{margin:0;padding:14px 0;gap:24px;border:0;}.scoreboard .board-stats strong{display:inline;font:16px system-ui;margin-right:6px;}.scoreboard .board-stats span{font:10px system-ui;}
@media(max-width:900px){.scoreboard .board-head{grid-template-columns:1fr auto;gap:4px 12px;}.board-controls{grid-row:2;grid-column:1/-1;justify-content:space-between;}.board-nav{grid-row:1;grid-column:2;}.scoreboard .board-head h2{font-size:14px;}}
@media(max-width:560px){.gsw.scoreboard{padding:8px 10px 20px;}.scoreboard .board-head{padding:6px 8px;border-radius:9px;}.board-controls{gap:5px;}.scoreboard .board-sort button{font-size:10px;padding:5px 6px;}.board-controls input{width:110px;font-size:11px;}.board-nav{gap:8px;}.scoreboard .room-link,.board-menu{font-size:10px;}.scoreboard .board-live{margin:5px 2px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.scoreboard .gsw-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}.scoreboard .gsw-game{display:flex;flex-direction:column;align-items:stretch;gap:0;padding:5px;}.scoreboard .gsw-scr{width:100%;}.scoreboard .gsw-game b{font-size:13px;}.scoreboard .gsw-txt{padding:8px 3px 3px;}.scoreboard .board-rank{font-size:8px;top:10px;left:10px;padding:4px;}.scoreboard .board-detail{font-size:9px;}.scoreboard .board-stats{flex-wrap:wrap;gap:10px;}}
@media(max-width:360px){.board-controls{flex-wrap:wrap;}.board-controls input{width:100%;}}
`;
  let box = null, here = null, boardGames = [], metric = 'featured', metrics = null, loading = false;
  const metricNames = { plays: 'Plays', views: 'Views', likes: 'Likes', active_seconds: 'Active time' };
  const duration = seconds => seconds < 60 ? Math.floor(seconds) + 's' : seconds < 3600 ? Math.floor(seconds / 60) + 'm' : (seconds / 3600).toFixed(1) + 'h';
  const FEATURED = ['fish','tidebreak','wild','vr','crimson','river-rush'];
  const rankGames = (games, data, key) => [...games].sort((a,b) => {
    if (key === 'featured') {
      const priority = g => FEATURED.includes(g.id) ? FEATURED.indexOf(g.id) : FEATURED.length;
      const pinned = priority(a) - priority(b);
      if (pinned) return pinned;
    }
    const by = key === 'featured' ? 'plays' : key;
    return (data?.[b.id]?.[by] || 0) - (data?.[a.id]?.[by] || 0);
  });
  function validateMetrics(data) {
    if (data?.source !== 'posthog' || data.days !== 30 || !Number.isFinite(Date.parse(data.updatedAt)) || !data.games || typeof data.games !== 'object' || Array.isArray(data.games)) throw Error('Invalid analytics');
    for (const row of Object.values(data.games)) for (const key of Object.keys(metricNames)) if (!Number.isFinite(row?.[key]) || row[key] < 0) throw Error('Invalid metric');
    return data;
  }
  function filter() {
    if (!home) return;
    const query = box.querySelector('input').value.trim().toLowerCase();
    let matches = 0;
    for (const tile of box.querySelectorAll('.gsw-game')) { tile.hidden = !tile.dataset.search.includes(query); if (!tile.hidden) matches++; }
    box.querySelector('.board-empty').hidden = matches > 0;
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    box.querySelector('.board-status').textContent = 'Loading shared activity…';
    try {
      const response = await fetch('/api/arcade-leaderboard', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Unavailable');
      metrics = validateMetrics(await response.json());
      const hasActivity = Object.values(metrics.games).some(row => Object.values(row).some(n => n > 0));
      box.querySelector('.board-status').textContent = hasActivity ? 'Shared activity · Last 30 days · Updated ' + new Date(metrics.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Collecting activity. Be among the first to play.';
    } catch { metrics = null; box.querySelector('.board-status').textContent = 'Shared activity is unavailable. All games are ready to play.'; }
    finally { loading = false; render(); }
  }
  function render() {
    const list = box.querySelector('.gsw-list'); list.innerHTML = '';
    const shown = home ? rankGames(boardGames, metrics?.games, metric) : boardGames;
    const value = (id, key) => metrics?.games[id]?.[key] || 0;
    if (home) {
      const total = key => shown.reduce((sum,g) => sum + value(g.id,key),0);
      box.querySelector('.board-stats').innerHTML = `<div><strong>${shown.length}</strong><span>GAMES TO EXPLORE</span></div><div><strong>${metrics ? total('plays').toLocaleString() : '—'}</strong><span>PLAYS / LAST 30 DAYS</span></div><div><strong>${metrics ? duration(total('active_seconds')) : '—'}</strong><span>ACTIVE TIME</span></div>`;
      for (const button of box.querySelectorAll('[data-metric]')) button.setAttribute('aria-pressed', String(button.dataset.metric === metric));
    }
    for (const [rank,g] of shown.entries()) {
      const tile = document.createElement(home ? 'div' : 'a');
      tile.className = 'gsw-game' + (g.id === here ? ' here' : '');
      tile.style.setProperty('--c', g.color);
      tile.dataset.search = (g.name + ' ' + g.sub).toLowerCase();
      const a = home ? document.createElement('a') : tile;
      if (home) { a.className = 'board-launch'; tile.append(a); }
      a.href = g.id === here ? '#' : g.url;
      a.innerHTML = "<span class='gsw-scr'><img alt=''><span class='gsw-press'>PRESS START</span></span><span class='gsw-txt'><b></b><small></small></span>";
      const img = a.querySelector('img'); img.loading = 'lazy'; img.src = g.art;
      a.querySelector('b').textContent = g.name; a.querySelector('small').textContent = g.sub;
      if (home) {
        const ranked = metric === 'featured' ? FEATURED.includes(g.id) : metrics && value(g.id,metric) > 0;
        const displayMetric = metric === 'featured' ? 'plays' : metric;
        tile.dataset.rank = ranked ? rank + 1 : '';
        const badge = document.createElement('span'); badge.className = 'board-rank'; badge.textContent = ranked ? (metric === 'featured' ? 'PICK ' : '') + String(rank + 1).padStart(2,'0') : '—'; a.prepend(badge);
        const stat = document.createElement('span'); stat.className = 'board-plays';
        stat.textContent = metrics ? (displayMetric === 'active_seconds' ? duration(value(g.id,displayMetric)) : value(g.id,displayMetric).toLocaleString()) + ' ' + metricNames[displayMetric].toUpperCase() : 'ACTIVITY PENDING';
        a.querySelector('.gsw-txt').append(stat);
        const detail = document.createElement('span'); detail.className = 'board-detail';
        detail.textContent = metrics ? value(g.id,'views').toLocaleString() + ' views · ' + value(g.id,'plays').toLocaleString() + ' plays · ' + value(g.id,'likes').toLocaleString() + ' likes · ' + duration(value(g.id,'active_seconds')) + ' active' : 'Views · Plays · Likes · Active time';
        a.querySelector('.gsw-txt').append(detail);
        const like = document.createElement('button'); like.type = 'button'; like.className = 'board-like'; like.dataset.arcadeLike = g.id;
        const liked = window.ArcadeAnalytics?.liked(g.id);
        like.textContent = liked ? '♥ LIKED' : '♡ LIKE'; like.setAttribute('aria-label', (liked ? 'Liked ' : 'Like ') + g.name);
        like.disabled = !!liked || !window.ArcadeAnalytics?.enabled;
        if (!window.ArcadeAnalytics?.enabled) like.title = 'Likes are available on the live arcade.';
        like.onclick = () => { if (window.ArcadeAnalytics?.like(g.id)) { like.textContent = '♥ LIKED'; like.disabled = true; like.setAttribute('aria-label','Liked ' + g.name); box.querySelector('.board-status').textContent = 'Thanks for the like! Shared counts refresh every few minutes.'; } };
        tile.append(like);
      }
      a.addEventListener('click', () => { if (g.id !== here) record(g.id); });
      if (g.id === here) a.onclick = e => { e.preventDefault(); close(); };
      list.append(tile);
    }
    filter();
  }
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
    box.className = "gsw" + (home ? " scoreboard" : "");
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    // on the arcade page itself the list is the ALL GAMES view: no run ends, and there is no arcade to go back to
    box.setAttribute("aria-label", home ? "All games" : "Switch game");
    box.innerHTML = home
      ? "<div class='gsw-card'><header class='board-head'><h2>COTTAGE ARCADE</h2><div class='board-controls'><div class='board-sort' aria-label='Rank games by'><button type='button' data-metric='featured' aria-pressed='true'>Featured</button><button type='button' data-metric='plays' aria-pressed='false'>Plays</button><button type='button' data-metric='views' aria-pressed='false'>Views</button><button type='button' data-metric='likes' aria-pressed='false'>Likes</button><button type='button' data-metric='active_seconds' aria-pressed='false'>Time</button></div><input type='search' placeholder='Find a game' aria-label='Find a game'></div><nav class='board-nav' aria-label='Arcade menu'><a class='room-link' href='/arcade/room/'>3D arcade \u2197</a><details class='board-menu'><summary>Menu</summary><div><button type='button' class='board-refresh'>Refresh activity</button><button type='button' class='gsw-close'>Original machines</button><a href='#board-info'>About the counts</a></div></details></nav></header><div class='board-live'><span class='board-status' role='status'>Loading shared activity\u2026</span></div><div class='gsw-list'></div><p class='board-empty' hidden>No games found. Try another name.</p><details class='board-definitions' id='board-info'><summary>Activity / last 30 days</summary><div class='board-stats'></div><div>Featured games are selected picks. Views: game page visits. Plays: visits with a first player interaction. Likes: one per anonymous visitor per game in the last 30 days. Active time: focused game time within 30 seconds of input, excluding the game switcher. It is an engagement estimate. Rankings use production PostHog events and refresh every few minutes.</div></details></div>"
      : "<div class='gsw-card'><h2>SWITCH GAME</h2><p>Pick a cabinet. Your current run ends.</p><div class='gsw-list'></div><div class='gsw-row'><a href='/'>◀ Back to the arcade</a><button type='button' class='gsw-close'>Keep playing</button></div></div>";
    // keep the game from seeing clicks and keys meant for the switcher
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart", "keydown", "keyup"]) box.addEventListener(ev, (e) => e.stopPropagation());
    box.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.repeat) close(); }); // a held Esc must not reopen what it closed
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector(".gsw-close").onclick = close;
    if (home) {
      box.querySelector('input').addEventListener('input',filter);
      box.querySelector('.board-refresh').onclick = refresh;
      for (const button of box.querySelectorAll('[data-metric]')) button.onclick = () => { metric = button.dataset.metric; render(); box.querySelector(`[data-metric="${metric}"]`).focus(); };
    }
    // a game that turns its own frame (Reel It In keeps itself upright on the phone) marks a host, so the list turns with it
    (document.querySelector("[data-switch-host]") || document.body).appendChild(box);
  }
  async function open(current) {
    if (!box) build();
    here = current || thisGame();
    const shown = [];
    for (const g of GAMES) if (!g.probe || g.id === here || (await live[g.id])) shown.push(g);
    boardGames = shown;
    render();
    if (home) refresh();
    box.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const first = box.querySelector('.board-launch, .gsw-game:not(.here)');
    first?.focus({ preventScroll: true });
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
  function init() { wire(); if (home && !new URLSearchParams(location.search).has("machines")) open(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.GameSwitch = { open, close, wire, record, count, get isOpen() { return !!box && !box.hidden; }, GAMES, rankGames, validateMetrics, duration };
})();

