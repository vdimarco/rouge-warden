// js/story/ui/phoneframe.js : the phone camera's viewfinder (design 4.3). photoFrame(on, o) shows or hides
// it and updates it; call it as often as the state changes. o: zoom (1..8), score (0..100 live, or null),
// min (the score a mission needs; the focus ring turns crimson at or above it), subject (what to shoot),
// focus {x, y, r} (screen fractions 0..1; r a fraction of the height), note ('Too dark', 'Hold still'),
// selfie (true flips the frame), countdown (seconds on the self-timer, or null), flash {score, text}
// (after a shot: a white flash and the score). S.ui.photo reads the live state back.
export function createPhoneFrame(U) {
  const { S, make, root } = U;
  const el = make('div', 'sPhone hidden', root, `<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
    <div class="zoom"><b>1.0×</b><div class="lad"><i></i></div></div><div class="ring"></div><p class="sub"></p>
    <div class="score"><span class="sc"></span><span class="nt"></span></div><div class="cd"></div><div class="flash"></div><div class="res"><b></b><span></span></div><p class="self">SELFIE</p>`);
  el.id = 'sPhone';
  const q = (s) => el.querySelector(s);
  const st = { on: false, zoom: 1, score: null, min: 50, subject: '', focus: null, note: '', selfie: false, countdown: null, flashT: -9, flash: null };
  const cache = {};
  const set = (k, v, fn) => { if (cache[k] === v) return; cache[k] = v; fn(v); };

  function frame(on, o = {}) {
    if (!on) { if (st.on) { st.on = false; el.classList.add('hidden'); } return; }
    if (!st.on) { st.on = true; el.classList.remove('hidden'); for (const k of Object.keys(cache)) delete cache[k]; st.flash = null; st.flashT = -9; }
    for (const k of ['zoom', 'score', 'min', 'subject', 'focus', 'note', 'selfie', 'countdown']) if (k in o) st[k] = o[k];
    if (o.flash) { st.flash = o.flash; st.flashT = S.timers.now; el.classList.remove('shot'); void el.offsetWidth; el.classList.add('shot'); }
  }
  return {
    frame,
    get on() { return st.on; },
    get state() { return { ...st }; },
    tick() {
      if (!st.on) return;
      const z = Math.max(1, Math.min(8, +st.zoom || 1));
      set('zoom', z.toFixed(1), (v) => { q('.zoom b').textContent = `${v}×`; q('.lad i').style.height = `${((Math.log(+v) / Math.log(8)) * 100).toFixed(1)}%`; });
      set('sub', st.subject || '', (v) => { q('.sub').textContent = v; });
      const sc = st.score == null ? '' : String(Math.round(st.score));
      set('sc', sc, (v) => { q('.sc').textContent = v ? `SCORE ${v}` : ''; });
      set('nt', st.note || '', (v) => { q('.nt').textContent = v; });
      const good = st.score != null && st.score >= (st.min ?? 50);
      set('good', good, (v) => el.classList.toggle('good', v));
      const f = st.focus, ring = q('.ring');
      set('focus', f ? `${f.x},${f.y},${f.r}` : '', () => {
        if (!f) { ring.style.display = 'none'; return; }
        const r = Math.max(0.03, f.r ?? 0.12) * innerHeight;
        Object.assign(ring.style, { display: 'block', left: `${(f.x ?? 0.5) * 100}%`, top: `${(f.y ?? 0.5) * 100}%`, width: `${2 * r}px`, height: `${2 * r}px` });
      });
      set('self', !!st.selfie, (v) => el.classList.toggle('selfie', v));
      const cd = st.countdown == null ? '' : String(Math.max(0, Math.ceil(st.countdown)));
      set('cd', cd, (v) => { q('.cd').textContent = v; q('.cd').classList.toggle('on', !!v); });
      const showRes = st.flash && S.timers.now - st.flashT < 1.6;
      set('res', showRes ? `${st.flash.score ?? ''}|${st.flash.text || ''}` : '', (v) => {
        const r = q('.res'); r.classList.toggle('on', !!v);
        if (v) { r.querySelector('b').textContent = st.flash.score != null ? String(Math.round(st.flash.score)) : ''; r.querySelector('span').textContent = st.flash.text || ''; r.classList.toggle('good', st.flash.score != null && st.flash.score >= (st.min ?? 50)); }
      });
    },
    boxes() { const out = []; if (!st.on) return out; for (const [n, s] of [['zoom', '.zoom'], ['photoScore', '.score'], ['photoSubject', '.sub']]) { const e = q(s); const r = e.textContent.trim() ? U.box(e) : null; if (r) out.push([n, r]); } return out; },
    reset() { st.on = false; st.zoom = 1; st.score = null; st.subject = ''; st.focus = null; st.note = ''; st.selfie = false; st.countdown = null; st.flash = null; el.classList.add('hidden'); for (const k of Object.keys(cache)) delete cache[k]; },
  };
}
