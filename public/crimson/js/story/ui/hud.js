// js/story/ui/hud.js : the story HUD (design 4.4). The objective line (with a brush underline), the timer
// and meters (tail strip, bump meter, smooth meter), the clock tag or camcorder stamp, the FACE PLACE DATE
// LINK chips, vitals (LIFE, KI, up to 8 canteen pips), the prompt pill with its hold ring, a hint line, a
// toast, the drive cluster (speed in mph, the van's damage silhouette, 10 seat pips with crew glyphs), the
// boss bar #sboss, markers projected from the world with edge arrows (crimson objectives, glyph givers,
// neon danger) and suspicion eyes above watchers (crimson fill, neon at alert).
// Crimson (--crimson) marks the crew and objectives; neon (--red-hot) is only for danger.
import { CHAPTER_ORDER, CREW_IDS, EVIDENCE, GLYPHS } from '../types.js';
import { esc } from './cards.js';

const BOSS = {
  rattler: ['WADE "RATTLER" PRUITT', '蛇'], rattler2: ['THE RATTLESNAKE', '蛇'], voss: ['HARLAN VOSS, THE SMILING MAN', '笑'], voss2: ['THE SCORPION OF THE RED ROCKS', '蠍'],
  boone: ['BOONE, THE FOREMAN', '頭'], javelina: ['THE JAVELINA', '猪'], vulture: ['THE VULTURE', '鷲'], gila: ['THE GILA', '蜥'], tarantula: ['THE TARANTULA', '蛛'],
  guard: ['GUARD', ''], driver: ['DRIVER', ''],
};
const VAN_SVG = `<svg viewBox="0 0 30 64" aria-hidden="true"><path class="vb" d="M6 5q9-5 18 0l2 6v46q-11 6-22 0V11z"/><path class="vw" d="M8 13h14l-1 7H9zM9 46h12l1 5H8z"/><path class="vs" d="M4 22h-2M26 22h2" /></svg>`;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createHud(U) {
  const { S, make, root } = U;
  const { THREE } = S;
  const marks = make('div', 'sMarks', root); marks.id = 'sMarks';
  const tl = make('div', 'sTL', root); tl.id = 'sTL';
  const obj = make('div', 'sObj hidden', tl, '<p></p><i class="ul"></i>'); obj.id = 'sObj';
  const timerEl = make('div', 'sTimer hidden', tl, '<b></b>'); timerEl.id = 'sTimer';
  const meters = make('div', 'sMeters', tl); meters.id = 'sMeters';
  const vit = make('div', 'sVit hidden', root, `<div class="row"><span>LIFE</span><div class="bar hp"><i class="gh"></i><i class="fl"></i></div></div><div class="row"><span>KI</span><div class="bar ki"><i class="fl"></i></div></div><div class="pips"></div>`);
  vit.id = 'sVit';
  const info = make('div', 'sInfo hidden', root, `<p class="clock"></p><p class="stamp hidden"></p><div class="chips"></div>`); info.id = 'sInfo';
  const chips = info.querySelector('.chips');
  const chipEls = {};
  for (const k of EVIDENCE) { const c = make('span', `chip ${k}`, chips, `<i></i>${k.toUpperCase()}`); chipEls[k] = c; }
  const prompt = make('div', 'sPrompt hidden', root, `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="on" cx="18" cy="18" r="15"/></svg><kbd></kbd><span></span>`);
  prompt.id = 'sPrompt';
  const hintEl = make('p', 'sHint hidden', root); hintEl.id = 'sHint';
  const toastEl = make('p', 'sToast hidden', root); toastEl.id = 'sToast';
  const drive = make('div', 'sDrive hidden', root, `<div class="spd"><b>0</b><small>MPH</small></div><div class="dmg">${VAN_SVG}</div><div class="seats"></div>`);
  drive.id = 'sDrive';
  const seatsEl = drive.querySelector('.seats');
  for (let i = 0; i < 10; i++) make('i', 'seat', seatsEl);
  const boss = make('div', 'sBoss hidden', root, `<p class="nm"><span></span><small></small></p><div class="bar"><i class="gh"></i><i class="fl"></i><span class="tk"></span></div><div class="post"><i></i></div>`);
  boss.id = 'sboss';
  const wanted = make('div', 'sWanted hidden', root, '<b></b><span></span><progress max="6" value="0" aria-label="Arrest progress"></progress>');
  wanted.id = 'sWanted'; wanted.setAttribute('role', 'status');

  // state
  const st = {
    obj: '', timer: null, meters: new Map(), clock: null, stamp: null, evidence: null, seats: [], speed: 0, damage: 0, boss: undefined, bossAuto: null,
    manual: null, hint: null, toastUntil: 0, marks: new Map(), lastSpeedT: -1, bossGhost: 1, hpGhost: 1,
  };
  const cache = {};
  const set = (key, v, fn) => { if (cache[key] === v) return; cache[key] = v; fn(v); };
  const show = (e, on) => { if (e.classList.contains('hidden') === !on) return; e.classList.toggle('hidden', !on); };

  /* ---------------- the api ---------------- */
  // the text can name keys ("{Press} {pause} for the menu."): shown for the device in use, and redrawn
  // when the device changes
  function objective(text) {
    st.objRaw = text ? String(text) : '';
    st.obj = U.keys(st.objRaw);
    obj.querySelector('p').textContent = st.obj;
    show(obj, !!st.obj);
    // the underline draws in again for a new objective
    if (st.obj) { const ul = obj.querySelector('.ul'); ul.classList.remove('go'); void ul.offsetWidth; ul.classList.add('go'); }
  }
  function meter(id, v, o = {}) {
    let m = st.meters.get(id);
    if (!m) {
      const e = make('div', 'meter', meters, `<p><span></span><b></b></p><div class="mb"><i class="fl"></i><i class="band"></i><i class="dot"></i></div><div class="pp"></div>`);
      m = { id, e, o: {} };
      st.meters.set(id, m);
    }
    m.o = { ...m.o, ...o }; m.v = v;
    const O = m.o, max = O.max ?? 1, kind = O.kind || (O.pips ? 'pips' : O.near != null ? 'band' : 'bar');
    m.e.className = `meter k-${kind}${O.hot != null && (O.hotBelow ? v <= O.hot : v >= O.hot) ? ' hot' : ''}${O.crimson ? ' crimson' : ''}`;
    m.e.querySelector('p span').textContent = O.label || id.toUpperCase();
    m.e.querySelector('p b').textContent = O.text != null ? O.text : kind === 'band' ? `${Math.round(v)} M` : kind === 'pips' ? `${Math.round(v)}/${O.pips}` : '';
    const k = clamp(v / max, 0, 1);
    if (kind === 'bar') m.e.querySelector('.fl').style.transform = `scaleX(${k})`;
    if (kind === 'band') {
      const a = clamp(O.near / max, 0, 1), b = clamp(O.far / max, 0, 1);
      Object.assign(m.e.querySelector('.band').style, { left: `${a * 100}%`, width: `${(b - a) * 100}%` });
      m.e.querySelector('.dot').style.left = `${k * 100}%`;
      m.e.classList.toggle('out', v < O.near || v > O.far);
    }
    if (kind === 'pips') {
      const pp = m.e.querySelector('.pp');
      if (pp.children.length !== O.pips) { pp.innerHTML = ''; for (let i = 0; i < O.pips; i++) make('i', '', pp); }
      [...pp.children].forEach((p, i) => p.classList.toggle('on', i < v));
    }
  }
  function clearMeter(id) { const m = st.meters.get(id); if (m) { m.e.remove(); st.meters.delete(id); } }
  function marker(id, o) { if (!o) return unmark(id); st.marks.set(id, { id, ...o }); }
  function unmark(id) { st.marks.delete(id); }
  function toast(text, hot) {
    if (!text) { show(toastEl, false); st.toastUntil = 0; return; }
    toastEl.textContent = text; toastEl.classList.toggle('hot', !!hot);
    show(toastEl, true); toastEl.classList.remove('go'); void toastEl.offsetWidth; toastEl.classList.add('go');
    st.toastUntil = S.timers.now + 2.6;
  }

  /* ---------------- projected markers and eyes ---------------- */
  const pool = [], eyes = [];
  const v3 = new THREE.Vector3();
  function projItem(list, i, cls, html) {
    let e = list[i];
    if (!e) { e = make('div', '', marks); e.innerHTML = '<i class="ar"></i><b></b><small></small>'; list[i] = e; }
    if (e.dataset.cls !== cls) { e.className = cls; e.dataset.cls = cls; }
    if (html != null && e.dataset.html !== html) { e.querySelector('b').innerHTML = html; e.dataset.html = html; }
    return e;
  }
  // where a world point lands on the screen: {x, y, on, ang}. An off-screen point sits on the edge of a
  // frame that keeps clear of the HUD (the thumbs and the minimap on touch), with the angle to it; a point
  // below or behind goes to a side edge, so the bottom stays clear.
  function frame(W, H) {
    if (!U.touch) return { l: 34, r: 34, t: 110, bl: 300, br: 130 };
    return H > W ? { l: 24, r: 24, t: 280, bl: 300, br: 300 } : { l: 34, r: 170, t: 80, bl: 150, br: 218 };
  }
  function project(x, y, z, W, H, F) {
    v3.set(x, y, z).project(S.camera);
    let px = (v3.x * 0.5 + 0.5) * W, py = (-v3.y * 0.5 + 0.5) * H;
    const behind = v3.z > 1;
    if (behind) { px = W - px; py = H - py; }
    const on = !behind && px >= 20 && px <= W - 20 && py >= 20 && py <= H - 20;
    if (on) return { x: px, y: py, on: true, ang: 0 };
    const cx = W / 2, cy = H / 2;
    let dx = px - cx, dy = py - cy;
    if (behind && Math.abs(dx) < 1) dx = 1;
    const side = dx < 0 ? F.l : W - F.r, bot = H - (dx < 0 ? F.bl : F.br);
    const sx = Math.abs(side - cx) / Math.max(1e-6, Math.abs(dx)), sy = (dy < 0 ? cy - F.t : Math.max(1, bot - cy)) / Math.max(1e-6, Math.abs(dy));
    let ex = cx + dx * Math.min(sx, sy), ey = cy + dy * Math.min(sx, sy);
    if (dy > 0 && (sy < sx || behind)) { ex = side; ey = Math.min(bot, cy + dy * sx); }
    return { x: ex, y: Math.max(F.t, ey), on: false, ang: Math.atan2(ey - cy, ex - cx) };
  }
  function allMarkers() {
    const out = [...st.marks.values()];
    const have = new Set(out.map((m) => m.id));
    let extra = [];
    try { extra = (S.missions && S.missions.markers && S.missions.markers()) || []; } catch (e) { extra = []; }
    if (!extra.length && S.markers3d) extra = S.markers3d.list || [];
    for (const m of extra) if (m && Number.isFinite(m.x) && Number.isFinite(m.z) && !have.has(m.id)) { out.push(m); have.add(m.id); }
    return out;
  }
  const kindOf = (m) => (m.kind === 'giver' || m.kind === 'danger' || m.kind === 'van' || m.kind === 'waypoint' || m.kind === 'cairn' ? m.kind : 'objective');
  let markersOn = false;
  function updateMarks(visible) {
    const W = innerWidth, H = innerHeight, F = frame(W, H);
    let n = 0, ne = 0;
    if (visible) {
      const hp = S.hero ? S.hero.pos : S.focus;
      for (const m of allMarkers()) {
        if (m.hidden) continue;
        const kind = kindOf(m);
        const y = (m.y ?? S.world.surface(m.x, m.z, (hp.y || 0) + 40)) + (kind === 'objective' ? 2.6 : 2.2);
        const p = project(m.x, y, m.z, W, H, F);
        const d = Math.hypot(m.x - hp.x, m.z - hp.z);
        const g = kind === 'giver' ? (GLYPHS[m.who] || m.glyph || m.label || '●') : kind === 'danger' ? '危' : kind === 'van' ? '' : kind === 'cairn' ? '渦' : '';
        const e = projItem(pool, n++, `mk ${kind}${p.on ? '' : ' edge'}${d < 12 && kind === 'objective' ? ' near' : ''}`, esc(g));
        e.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        e.querySelector('.ar').style.transform = p.on ? '' : `rotate(${p.ang.toFixed(3)}rad) translateX(16px)`;
        const lbl = `${d >= 1000 ? (d / 1000).toFixed(1) + ' KM' : Math.round(d) + ' M'}${m.label && kind !== 'giver' ? ' · ' + m.label : ''}`;
        const sm = e.querySelector('small'); if (sm.textContent !== lbl) sm.textContent = lbl;
      }
      // suspicion eyes above watchers
      const list = (S.stealth && S.stealth.list) || [];
      for (const w of list) {
        const f = w.f || w.fighter || w;
        const pos = f && (f.pos || (f.a && f.a.root && f.a.root.position));
        if (!pos || f.downed || f.tied) continue;
        const lvl = clamp(+(w.level ?? w.suspicion ?? f.suspicion ?? 0) || 0, 0, 1), alert = !!(w.alert || f.alert || lvl >= 1);
        if (lvl < 0.03 && !alert) continue;
        const p = project(pos.x, (pos.y || 0) + 2.25, pos.z, W, H, F);
        if (!p.on) continue;
        const e = projItem(eyes, ne++, `eye${alert ? ' alert' : ''}`, null);
        e.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        e.style.setProperty('--k', lvl.toFixed(3));
      }
    }
    fightMarks(visible, W, H, F);
    for (let i = n; i < pool.length; i++) if (pool[i].dataset.cls !== 'off') { pool[i].className = 'off'; pool[i].dataset.cls = 'off'; }
    for (let i = ne; i < eyes.length; i++) if (eyes[i].dataset.cls !== 'off') { eyes[i].className = 'off'; eyes[i].dataset.cls = 'off'; }
    markersOn = n > 0;
  }

  /* ---------------- the locked enemy and the danger tells ---------------- */
  // the lock-on: a ring at the locked enemy's feet and, over its head, a small life bar with its posture
  // under it (a boss has the top bar, so only the ring). A tell (危, an unblockable attack coming) shows over
  // the attacker's head for 0.9 s, following it.
  const lockEl = make('div', 'lk off', marks, '<i class="rg"></i><div class="lb"><i class="hp"></i><i class="po"></i></div>');
  const tells = [];
  const headAt = (f, out) => {
    const hb = f.a && f.a.bone && f.a.bone('Head');
    if (hb) { hb.getWorldPosition(out); out.y += 0.3; } else out.set(f.pos.x, (f.pos.y || 0) + 2.05, f.pos.z);
    return out;
  };
  const hv = new THREE.Vector3();
  function fightMarks(visible, W, H, F) {
    const C = S.combat, list = (visible && C && C.enemies) || [], now = S.time;
    const f = visible && C && C.lock;
    let lockOn = false;
    if (f && !f.gone && !f.downed && f.pos) {
      headAt(f, hv);
      const top = project(hv.x, hv.y, hv.z, W, H, F), gy = Number.isFinite(f.pos.y) ? f.pos.y : S.world.surface(f.pos.x, f.pos.z);
      const foot = project(f.pos.x, gy + 0.05, f.pos.z, W, H, F);
      if (top.on && foot.on) {
        lockOn = true;
        const h = clamp(foot.y - top.y, 20, 600), rw = clamp(h * 0.62, 26, 260);
        lockEl.style.transform = `translate(${foot.x.toFixed(1)}px, ${foot.y.toFixed(1)}px)`;
        const rg = lockEl.firstChild; rg.style.width = `${rw.toFixed(0)}px`; rg.style.height = `${(rw * 0.32).toFixed(0)}px`;
        const lb = lockEl.lastChild; lb.style.transform = `translate(-50%, ${(top.y - foot.y - 16).toFixed(1)}px)`;
        const boss = !!f.boss || f === C.boss;
        lb.style.display = boss ? 'none' : '';
        if (!boss) {
          lb.firstChild.style.transform = `scaleX(${clamp((f.hp || 0) / (f.maxHp || 1), 0, 1).toFixed(3)})`;
          lb.lastChild.style.transform = `scaleX(${clamp((f.posture || 0) / (f.maxPosture || 100), 0, 1).toFixed(3)})`;
          lb.classList.toggle('broken', f.state === 'broken');
        }
      }
    }
    const lc = lockOn ? 'lk' : 'lk off'; if (lockEl.className !== lc) lockEl.className = lc;
    let nt = 0;
    for (const e of list) {
      if (e.tellT == null || now - e.tellT > 0.9 || e.downed || e.gone || !e.pos) continue;
      headAt(e, hv);
      const p = project(hv.x, hv.y, hv.z, W, H, F);
      p.y -= 38; // over the life bar
      if (!p.on) continue;
      let el = tells[nt];
      if (!el) { el = tells[nt] = make('div', 'tell', marks, '<b>危</b>'); }
      if (el.className !== 'tell') el.className = 'tell';
      // on game time: in fast, a moment at full, then up and out
      const k = (now - e.tellT) / 0.9, sc = k < 0.15 ? 1.6 - 4 * k : 1, rise = k > 0.75 ? (k - 0.75) * 60 : 0;
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - rise).toFixed(1)}px) scale(${sc.toFixed(2)})`;
      el.style.opacity = (k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1).toFixed(2);
      nt++;
    }
    for (let i = nt; i < tells.length; i++) if (tells[i].className !== 'tell off') tells[i].className = 'tell off';
  }

  /* ---------------- per tick ---------------- */
  function layout(touch) { if (touch && vit.parentNode !== tl) tl.appendChild(vit); else if (!touch && vit.parentNode !== root) root.insertBefore(vit, info); }
  function tick() {
    const H = S.hero, t = S.timers.now;
    if (U.touch !== st.touch) { st.touch = U.touch; layout(st.touch); }
    const world = !!(S.world && S.world.visible);
    const cine = !!(S.cine && S.cine.active) || document.body.classList.contains('cine') || !!(S.film && S.film.active);
    const play = S.mode === 'play' && !cine;
    const mode = H ? H.mode : 'foot';
    const photo = mode === 'photo' || !!(S.photo && S.photo.active);
    const riding = !!(S.drive && S.drive.riding) && (mode === 'drive' || mode === 'passenger');
    const menu = S.mode === 'menu';
    root.classList.toggle('cineOn', cine);
    const law = S.law?.state;
    show(wanted, play && world && !photo && !!law?.stars);
    if (law?.stars) {
      const stars = '★'.repeat(law.stars) + '☆'.repeat(5 - law.stars);
      const rating = wanted.querySelector('b'); if (rating.textContent !== stars) rating.textContent = stars;
      wanted.classList.toggle('searching', law.status === 'search');
      const message = law.arrest > 0 ? 'BUSTING — MOVE!' : law.status === 'dispatch' ? '911 • UNITS INBOUND'
        : law.status === 'search' ? `SEARCHING • EVADE ${Math.ceil(18 + law.stars * 4 - law.search)}s`
        : law.stars >= 3 ? 'AIR SUPPORT • PURSUIT' : 'COUNTY POLICE • PURSUIT';
      const status = wanted.querySelector('span'); if (status.textContent !== message) status.textContent = message;
      const progress = wanted.querySelector('progress'); progress.value = law.arrest; progress.hidden = law.arrest <= 0;
    }

    // objective, timer, meters
    show(tl, play || menu);
    if (st.objRaw && st.objRaw.includes('{')) { const t = U.keys(st.objRaw); if (t !== st.obj) { st.obj = t; obj.querySelector('p').textContent = t; } }
    // vitals: on foot in the world
    const vOn = play && world && mode === 'foot' && !!H;
    show(vit, vOn);
    if (vOn) {
      const hp = clamp(H.hp / (H.maxHp || 100), 0, 1), ki = clamp(H.st / (H.maxSt || 100), 0, 1);
      st.hpGhost = hp > st.hpGhost ? hp : Math.max(hp, st.hpGhost - 0.012);
      set('hp', hp.toFixed(3), (v) => { vit.querySelector('.hp .fl').style.transform = `scaleX(${v})`; });
      set('hpg', st.hpGhost.toFixed(3), (v) => { vit.querySelector('.hp .gh').style.transform = `scaleX(${v})`; });
      set('ki', ki.toFixed(3), (v) => { vit.querySelector('.ki .fl').style.transform = `scaleX(${v})`; vit.querySelector('.ki').classList.toggle('empty', +v < 0.05); });
      vit.classList.toggle('low', hp < 0.3);
      const max = clamp(Math.round(H.canteenMax || 5), 1, 8), have = clamp(Math.round(H.canteen || 0), 0, max);
      set('pips', `${have}/${max}`, () => { const p = vit.querySelector('.pips'); p.innerHTML = ''; for (let i = 0; i < max; i++) make('b', i < have ? '' : 'used', p); make('span', '', p, 'GOURD'); });
    }
    // the clock tag or the camcorder stamp, and the evidence chips
    const iOn = play && world && !photo;
    show(info, iOn);
    if (iOn) {
      const stamp = st.stamp;
      set('stamp', stamp || '', (v) => { const e = info.querySelector('.stamp'); e.textContent = v; e.classList.toggle('hidden', !v); info.querySelector('.clock').classList.toggle('hidden', !!v); });
      if (!stamp) set('clock', st.clock || S.day.label(), (v) => { info.querySelector('.clock').textContent = v; });
      const ch = S.missions && S.missions.chapter, ci = CHAPTER_ORDER.indexOf(ch);
      const slots = (S.evidence && S.evidence.slots) || {}, ev = st.evidence || {};
      const any = EVIDENCE.some((k) => slots[k] || ev[k]);
      const chipsOn = ev.show === false ? false : ev.show || any || ci >= CHAPTER_ORDER.indexOf('p1');
      set('chipsOn', chipsOn, (v) => chips.classList.toggle('hidden', !v));
      if (chipsOn) set('chips', EVIDENCE.map((k) => (slots[k] || ev[k] ? 1 : 0)).join(''), (v) => EVIDENCE.forEach((k, i) => chipEls[k].classList.toggle('on', v[i] === '1')));
    }
    // the timer
    const tOn = st.timer != null && play;
    show(timerEl, tOn);
    if (tOn) { const left = st.timer.end != null ? st.timer.end - t : st.timer.sec; set('timer', fmt(left), (v) => { timerEl.querySelector('b').textContent = v; }); timerEl.classList.toggle('hot', left <= 10); }
    // the prompt: a mission's own, else the nearest thing to use, else GET OUT when the van stands still
    let pl = null, pk = 'use', ph = 0;
    if (st.manual) { pl = st.manual.label; pk = st.manual.key; ph = st.manual.hold; }
    else if (play && !S.freeze && !S.modal && H) {
      const cur = S.interact && S.interact.current;
      if (mode === 'foot' && cur && cur.label) { pl = cur.label; ph = cur.progress || (cur.hold > 0 && H.hold01) || 0; }
      else if (riding && S.drive.riding && Math.abs(S.drive.riding.speed) < 0.6 && !S.drive.anim) { pl = 'GET OUT'; pk = 'exit'; }
    }
    const pOn = !!pl && (play || !!st.manual) && !photo;
    show(prompt, pOn);
    if (pOn) {
      const kl = pk && U.KEY_LABELS.key[pk] != null ? U.key(pk) : pk || U.key('use');
      set('pk', kl, (v) => { prompt.querySelector('kbd').textContent = v; });
      set('pl', pl, (v) => { prompt.querySelector('span').textContent = v; });
      set('ph', Math.round(clamp(ph, 0, 1) * 100), (v) => { prompt.classList.toggle('hold', v > 0); prompt.querySelector('.on').style.strokeDashoffset = String(94.25 * (1 - v / 100)); });
    }
    st.promptOn = pOn; st.promptLabel = pOn ? pl : null;
    // the hint and the toast
    show(hintEl, !!st.hint && play && !S.modal);
    if (st.hint) set('hint', U.keys(st.hint), (v) => { hintEl.textContent = v; });
    if (st.toastUntil && t >= st.toastUntil) { show(toastEl, false); st.toastUntil = 0; }
    // the drive cluster
    const dOn = riding && play && world;
    show(drive, dOn);
    if (dOn) {
      set('spd', String(Math.round(Math.abs(st.speed) * 2.23694)), (v) => { drive.querySelector('.spd b').textContent = v; });
      const k = clamp(st.damage, 0, 1);
      set('dmg', k.toFixed(2), (v) => { drive.querySelector('.dmg').style.setProperty('--d', v); drive.querySelector('.dmg').classList.toggle('hot', +v >= 0.85); });
      set('seats', st.seats.map((s) => s || '').join(','), () => seatPips());
      drive.classList.toggle('pass', mode === 'passenger');
    }
    // the boss bar
    const f = st.boss !== undefined ? st.boss : (S.combat && S.combat.active ? S.combat.boss : null);
    const bOn = !!f && (play || S.freeze) && !cine;
    show(boss, bOn);
    if (bOn) bossBar(f);
    // markers and eyes
    updateMarks(play && world && !S.freeze);
  }
  function seatPips() {
    const els = seatsEl.children;
    for (let i = 0; i < 10; i++) {
      const s = st.seats[i], e = els[i];
      const hero = S.hero && (s === 'hero' || s === S.hero.body) && i === (S.drive ? S.drive.heroSeat : -1);
      const crew = CREW_IDS.includes(s) || s === 'gabe';
      e.className = `seat${s ? ' full' : ''}${crew ? ' crew' : ''}${hero ? ' me' : ''}`;
      e.textContent = crew ? GLYPHS[s] : s === 'hero' ? GLYPHS[S.hero && S.hero.body] || '●' : '';
    }
  }
  function bossBar(f) {
    const id = (f.def && (f.def.variant || f.def.id)) || f.id || '';
    const phase2 = f.phase === 2 || f.vortex || f.form === 'vortex';
    const key = phase2 && BOSS[id + '2'] ? id + '2' : id;
    const [nm, kj] = f.name ? [f.name, f.kanji || ''] : BOSS[key] || [String(id).toUpperCase(), ''];
    set('bnm', nm + kj, () => { boss.querySelector('.nm span').textContent = nm; boss.querySelector('.nm small').textContent = kj; st.bossGhost = 1; });
    const hp = clamp((f.hp || 0) / (f.maxHp || 1), 0, 1);
    st.bossGhost = hp > st.bossGhost ? hp : Math.max(hp, st.bossGhost - 0.006);
    set('bhp', hp.toFixed(3), (v) => { boss.querySelector('.fl').style.transform = `scaleX(${v})`; });
    set('bgh', st.bossGhost.toFixed(3), (v) => { boss.querySelector('.gh').style.transform = `scaleX(${v})`; });
    const pm = f.maxPosture || (f.def && f.def.posture) || 100, post = clamp((f.posture || 0) / pm, 0, 1);
    set('bpo', post.toFixed(3), (v) => { boss.querySelector('.post i').style.width = `${v * 100}%`; });
    boss.classList.toggle('broken', f.state === 'broken' || post >= 1);
    boss.classList.toggle('two', !!phase2);
  }

  return {
    objective, meter, clearMeter, marker, unmark, toast,
    timer(sec) { st.timer = sec == null ? null : { end: S.timers.now + Math.max(0, +sec || 0) }; },
    prompt(label, key = 'use', hold = 0) { st.manual = label ? { label: String(label), key: key || 'use', hold: +hold || 0 } : null; },
    boss(f) { st.boss = f || null; if (!f) st.boss = null; },
    stamp(text) { st.stamp = text || null; },
    clockTag(text) { st.clock = text || null; },
    evidence(state) { st.evidence = state ? { ...state } : null; },
    seats(list) { st.seats = Array.isArray(list) ? list.slice(0, 10) : []; },
    speed(mps) { st.speed = +mps || 0; },
    damage(k) { st.damage = +k || 0; },
    hint(text) { st.hint = text ? String(text) : null; },
    tick,
    get objectiveText() { return st.obj; },
    get promptLabel() { return st.promptLabel; },
    markerState: () => ({ count: pool.filter((e) => e.dataset.cls !== 'off').length, eyes: eyes.filter((e) => e.dataset.cls !== 'off').length, list: allMarkers().map((m) => ({ id: m.id, kind: kindOf(m), x: m.x, z: m.z })) }),
    allMarkers, kindOf,
    // on-screen boxes for the overlap check (markers and eyes float over the world by design)
    boxes() {
      const out = [];
      for (const [n, e] of [['objective', obj], ['timer', timerEl], ['vitals', vit], ['info', info], ['prompt', prompt], ['hint', hintEl], ['toast', toastEl], ['drive', drive], ['boss', boss]]) { const r = U.box(e); if (r) out.push([n, r]); }
      for (const m of st.meters.values()) { const r = U.box(m.e); if (r) out.push([`meter:${m.id}`, r]); }
      return out;
    },
    // the vitals move under the objective on touch screens (the thumb covers the bottom left)
    layout,
    reset() {
      objective(null); st.timer = null; for (const id of [...st.meters.keys()]) clearMeter(id);
      st.marks.clear(); st.manual = null; st.hint = null; st.boss = undefined; st.stamp = null; st.clock = null; st.evidence = null; st.seats = []; st.speed = 0; st.damage = 0;
      toast(null); for (const k of Object.keys(cache)) delete cache[k];
      for (const e of [vit, info, prompt, hintEl, drive, boss, timerEl]) e.classList.add('hidden');
      updateMarks(false);
    },
  };
}
