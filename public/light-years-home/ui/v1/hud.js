// Light Years Home: the HUD. Draws the engine state into the page's DOM each frame: the top row and clocks, the grey
// info box and "On Earth" cards, the karaoke captions, chips A B C, the scan card, the fork, the chapter, lost and
// score cards, the ending's date and clocks, and the flight strip. It writes only what changed, so a frame costs no
// layout unless something moved. It also reports where its boxes are (layout()) for the QA hook.
import { fmt, blackbodyRGB, srgbEncode, groupDigits } from '../../core/physics.js';
import { timings, wordAt, SLOW } from '../../core/captions.js';
import { STOPS, CHAPTERS, straightLineLy } from '../../core/route.js';
import { OBJECTS, AU_LY, distanceLy } from '../../core/objects.js';
import { scanOf, zoneAt, legOf, ROUTE_LY, HEAT_HIGH, ENDING_BEATS, CAPTION_TAIL } from '../../core/engine.js';
import { arrivalText, milestoneWhen } from '../../core/timeline.js';
import { MILESTONES } from '../../core/milestones.js';
import { layoutMode } from '../../core/geo.js';

const EARTH_CARD_MS = 6000;     // an "On Earth" card stays this long
const EARTH_CARD_MIN = 2500;    // ...or this long when another is waiting
const INFO_FLASH_MS = 3000;     // landscape: the info box shows this long when it changes
const LENS_PX = 192;            // telescope view render size
const PLAY = new Set(['intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter', 'ending', 'lost']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Three significant figures with digit groups: 323, 7,510, 2.45, 0.27.
function sig3(v) {
  if (!(v > 0)) return '0';
  const p = 10 ** (Math.floor(Math.log10(v)) - 2);
  const r = Math.round(v / p) * p;
  return r >= 100 ? groupDigits(r) : String(Number(r.toPrecision(3)));
}

// A distance for a card or label: '718 Mly', '7,510 ly', '8.61 ly', '39.8 AU'.
export function distanceText(ly) {
  if (!(ly > 0)) return '0 ly';
  if (ly >= 1e6) return `${sig3(ly / 1e6)} Mly`;
  if (ly >= 0.01) return `${sig3(ly)} ly`;
  return `${sig3(ly / AU_LY)} AU`;
}

// The end card's top speed: 'LIGHT − 2.5 nm/s · 17 nines'.
const UNIT_SHORT = [['KILOMETRE', 'km'], ['MILLIMETRE', 'mm'], ['CENTIMETRE', 'cm'], ['MICROMETRE', 'µm'],
  ['NANOMETRE', 'nm'], ['METRE', 'm']];
export function topSpeedText(eta) {
  if (!(eta > 0)) return 'At rest';
  let s = fmt.shortfall(eta).replace(' PER SECOND', '/s');
  for (const [long, short] of UNIT_SHORT) s = s.replace(new RegExp(`${long}S?/s`), `${short}/s`);
  return `${s} · ${fmt.nines(eta)} nines`;
}

// A swatch colour for a temperature in kelvin, as CSS rgb().
function swatchColour(T) {
  const c = blackbodyRGB(T).map((v) => Math.round(255 * srgbEncode(v)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const ROMAN = ['I', 'II', 'III', 'IV'];

export function createHud({ doc = document, on = {} } = {}) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    hud: $('hud'), top: $('top'), where: $('where'), chapterName: $('chapter-name'), count: $('stop-count'),
    clock: $('clock'), clockYou: $('clock-you'), clockEarth: $('clock-earth'), pauseBtn: $('pause-btn'),
    soundBtn: $('sound-btn'), info: $('info'), earth: $('earth'), earthText: $('earth-text'), earthWhen: $('earth-when'),
    stamp: $('stamp'), caption: $('caption'), say: $('say'), hint: $('hint'), chips: $('chips'), panel: $('panel'),
    card: $('card'), lens: $('lens'), cardTitle: $('card-title'), cardClose: $('card-close'), facts: $('facts'),
    setCourse: $('set-course'), fork: $('fork'), forkTitle: $('fork-title'),
    chapterCard: $('chapter-card'), chapterEyebrow: $('chapter-eyebrow'), chapterTitle: $('chapter-title'),
    chapterLine: $('chapter-line'), chapterPanes: $('chapter-panes'), chapterScore: $('chapter-score'),
    chapterGo: $('chapter-go'), lostCard: $('lost-card'), lostTitle: $('lost-title'), lostLine: $('lost-line'),
    lostRetry: $('lost-retry'), lostNew: $('lost-new'), endCard: $('end-card'), endEyebrow: $('end-eyebrow'),
    endScore: $('end-score'), endRank: $('end-rank'), endBest: $('end-best'), endStats: $('end-stats'),
    endRoute: $('end-route'), endNew: $('end-new'), strip: $('strip'), shortfall: $('shortfall'), rate: $('rate'),
    throttle: $('throttle'), hot: doc.querySelector('#throttle .hot'), nextWrap: doc.querySelector('#throttle .next-wrap'),
    panes: $('panes'), route: $('route'), segs: doc.querySelector('#route .segs'),
    title: $('title'), pause: $('pause'), how: $('how'), graphics: $('graphics-error'), best: $('best-line'),
    play: $('play'), cont: $('continue'), howBtn: $('how-btn'), pauseHow: $('pause-how'), howClose: $('how-close'),
    resume: $('resume'), restart: $('restart'),
  };
  const chipEls = [...el.chips.querySelectorAll('.chip')];
  const factEls = [...el.facts.children];
  const paneEls = [...el.panes.children];

  // ---------- write-only-on-change helpers ----------
  const texts = new Map(), shown = new Map(), classes = new Map(), vars = new Map(), attrs = new Map();
  function put(node, text) {
    const t = String(text);
    if (texts.get(node) === t) return;
    texts.set(node, t);
    node.textContent = t;
  }
  let changed = false;          // something was shown or hidden this frame (the layout moved)
  function show(node, on) {
    const v = Boolean(on);
    if (shown.get(node) === v) return false;
    shown.set(node, v);
    node.hidden = !v;
    changed = true;
    return true;
  }
  function cls(node, name, on) {
    const key = node;
    let m = classes.get(key);
    if (!m) { m = new Map(); classes.set(key, m); }
    const v = Boolean(on);
    if (m.get(name) === v) return;
    m.set(name, v);
    node.classList.toggle(name, v);
  }
  function setVar(node, name, value, step = 0.001) {
    let m = vars.get(node);
    if (!m) { m = new Map(); vars.set(node, m); }
    const old = m.get(name);
    if (old !== undefined && Math.abs(old - value) < step) return;
    m.set(name, value);
    node.style.setProperty(name, String(Math.round(value * 10000) / 10000));
  }
  function attr(node, name, value) {
    let m = attrs.get(node);
    if (!m) { m = new Map(); attrs.set(node, m); }
    const v = String(value);
    if (m.get(name) === v) return;
    m.set(name, v);
    node.setAttribute(name, v);
  }

  // ---------- buttons ----------
  const call = (name, ...args) => () => on[name] && on[name](...args);
  el.play.addEventListener('click', call('play'));
  el.cont.addEventListener('click', call('continue'));
  el.howBtn.addEventListener('click', () => openHow('title'));
  el.pauseHow.addEventListener('click', () => openHow('pause'));
  el.howClose.addEventListener('click', () => closeHow());
  el.resume.addEventListener('click', call('resume'));
  el.restart.addEventListener('click', call('restart'));
  el.pauseBtn.addEventListener('click', call('pause'));
  el.soundBtn.addEventListener('click', call('sound'));
  el.cardClose.addEventListener('click', call('act', { type: 'close' }));
  el.setCourse.addEventListener('click', call('act', { type: 'lock' }));
  el.chapterGo.addEventListener('click', call('act', { type: 'continue' }));
  el.lostRetry.addEventListener('click', call('act', { type: 'retryChapter' }));
  el.lostNew.addEventListener('click', call('newJourney'));
  el.endNew.addEventListener('click', call('newJourney'));
  for (const chip of chipEls) {
    chip.addEventListener('click', (e) => on.select && on.select(chip.dataset.letter, e.detail > 0));
  }
  for (const b of doc.querySelectorAll('.fork-btn')) {
    b.addEventListener('click', () => on.act && on.act({ type: 'fork', branch: b.dataset.branch }));
  }
  for (const b of doc.querySelectorAll('[data-set]')) {
    b.addEventListener('click', () => on.setting && on.setting(b.dataset.set, b.dataset.value));
  }

  // ---------- screens ----------
  let howFrom = null;
  function openHow(from) {
    howFrom = from;
    el.how.hidden = false;
    if (from === 'pause') el.pause.hidden = true;
    el.howClose.focus({ preventScroll: true });
  }
  function closeHow() {
    if (el.how.hidden) return false;
    el.how.hidden = true;
    if (howFrom === 'pause' && pausedNow) {
      el.pause.hidden = false;
      el.resume.focus({ preventScroll: true });
    } else if (howFrom === 'title' && !el.title.hidden) {
      el.howBtn.focus({ preventScroll: true });
    }
    howFrom = null;
    return true;
  }
  let pausedNow = false;
  function setPaused(p) {
    pausedNow = Boolean(p);
    el.pause.hidden = !pausedNow || !el.how.hidden && howFrom === 'pause';
    if (!pausedNow && howFrom === 'pause') { el.how.hidden = true; howFrom = null; }
    if (pausedNow) el.resume.focus({ preventScroll: true });
  }
  function showTitle(on, { best = 'No journey home yet', resume = null } = {}) {
    el.title.hidden = !on;
    if (on) {
      put(el.best, best);
      el.cont.hidden = !resume;
      if (resume) put(el.cont, `Continue (Chapter ${ROMAN[resume.chapter] || resume.chapter + 1})`);
      show(el.hud, false);
    }
  }
  function showGraphicsError(on) {
    el.graphics.hidden = !on;
    if (on) el.title.hidden = true;
  }
  // Which full-screen card is up: 'graphics' | 'how' | 'pause' | 'title' | null.
  function modal() {
    if (!el.graphics.hidden) return 'graphics';
    if (!el.how.hidden) return 'how';
    if (!el.pause.hidden) return 'pause';
    if (!el.title.hidden) return 'title';
    return null;
  }

  function setSound(onOff) {
    attr(el.soundBtn, 'aria-pressed', onOff ? 'true' : 'false');
    attr(el.soundBtn, 'aria-label', onOff ? 'Sound on. Turn it off' : 'Sound off. Turn it on');
    markSetting('sound', onOff ? 'on' : 'off');
  }
  function markSetting(name, value) {
    for (const b of doc.querySelectorAll(`[data-set="${name}"]`)) {
      b.setAttribute('aria-pressed', b.dataset.value === value ? 'true' : 'false');
    }
  }
  function setSettings(s) {
    markSetting('captions', s.captions);
    markSetting('thrust', s.thrust);
    markSetting('hints', s.hints ? 'on' : 'off');
  }

  // ---------- per-journey memory ----------
  let mode = 'desktop', touch = false;
  let earthQueue = [], earthShownAt = 0, earthOn = false;
  let infoText = '', infoFlashAt = -1e9;
  let capId = null, capTiming = null, capChunk = -1, capWord = -1, capSpans = [];
  let cardKey = null, lensKey = null, lensWantAt = -1, frameNo = 0;
  const lensCache = new Map();
  let legKey = null, legZones = [], legStarts = [], legTotal = 1;
  let homeResult = null, newBest = false, lastLost = null, panesLeft = 3;
  let stampKey = null, endKey = null;

  function reset() {
    earthQueue = []; earthOn = false; show(el.earth, false);
    capId = null; capChunk = -1; capWord = -1; el.caption.textContent = ''; texts.delete(el.caption);
    cardKey = null; lensKey = null; lensCache.clear();
    legKey = null; homeResult = null; newBest = false; lastLost = null; stampKey = null; endKey = null;
  }

  // ---------- events ----------
  function onEvent(ev, state) {
    switch (ev.type) {
      case 'say':
        if (ev.item && ev.item.text) el.say.textContent = ev.item.text;
        break;
      case 'milestone': {
        const m = MILESTONES.find((x) => x.id === ev.id);
        earthQueue.push({ text: ev.text, when: m ? milestoneWhen(m, state.today) : '' });
        if (earthQueue.length > 4) earthQueue.splice(0, earthQueue.length - 4);
        break;
      }
      case 'home':
        homeResult = ev.result;
        break;
      case 'lost':
        lastLost = ev;
        break;
      case 'chapter':
        if (ev.retry || ev.fresh || ev.resumed) { lastLost = null; homeResult = null; }
        break;
      default:
        break;
    }
  }
  // After the best save: whether this run set a new best (the score card shows NEW BEST).
  function setResult({ isNew } = {}) {
    newBest = Boolean(isNew);
    endKey = null;
  }

  // ---------- captions ----------
  function drawCaption(say) {
    const item = say && say.current;
    if (!item) {
      if (capId !== null) {
        capId = null; capChunk = -1; capWord = -1; capSpans = [];
        el.caption.textContent = '';
      }
      return;
    }
    if (item.id !== capId) {
      capId = item.id;
      const fast = timings(item.chunks, false), slow = timings(item.chunks, true);
      // the engine timed it with the setting of the moment it was said: pick the matching timing
      const isSlow = Math.abs(slow.total + CAPTION_TAIL * SLOW - item.dur)
        < Math.abs(fast.total + CAPTION_TAIL - item.dur);
      capTiming = isSlow ? slow : fast;
      capChunk = -1; capWord = -1;
    }
    const w = wordAt(capTiming, finite(say.t) ? say.t : 0);
    if (w.chunk < 0) return;
    if (w.chunk !== capChunk) {
      capChunk = w.chunk; capWord = -1;
      const words = String(item.chunks[w.chunk] || '').split(/\s+/u).filter(Boolean);
      const frag = doc.createDocumentFragment();
      capSpans = words.map((text, i) => {
        if (i > 0) frag.appendChild(doc.createTextNode(' '));
        const s = doc.createElement('span');
        s.textContent = text;
        frag.appendChild(s);
        return s;
      });
      el.caption.replaceChildren(frag);
    }
    if (w.word !== capWord) {
      if (capSpans[capWord]) capSpans[capWord].classList.remove('now');
      capWord = w.word;
      if (capSpans[capWord]) capSpans[capWord].classList.add('now');
    }
  }

  // ---------- the top row, clocks and info ----------
  function drawTop(state) {
    const ph = state.phase;
    if (ph === 'ending') {
      put(el.chapterName, 'Home');
      put(el.count, ' · 15/15');
    } else {
      const c = CHAPTERS[state.chapter] || CHAPTERS[0];
      put(el.chapterName, c.title);
      put(el.count, ` · ${Math.min(state.stop + 1, STOPS.length)}/${STOPS.length}`);
    }
    const short = mode !== 'desktop';
    put(el.clockYou, `YOU ${fmt.shipClock(state.clocks.ship)}`);
    const ahead = state.clocks.aheadLy;
    let earth = `EARTH ${fmt.earthDate(ahead, state.today, { short })}`;
    if (state.chapter === CHAPTERS.length - 1 && ph !== 'ending' && ph !== 'title') {
      const radio = state.clocks.radio;
      earth += radio === null || radio === undefined ? ' · RADIO SILENT' : ` · RADIO ${radio}`;
    }
    put(el.clockEarth, earth);
  }

  function infoFor(state) {
    const ph = state.phase;
    if (ph === 'ending' || ph === 'title' || ph === 'lost') return '';
    if (ph === 'flight' && state.flight) {
      const za = zoneAt(state);
      if (za && za.zone.info) return za.zone.info;
    }
    if (ph === 'chapter') return CHAPTERS[state.chapter].info;
    const stop = STOPS[state.stop];
    return (stop && stop.info) || CHAPTERS[state.chapter].info;
  }

  function drawInfo(state, now) {
    const text = infoFor(state);
    if (text !== infoText) {
      infoText = text;
      infoFlashAt = now;
    }
    show(el.info, Boolean(text));
    if (text) put(el.info, text);
    cls(el.info, 'flash', now - infoFlashAt < INFO_FLASH_MS);
    // On Earth cards, one at a time
    if (earthOn) {
      const age = now - earthShownAt;
      if (age > EARTH_CARD_MS || (earthQueue.length && age > EARTH_CARD_MIN)) {
        earthOn = false;
        show(el.earth, false);
      }
    }
    if (!earthOn && earthQueue.length && PLAY.has(state.phase)) {
      const card = earthQueue.shift();
      put(el.earthText, card.text);
      put(el.earthWhen, card.when);
      earthOn = true;
      earthShownAt = now;
      show(el.earth, true);
    }
    if (state.phase === 'ending' && earthOn) { earthOn = false; show(el.earth, false); earthQueue = []; }
  }

  // ---------- chips, card, fork ----------
  function drawScan(state, ctx) {
    const ph = state.phase;
    const scanning = ph === 'clue' || ph === 'scan';
    const sc = scanning ? scanOf(state) : null;
    show(el.chips, scanning);
    cls(el.hud, 'chips-on', scanning);
    if (sc) {
      const hintLetter = state.scan.hint ? sc.target : state.scan.teach ? 'A' : null;
      for (const chip of chipEls) {
        const L = chip.dataset.letter;
        const grey = sc.tried.includes(L);
        cls(chip, 'grey', grey);
        cls(chip, 'open', sc.open === L);
        cls(chip, 'pulse', !grey && hintLetter === L && sc.open !== L);
        if (chip.disabled !== grey) chip.disabled = grey;
        const c = sc.candidates.find((x) => x.letter === L);
        const ship = ctx.cam && ctx.cam.ship;
        const d = c && ship ? distanceText(distanceLy(ship, c.id)) : '';
        attr(chip, 'aria-label', `Candidate ${L}${d ? `, ${d} away` : ''}${grey ? ', ruled out' : ''}`);
        attr(chip, 'aria-pressed', sc.open === L ? 'true' : 'false');
      }
    }
    show(el.hint, Boolean(sc && state.scan.teach && !sc.open));
    // the card
    const open = ph === 'scan' && sc && sc.open ? sc.candidates.find((c) => c.letter === sc.open) : null;
    show(el.card, Boolean(open));
    if (open) {
      const key = `${sc.id}:${open.letter}:${open.id}`;
      if (key !== cardKey) {
        cardKey = key;
        const ship = ctx.cam && ctx.cam.ship;
        put(el.cardTitle, ship ? `${open.letter} · ${distanceText(distanceLy(ship, open.id))}` : open.letter);
        fillFacts(open.facts || []);
        attr(el.card, 'aria-label', `Candidate ${open.letter}`);
        setLens(null);
        lensKey = `${sc.id}:${open.id}`;
        lensWantAt = frameNo + 1;   // render the telescope view on the next frame, after the card shows
      }
      if (lensWantAt >= 0 && frameNo >= lensWantAt) {
        lensWantAt = -1;
        let shot = lensCache.get(lensKey);
        if (shot === undefined && on.lens) {
          try { shot = on.lens(open.id, LENS_PX) || null; } catch { shot = null; }
          lensCache.set(lensKey, shot);
        }
        setLens(shot || null);
      }
    } else {
      cardKey = null;
      lensWantAt = -1;
    }
    // the fork
    const forking = ph === 'fork';
    show(el.fork, forking);
    if (forking) {
      const f = STOPS[state.stop].fork;
      if (f) {
        put(el.forkTitle, f.prompt);
        put($('fork-sheet'), f.sheet.label);
        put($('fork-sheet-note'), f.sheet.note);
        put($('fork-void'), f.void.label);
        put($('fork-void-note'), f.void.note);
      }
    }
  }

  function fillFacts(facts) {
    factEls.forEach((li, i) => {
      const text = facts[i] || '';
      li.replaceChildren();
      li.hidden = !text;
      if (!text) return;
      for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s?K\b/g)) {
        const T = Number(m[1].replace(/,/g, ''));
        if (!(T > 0)) continue;
        const sw = doc.createElement('i');
        sw.className = 'swatch';
        sw.style.background = swatchColour(T);
        sw.setAttribute('aria-hidden', 'true');
        li.appendChild(sw);
      }
      const span = doc.createElement('span');
      span.textContent = text;
      li.appendChild(span);
    });
  }

  // Put a canvas (or nothing) in the telescope slot.
  function setLens(canvas) {
    const slot = el.lens;
    const current = slot.querySelector('canvas');
    if (canvas && current === canvas) return;
    if (current) current.remove();
    const empty = slot.querySelector('.lens-empty');
    if (canvas) {
      canvas.setAttribute('aria-hidden', 'true');
      slot.appendChild(canvas);
      if (empty) empty.hidden = true;
    } else if (empty) {
      empty.hidden = false;
    }
  }

  // ---------- chapter, lost and end cards; the ending's stamps ----------
  function drawCards(state) {
    const ph = state.phase;
    const chapter = ph === 'chapter';
    show(el.chapterCard, chapter);
    if (chapter) {
      const ended = CHAPTERS[state.chapter - 1] || CHAPTERS[0];
      const next = CHAPTERS[state.chapter];
      put(el.chapterEyebrow, `${ended.title} · done`);
      put(el.chapterTitle, `Next: ${next.title}`);
      put(el.chapterLine, ended.end || '');
      put(el.chapterPanes, `Shield: ${state.panes} of 3 panes. Each chapter brings one back. Your place is saved.`);
      put(el.chapterScore, `Score ${groupDigits(shownScore(state))}`);
    }
    const lostQuiet = ph === 'lost' && !state.say.current && state.say.queue.length === 0;
    show(el.lostCard, lostQuiet);
    if (lostQuiet) {
      const stop = STOPS[state.stop];
      const name = lastLost ? lastLost.name : (OBJECTS[stop.id] || {}).name || stop.id;
      put(el.lostTitle, `Lost on the way to ${name}`);
      put(el.lostLine, `Score ${groupDigits(shownScore(state))}. Try the chapter again with a whole shield, `
        + 'or start a new journey.');
    }
    const done = ph === 'ending' && state.ending && state.ending.done;
    show(el.endCard, done);
    if (done) drawEndCard(state);
    // the ending's big lines: the date at 'today', the two clocks at 'clocks'
    const beat = ph === 'ending' && state.ending ? ENDING_BEATS[state.ending.beat] : null;
    const stamp = beat === 'today' || beat === 'clocks' ? beat : null;
    show(el.stamp, Boolean(stamp));
    if (stamp !== stampKey) {
      stampKey = stamp;
      el.stamp.replaceChildren();
      const add = (cl, text) => {
        const p = doc.createElement('p');
        p.className = cl;
        p.textContent = text;
        el.stamp.appendChild(p);
      };
      if (stamp === 'today') {
        const a = arrivalText(state.today);
        add('small', 'Earth · today');
        add('big', a.weekday);
        add('big', a.date);
      } else if (stamp === 'clocks') {
        add('small', 'For you');
        add('big', shipWords(state.clocks.ship));
        add('small', 'For Earth');
        add('big', `${groupDigits(Math.floor(state.clocks.earth + 1e-9))} years`);
      }
    }
  }

  // Cracks take points, so a run can dip under 0; the cards (and the best save) never show less than 0.
  function shownScore(state) {
    return Math.max(0, Math.round(state.score.total));
  }

  function shipWords(years) {
    const y = Math.max(0, years);
    const whole = Math.floor(y), days = Math.floor((y - whole) * 365.25);
    const part = (n, w) => `${groupDigits(n)} ${w}${n === 1 ? '' : 's'}`;
    return whole ? `${part(whole, 'year')}, ${part(days, 'day')}` : part(days, 'day');
  }

  function drawEndCard(state) {
    const key = `${state.score.total}:${newBest}`;
    if (key === endKey) return;
    endKey = key;
    const r = homeResult || {};
    put(el.endEyebrow, `Home · ${arrivalText(state.today).date}`);
    put(el.endScore, groupDigits(shownScore(state)));
    put(el.endRank, r.rank || '');
    el.endBest.hidden = !newBest;
    const s = state.stats;
    const rows = [
      ['First-try finds', `${s.firstTry} of 17`],
      ['Cracks', String(s.cracks)],
      ['Ship time', fmt.shipClock(state.clocks.ship)],
      ['Top speed', topSpeedText(s.topEta)],
      ['Retries', String(s.retries)],
    ];
    el.endStats.replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = doc.createElement('dt'); dt.textContent = k;
      const dd = doc.createElement('dd'); dd.textContent = v;
      return [dt, dd];
    }));
    const straight = Math.round(straightLineLy() / 1e6) * 1e6;
    put(el.endRoute, `Straight home: ${groupDigits(straight)} ly. `
      + `Your landmark route: ${groupDigits(Math.floor(ROUTE_LY))} ly.`);
  }

  // ---------- the flight strip ----------
  function buildRoute(state) {
    const leg = legOf(state);
    const key = `${leg.stop}:${leg.branch}`;
    if (key === legKey) return;
    legKey = key;
    legZones = leg.zones;
    legStarts = [];
    let t = 0;
    for (const z of legZones) { legStarts.push(t); t += z.screen; }
    legTotal = t || 1;
    el.segs.replaceChildren(...legZones.map((z) => {
      const i = doc.createElement('i');
      i.style.flex = `${z.screen} 1 0`;
      if (z.dropout) i.className = 'dropout';
      else if (z.kind === 'waypoint' || z.n >= 0.1) i.className = 'hazard';
      i.title = z.label;
      return i;
    }));
  }

  function drawStrip(state) {
    const f = state.flight;
    const flying = state.phase === 'flight' && f;
    show(el.strip, Boolean(flying));
    if (!flying) return;
    buildRoute(state);
    const za = zoneAt(state);
    put(el.shortfall, fmt.shortfall(f.eta));
    put(el.rate, fmt.timeRate(f.eta));
    setVar(el.throttle, '--x', clamp(f.x, 0, 1));
    setVar(el.throttle, '--heat', clamp(f.heat, 0, 1));
    if (za) setVar(el.throttle, '--notch', clamp(za.notchX, 0, 1));
    const next = za && f.soon && za.nextNotchX !== null && !za.dropout && !(legZones[za.index + 1] || {}).dropout;
    show(el.nextWrap, next);
    if (next) setVar(el.throttle, '--next', clamp(za.nextNotchX, 0, 1));
    show(el.hot, f.heat > HEAT_HIGH);
    attr(el.throttle, 'aria-valuenow', Math.round(f.x * 100));
    const k = za ? za.index : 0;
    const pos = za ? (legStarts[k] + clamp(f.p, 0, 1) * legZones[k].screen) / legTotal : 0;
    setVar(el.route, '--route', clamp(pos, 0, 1), 0.0005);
    drawPanes(state.panes);
  }

  function drawPanes(n) {
    if (n === panesLeft) return;
    panesLeft = n;
    paneEls.forEach((p, i) => p.classList.toggle('cracked', i >= n));
    attr(el.panes, 'aria-label', `${n} ${n === 1 ? 'pane' : 'panes'} left`);
  }

  // ---------- layout ----------
  function updateMode() {
    const W = doc.documentElement.clientWidth || innerWidth, H = doc.documentElement.clientHeight || innerHeight;
    mode = layoutMode(W, H);
    if (el.hud.dataset.layout !== mode) el.hud.dataset.layout = mode;
    return mode;
  }

  // The panel's height for the caption rule on phones held upright (the caption sits above the open sheet).
  let panelH = -1;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measurePanel()) : null;
  if (ro) for (const c of el.panel.children) ro.observe(c);
  function measurePanel() {
    let h = 0;
    for (const c of el.panel.children) if (!c.hidden) h = Math.max(h, c.offsetHeight);
    if (h !== panelH) {
      panelH = h;
      el.hud.style.setProperty('--panel-h', `${h}px`);
    }
  }

  const rectOf = (node) => {
    if (!node || node.hidden || el.hud.hidden) return null;
    const r = node.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const union = (list) => {
    const rs = list.filter(Boolean);
    if (!rs.length) return null;
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
    const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  // { mode, rects: { top, clock, caption, card, chips, strip } } in CSS px; a hidden box is null. card is whichever
  // card the panel shows (scan card, fork, chapter, lost or score card).
  function layout() {
    updateMode();
    const panelCard = [...el.panel.children].find((c) => !c.hidden) || null;
    const capRect = el.caption.textContent ? rectOf(el.caption) : null;
    return {
      mode,
      rects: {
        top: union([rectOf(el.top.querySelector('.back')), rectOf(el.where), rectOf(el.top.querySelector('.buttons'))]),
        clock: rectOf(el.clock),
        caption: capRect,
        card: rectOf(panelCard),
        chips: el.chips.hidden ? null : union(chipEls.map(rectOf)),
        strip: rectOf(el.strip),
      },
    };
  }

  // ---------- the frame ----------
  // ctx: { cam (geo.cameraFor result) }. The HUD's own timers (On Earth cards, the landscape info flash) run on
  // game time, so they hold while paused.
  let clockBase = 0, lastGameT = 0;
  // Returns true when a box was shown or hidden, so the caller measures the layout again.
  function frame(state, ctx = {}) {
    frameNo++;
    changed = false;
    if (!state) return false;
    const t = finite(state.t) ? state.t : 0;
    if (t < lastGameT) { clockBase += lastGameT * 1000; }   // a new journey starts its clock at 0 again
    lastGameT = t;
    const now = clockBase + t * 1000;
    const playing = state.phase !== 'title';
    show(el.hud, playing);
    if (!playing) return changed;
    if (el.hud.dataset.phase !== state.phase) el.hud.dataset.phase = state.phase;
    drawTop(state);
    drawInfo(state, now);
    drawCaption(state.say);
    drawScan(state, ctx);
    drawCards(state);
    drawStrip(state);
    if (!ro) measurePanel();
    return changed;
  }

  function setTouch(t) {
    touch = Boolean(t);
    doc.body.classList.toggle('touch', touch);
  }

  updateMode();
  return {
    el, frame, onEvent, reset, layout, updateMode, showTitle, showGraphicsError, setPaused, openHow, closeHow, modal,
    setSound, setSettings, setResult, setTouch, setLens,
    get mode() { return mode; },
    // the card's SET COURSE button, so a keyboard Enter after picking lands on it
    focusCard() { if (!el.card.hidden) el.setCourse.focus({ preventScroll: true }); },
  };
}
