// EMBER TIDE — the campaign layer over the fighter-jet scene: screens, objectives, radio, saves.
import React from 'react'
import { createRoot } from 'react-dom/client'
import FighterJet from './src/components/fighter-jet-eject.js'
import { DEFAULT_PARAMS } from './src/lib/eject/scene.js'
import { ACTS, MISSIONS, UPGRADES, UPGRADE_MAX, UPGRADE_COST, LIVERIES } from './missions.js'
import { CUTSCENES, BEFORE, AFTER, REEL, drawFace } from './cutscenes.js'

// ───────────────────────────────────────────── settings shared by every sortie
const BASE = {
  altitude: 110, ceiling: 1500, jetScale: 0.6, view: 'chase', speed: 92, boost: 1.8, agility: 1.25,
  ammo: 300, missiles: 6, reload: 5, hullMax: 6, foeHp: 5, aceHp: 0, aceMissile: 8, wingmen: 0,
  enemies: 0, foeFire: true, weapons: true, crash: true, intro: true, land: 0.33,
}

// ───────────────────────────────────────────── save
const SAVE_KEY = 'ember-tide-save-v1'
const blank = () => ({ stars: {}, best: {}, upgrades: {}, livery: 'stock', seenIntro: false, seen: {} })
let save = blank()
try {
  const raw = localStorage.getItem(SAVE_KEY)
  if (raw) save = { ...blank(), ...JSON.parse(raw) }
} catch { /* no storage here: the campaign still plays, it just is not kept */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* as above */ } }

const starsEarned = () => MISSIONS.reduce((n, m) => n + (save.stars[m.id] || 0), 0)
const starsSpent = () => UPGRADES.reduce((n, u) => n + (save.upgrades[u.id] || 0) * UPGRADE_COST, 0)
const unlocked = (i) => i === 0 || (save.stars[MISSIONS[i - 1].id] || 0) > 0
const nextMission = () => { const i = MISSIONS.findIndex((m) => !save.stars[m.id]); return i < 0 ? MISSIONS.length - 1 : i }
const campaignDone = () => MISSIONS.every((m) => save.stars[m.id] > 0)
const liveryNow = () => { const l = LIVERIES.find((x) => x.id === save.livery); return l && starsEarned() >= l.need ? l : LIVERIES[0] }

// ───────────────────────────────────────────── tiny helpers
const h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag)
  for (const k in attrs || {}) {
    const v = attrs[k]
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'style') el.style.cssText = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid)
  return el
}
const clock = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s - m * 60)).padStart(2, '0')}` }
const starRow = (n, of = 3) => h('span', { class: 'stars', 'aria-label': `${n} of ${of} stars` }, Array.from({ length: of }, (_, i) => h('i', { class: i < n ? 'on' : '' }, '★')))
function mulberry(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// blips for the campaign's own moments (the scene has its own sound)
let ac = null
function blip(freqs, len = 0.09, vol = 0.07) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)()
    if (ac.state === 'suspended') ac.resume()
    freqs.forEach((f, i) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'square'
      o.frequency.value = f
      const t = ac.currentTime + i * len
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.6)
      o.connect(g).connect(ac.destination)
      o.start(t)
      o.stop(t + len * 1.7)
    })
  } catch { /* no sound is fine */ }
}

// ───────────────────────────────────────────── the scene, mounted under the screens
const root = createRoot(document.getElementById('game'))
const ui = document.getElementById('ui')
const live = { key: 0, props: {}, paused: false, back: false }
let scene = null
let screen = 'title' // title | board | brief | flight | pause | debrief | cut
let F = null // the sortie being flown

const sceneParams = () => {
  const out = { ...DEFAULT_PARAMS }
  const all = { ...BASE, ...live.props }
  for (const k in out) if (all[k] != null) out[k] = all[k]
  return out
}
function onScene(s, dt) {
  if (dt === undefined) { scene = s; return }
  if (F && screen === 'flight') tick(s, dt)
}
function renderGame() {
  root.render(React.createElement(FighterJet, {
    key: live.key, ...BASE, ...live.props, paused: live.paused, onScene,
    showHint: screen === 'flight' || screen === 'pause', radio: true,
  }))
}
function backdrop() {
  // behind the menus: the jet flying itself over the islands, with company
  const l = liveryNow()
  const act = MISSIONS[nextMission()].act
  live.key++
  live.props = {
    enemies: 0, weapons: false, wingmen: 2, intro: false, view: 'chase', crash: false, followPointer: false,
    timeOfDay: act === 1 ? 'day' : act === 2 ? 'sunset' : 'night', seed: 7 + act * 3, clouds: 0.45,
    bodyColor: l.colors[0], accentColor: l.colors[1], canopyColor: l.colors[2],
  }
  live.paused = false
  live.back = true
  F = null
  renderGame()
}

// ───────────────────────────────────────────── a sortie
function loadout(m) {
  const p = { ...BASE, ...m.scene }
  for (const u of UPGRADES) {
    const n = save.upgrades[u.id] || 0
    if (!n) continue
    if (m.fixedLoadout && (u.id === 'racks' || u.id === 'loader')) continue
    u.apply(p, n)
  }
  p.reload = Math.max(1.5, p.reload)
  const l = liveryNow()
  p.bodyColor = l.colors[0]
  p.accentColor = l.colors[1]
  p.canopyColor = l.colors[2]
  return p
}
function prepare(index) {
  const m = MISSIONS[index]
  live.key++
  live.props = loadout(m)
  live.paused = true
  live.back = false
  F = {
    index, m, si: -1, stage: null, t: 0, stageT: 0, spares: m.spares, lost: 0, kills: 0,
    base: { downed: 0, evades: 0, counters: 0 }, prog: 0, goal: 1, gates: [], gi: 0, near: 9e9,
    wasOut: false, over: '', overT: 0, why: '', radio: [], radioT: 0, said: null, flashT: 0, flash: '',
  }
  screen = 'brief'
  renderGame()
  showBrief()
}
function launch() {
  screen = 'flight'
  live.paused = false
  renderGame()
  buildHud()
  blip([440, 660])
  document.querySelector('#game [tabindex]')?.focus({ preventScroll: true })
}
function say(lines) { for (const l of lines || []) F.radio.push(l) }
function flashNote(text) { F.flash = text; F.flashT = 1.6 }

function makeGates(s, st) {
  const me = s.radar.me
  const rnd = mulberry(F.m.scene.seed * 97 + F.si * 13 + 5)
  const gates = []
  let x = me.x
  let y = me.y
  let yaw = me.yaw
  const cruise = live.props.altitude ?? BASE.altitude
  for (let i = 0; i < st.n; i++) {
    if (i > 0) yaw += (rnd() * 2 - 1) * (st.turn ?? 0.8)
    const d = i === 0 ? 560 : st.spacing ?? 440
    x += Math.sin(yaw) * d
    y -= Math.cos(yaw) * d
    const low = st.alt === 'low' || (st.alt === 'mix' && i % 2 === 1)
    if (low) {
      // a low gate wants open water under it: carry on along the line until there is some
      for (let k = 0; k < 8 && s.groundAt(x, y) > 2; k++) { x += Math.sin(yaw) * 55; y -= Math.cos(yaw) * 55 }
    }
    const g = s.groundAt(x, y)
    gates.push({ x, y, z: low ? g + 18 : Math.max(cruise, g + 45), r: st.r ?? 48, low })
  }
  return gates
}

function startStage(s, si) {
  const st = F.m.stages[si]
  F.si = si
  F.stage = st
  F.stageT = 0
  F.prog = 0
  if (st.set) {
    live.props = { ...live.props, ...st.set }
    s.setParams(sceneParams())
    renderGame()
  }
  if (st.type === 'ace' || st.respawn) s.respawnFoes()
  const did = s.did
  F.base = { downed: did.downed || 0, evades: s.evades, counters: s.counters }
  F.goal = st.n ?? st.secs ?? 1
  if (st.type === 'gates') { F.gates = makeGates(s, st); F.gi = 0 }
  else s.setBeacon(null)
  say(st.radio)
  if (si > 0) blip([523, 659, 784])
}

function finish(result, why) {
  if (F.over) return
  F.over = result
  F.why = why || ''
  F.overT = result === 'win' ? 2.4 : 2.8
  scene?.setBeacon(null)
  blip(result === 'win' ? [523, 659, 784, 1047] : [330, 262, 196], 0.14)
}

let lastDowned = 0
function tick(s, dt) {
  // the radio runs whatever else is going on
  if (F.radioT > 0) F.radioT -= dt
  if (F.radioT <= 0 && F.radio.length) { F.said = F.radio.shift(); F.radioT = 2.2 + F.said[1].length * 0.045; blip([880], 0.04, 0.03) }
  else if (F.radioT <= 0) F.said = null
  if (F.flashT > 0) F.flashT -= dt

  if (F.over) {
    F.overT -= dt
    if (F.overT <= 0) debrief()
    drawHud(s)
    return
  }
  if (F.si < 0) {
    if (s.ready) { lastDowned = s.did.downed || 0; startStage(s, 0) }
    drawHud(s)
    return
  }
  const st = F.stage
  const did = s.did
  F.t += dt
  F.stageT += dt
  if ((did.downed || 0) > lastDowned) { F.kills += did.downed - lastDowned; lastDowned = did.downed }

  // a jet lost: a spare comes, while there is one
  if (did.out && !F.wasOut) {
    F.lost++
    if (F.spares > 0) { F.spares--; say([['Lantern', F.spares ? 'Jet lost. Spare is inbound, hang on.' : 'Jet lost. That was the last spare, Gull.']]) }
    else return finish('fail', 'No jets left on the line')
  }
  F.wasOut = did.out

  if (st.type === 'gates') {
    const g = F.gates[F.gi]
    const me = s.radar.me
    s.setBeacon(g)
    const flat = Math.hypot(g.x - me.x, g.y - me.y)
    const dz = me.z - g.z
    if (flat < g.r) {
      if (g.low ? dz < 30 : Math.abs(dz) < 60) {
        F.gi++
        F.prog = F.gi
        blip([988, 1319], 0.06)
        if (F.gi >= F.gates.length) s.setBeacon(null)
      } else if (F.flashT <= 0) flashNote(dz > 0 ? 'Too high' : 'Too low')
    }
    F.near = flat
  } else if (st.type === 'skim') {
    if (!did.out && did.height < (st.below ?? 30)) F.prog += dt
  } else if (st.type === 'kills') F.prog = (did.downed || 0) - F.base.downed
  else if (st.type === 'evade') F.prog = s.evades - F.base.evades
  else if (st.type === 'counter') F.prog = s.counters - F.base.counters
  else if (st.type === 'survive') F.prog = F.stageT
  else if (st.type === 'ace') {
    const ace = s.radar.foes[0]
    // (the ace is gone once it is no longer flying, after it has had a moment to appear)
    if (F.stageT > 0.5 && ace && ace.state !== 0) F.prog = 1
  }

  if (F.prog >= F.goal) {
    if (F.si + 1 < F.m.stages.length) startStage(s, F.si + 1)
    else finish('win')
  } else if (st.limit && F.stageT >= st.limit) finish('fail', 'Out of time')
  drawHud(s)
}

// ───────────────────────────────────────────── flight HUD
let hud = null
function buildHud() {
  ui.replaceChildren()
  const el = (cls, ...kids) => h('div', { class: cls }, ...kids)
  hud = {
    title: el('hud-title'), label: el('hud-label'), count: el('hud-count'), bar: h('i'), time: el('hud-time'),
    jets: el('hud-jets'), radio: el('radio'), who: h('b'), line: h('span'), banner: el('banner'),
    boss: el('boss'), bossBar: h('i'), bossName: h('b'), note: el('gate-note'), sig: '',
  }
  hud.radio.append(hud.who, hud.line)
  hud.boss.append(hud.bossName, h('span', { class: 'track' }, hud.bossBar))
  const pause = h('button', { class: 'chip', type: 'button', onclick: () => setPause(true) }, 'Pause · P')
  ui.append(
    el('hud', el('hud-row', hud.title, pause), hud.label, el('hud-row', hud.count, hud.time), h('span', { class: 'track' }, hud.bar), hud.jets),
    hud.boss, hud.note, hud.banner, hud.radio,
  )
  hud.title.textContent = `${String(F.index + 1).padStart(2, '0')} · ${F.m.title}`
}
function drawHud(s) {
  if (!hud) return
  const st = F.stage
  let label = 'Stand by'
  let count = ''
  let frac = 0
  let time = clock(F.t)
  if (st) {
    label = st.label
    frac = Math.min(1, F.prog / F.goal)
    if (st.type === 'gates') { const g = F.gates[Math.min(F.gi, F.gates.length - 1)]; count = `Gate ${Math.min(F.gi + 1, F.goal)}/${F.goal}${g.low ? ' · low' : ''} · ${Math.round(F.near)} m` }
    else if (st.type === 'skim' || st.type === 'survive') count = `${Math.floor(Math.min(F.prog, F.goal))}/${F.goal} s`
    else if (st.type === 'ace') count = st.name
    else count = `${Math.min(F.prog, F.goal)}/${F.goal}`
    if (st.limit) time = `−${clock(st.limit - F.stageT)}`
  }
  const urgent = st && st.limit && st.limit - F.stageT < 15
  const said = F.said
  const ace = st && st.type === 'ace' ? s.radar.foes[0] : null
  const bossFrac = ace ? Math.max(0, ace.state === 0 ? ace.hp / st.hp : 0) : -1
  const sig = [label, count, Math.round(frac * 100), time, F.spares, urgent, said && said[1], F.over, Math.round(bossFrac * 50), F.flashT > 0 ? F.flash : ''].join('|')
  if (sig === hud.sig) return
  hud.sig = sig
  hud.label.textContent = label
  hud.count.textContent = count
  hud.bar.style.width = `${frac * 100}%`
  hud.time.textContent = time
  hud.time.classList.toggle('urgent', !!urgent)
  hud.jets.textContent = `Jets ${'▲'.repeat(F.spares + 1)}${'△'.repeat(F.m.spares - F.spares)}`
  hud.radio.classList.toggle('show', !!said)
  if (said) { hud.who.textContent = said[0]; hud.line.textContent = said[1]; hud.radio.dataset.who = said[0] }
  hud.boss.classList.toggle('show', bossFrac >= 0)
  if (bossFrac >= 0) { hud.bossName.textContent = st.name; hud.bossBar.style.width = `${bossFrac * 100}%` }
  hud.note.textContent = F.flashT > 0 ? F.flash : ''
  hud.banner.classList.toggle('show', !!F.over)
  hud.banner.classList.toggle('fail', F.over === 'fail')
  if (F.over) hud.banner.replaceChildren(h('b', null, F.over === 'win' ? 'Sortie complete' : 'Sortie failed'), F.why ? h('span', null, F.why) : '')
}

// ───────────────────────────────────────────── screens
const panel = (cls, ...kids) => h('div', { class: 'veil' }, h('div', { class: `panel ${cls}` }, ...kids))
const btn = (text, onclick, cls = '') => h('button', { type: 'button', class: `btn ${cls}`, onclick }, text)
// (in the arcade a Switch game button opens the list of cabinets; the arcade's script wires it)
const switchBtn = () => h('button', { type: 'button', class: 'btn', 'data-switch': true }, 'Switch game')
function show(node) { hud = null; ui.replaceChildren(node); window.GameSwitch?.wire(); node.querySelector('[data-first]')?.focus({ preventScroll: true }) }

function showTitle() {
  screen = 'title'
  const fresh = starsEarned() === 0 && !save.seenIntro
  const go = btn(fresh ? 'Begin campaign' : 'Continue', () => (blip([440, 660]), fresh ? playCut('intro', () => { save.seenIntro = true; persist(); showBoard() }) : showBoard()), 'primary')
  go.dataset.first = ''
  show(panel('title',
    h('p', { class: 'kicker' }, 'A campaign in three acts'),
    h('h1', null, 'Ember Tide'),
    h('p', { class: 'lede' }, 'Thirty islands, three jets, one very long week.'),
    h('div', { class: 'row' }, go, !fresh && btn('New campaign', () => {
      if (!confirm('Start again? Stars, upgrades and paint will be cleared.')) return
      save = blank(); persist(); backdrop(); showTitle()
    }), switchBtn()),
    h('p', { class: 'fine' }, 'Pointer or WASD to fly · click to roll · hold left mouse or Shift for thrusters · right mouse cannon · M missile · Space view · P pause. Gamepad and touch work too.'),
  ))
}

// ───────────────────────────────────────────── cutscenes
// A short film on the scene itself: the jet flies on its own behind black bars while the lines are
// typed out. Click, Space or Enter hurries it along; Escape (or Skip) ends it.
const CUT_BASE = {
  enemies: 0, weapons: false, wingmen: 0, intro: false, crash: false, followPointer: false, view: 'chase',
  grain: 0.18, vignette: 0.55,
}
const TYPE_RATE = 46 // letters a second
const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let cut = null

/** the sortie is entered by way of its cutscene, the first time */
function enter(i) {
  const id = BEFORE[MISSIONS[i].id]
  if (id && !save.seen[id]) playCut(id, () => prepare(i))
  else prepare(i)
}

function playCut(id, then) {
  const c = CUTSCENES[id]
  screen = 'cut'
  F = null
  const face = h('canvas', { class: 'cine-face', width: 16, height: 16 })
  const el = {
    face, who: h('b'), text: h('span'), more: h('i', { class: 'cine-more' }, '▼'),
    card: h('div', { class: 'cine-card' }), fade: h('div', { class: 'cine-fade' }),
  }
  const say = h('div', { class: 'cine-say' }, face, h('p', null, el.who, el.text, el.more))
  el.say = say
  const node = h('div', { class: 'cine', onclick: (e) => { if (!e.target.closest('button')) hurryCut() } },
    h('div', { class: 'cine-bar top' }, h('span', { class: 'cine-name' }, c.title)),
    h('div', { class: 'cine-bar bottom' }, say),
    el.card, el.fade,
    h('button', { type: 'button', class: 'chip cine-skip', onclick: () => endCut() }, 'Skip · Esc'),
    h('p', { class: 'cine-hint' }, 'Click or Space to carry on'),
  )
  show(node)
  document.body.classList.add('cine-on') // the scene is fitted between the bars
  cut = { id, c, then, el, si: -1, li: -1, phase: 'out', t: 0, typed: 0, dark: 1, last: performance.now(), ending: false }
  el.fade.style.opacity = 1
  requestAnimationFrame(cutFrame)
}

function cutShot() {
  const k = cut
  k.si++
  k.li = -1
  const shot = k.c.shots[k.si]
  if (!shot) { k.ending = true; k.phase = 'out'; k.t = 0; return }
  if (shot.scene) {
    const l = liveryNow()
    live.key++
    live.props = { ...CUT_BASE, bodyColor: l.colors[0], accentColor: l.colors[1], canopyColor: l.colors[2], ...shot.scene }
    live.paused = false
    live.back = false
    renderGame()
  } else if (shot.move) {
    live.props = { ...live.props, ...shot.move }
    renderGame()
  }
  k.el.say.classList.remove('show')
  k.el.card.classList.toggle('show', !!shot.card)
  if (shot.card) k.el.card.replaceChildren(h('p', null, shot.card.kicker), h('h1', null, shot.card.title))
  k.phase = shot.scene || k.dark > 0 ? 'in' : shot.card ? 'card' : 'line'
  k.t = 0
  if (k.phase === 'line') cutLine()
}
function cutLine() {
  const k = cut
  const shot = k.c.shots[k.si]
  k.li++
  const line = shot.lines && shot.lines[k.li]
  if (!line) { k.phase = 'next'; k.t = 0; return }
  k.phase = 'line'
  k.t = 0
  k.typed = calm ? line[1].length : 0
  const has = drawFace(k.el.face, line[0])
  k.el.face.hidden = !has
  k.el.who.textContent = line[0]
  k.el.who.hidden = !line[0]
  k.el.say.dataset.who = line[0]
  k.el.say.classList.add('show')
  k.el.card.classList.remove('show')
  k.el.text.textContent = line[1].slice(0, k.typed)
  blip([line[0] ? 740 : 520], 0.04, 0.025)
}
/** click, Space, Enter: finish the line being typed, or move to the next thing */
function hurryCut() {
  const k = cut
  if (!k || k.ending) return
  if (k.phase === 'line') {
    const line = k.c.shots[k.si].lines[k.li]
    if (k.typed < line[1].length) { k.typed = line[1].length; k.el.text.textContent = line[1]; k.t = 0 }
    else cutLine()
  } else if (k.phase === 'card') { k.el.card.classList.remove('show'); cutLine() }
}
function endCut() {
  const k = cut
  if (!k) return
  cut = null
  document.body.classList.remove('cine-on')
  save.seen[k.id] = true
  persist()
  k.then()
}
function cutFrame(now) {
  const k = cut
  if (!k) return
  const dt = Math.min(0.1, (now - k.last) / 1000)
  k.last = now
  k.t += dt
  if (k.phase === 'out') {
    // to black; then the next shot, or the end
    k.dark = Math.min(1, k.dark + dt / 0.35)
    if (k.dark >= 1) { if (k.ending) return endCut(); cutShot() }
  } else if (k.phase === 'in') {
    // (a moment in the dark while the new scene finds its feet)
    if (k.t > 0.25) k.dark = Math.max(0, k.dark - dt / 0.5)
    if (k.dark <= 0) { k.phase = k.c.shots[k.si].card ? 'card' : 'line'; k.t = 0; if (k.phase === 'line') cutLine() }
  } else if (k.phase === 'card') {
    if (k.t > 2.6) { k.el.card.classList.remove('show'); cutLine() }
  } else if (k.phase === 'line') {
    const line = k.c.shots[k.si].lines[k.li]
    if (k.typed < line[1].length) {
      k.typed = Math.min(line[1].length, k.typed + dt * TYPE_RATE)
      k.el.text.textContent = line[1].slice(0, Math.floor(k.typed))
      if (k.typed >= line[1].length) k.t = 0
    } else if (k.t > 1.7 + line[1].length * 0.032) cutLine()
    k.el.more.classList.toggle('on', k.typed >= line[1].length)
  } else if (k.phase === 'next') {
    const coming = k.c.shots[k.si + 1]
    if (!coming) { k.ending = true; k.phase = 'out'; k.t = 0 }
    else if (coming.scene) { k.phase = 'out'; k.t = 0 }
    else cutShot()
  }
  if (cut === k) { k.el.fade.style.opacity = k.dark; requestAnimationFrame(cutFrame) }
}

function showBoard() {
  screen = 'board'
  if (!live.back) backdrop()
  const earned = starsEarned()
  const free = earned - starsSpent()
  const next = nextMission()
  const acts = ACTS.map((a) => h('section', { class: 'act' },
    h('header', null, h('b', null, a.name), h('span', null, a.title)),
    h('p', { class: 'blurb' }, a.blurb),
    h('div', { class: 'cards' }, MISSIONS.map((m, i) => {
      if (m.act !== a.id) return null
      const open = unlocked(i)
      const card = h('button', {
        type: 'button', class: `card${open ? '' : ' locked'}${i === next && !campaignDone() ? ' next' : ''}`, disabled: !open,
        onclick: () => enter(i),
      },
        h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'name' }, open ? m.title : 'Locked'),
        open ? starRow(save.stars[m.id] || 0) : h('span', { class: 'stars dim' }, '· · ·'),
        open && save.best[m.id] ? h('span', { class: 'best' }, clock(save.best[m.id])) : null,
      )
      if (i === next) card.dataset.first = ''
      return card
    })),
  ))
  const hangar = h('section', { class: 'hangar' },
    h('header', null, h('b', null, 'Hangar'), h('span', null, `${free} ★ to spend · ${earned}/${MISSIONS.length * 3} earned`)),
    h('div', { class: 'ups' }, UPGRADES.map((u) => {
      const n = save.upgrades[u.id] || 0
      const can = n < UPGRADE_MAX && free >= UPGRADE_COST
      return h('div', { class: 'up' },
        h('div', null, h('b', null, u.name), h('small', null, u.hint)),
        h('span', { class: 'pips' }, Array.from({ length: UPGRADE_MAX }, (_, i) => h('i', { class: i < n ? 'on' : '' }))),
        h('button', { type: 'button', class: 'chip', disabled: n === 0, 'aria-label': `Remove a step of ${u.name}`, onclick: () => { save.upgrades[u.id] = n - 1; persist(); showBoard() } }, '−'),
        h('button', { type: 'button', class: 'chip', disabled: !can, 'aria-label': `Add a step of ${u.name} for ${UPGRADE_COST} stars`, onclick: () => { save.upgrades[u.id] = n + 1; persist(); blip([660, 880]); showBoard() } }, `+ ${UPGRADE_COST}★`),
      )
    })),
    h('div', { class: 'paints' }, h('b', null, 'Paint'), LIVERIES.map((l) => {
      const open = earned >= l.need
      return h('button', {
        type: 'button', class: `paint${liveryNow().id === l.id ? ' on' : ''}`, disabled: !open, title: open ? l.name : `${l.name}: ${l.need} stars`,
        onclick: () => { save.livery = l.id; persist(); backdrop(); showBoard() },
      }, h('i', { style: `background:linear-gradient(135deg, ${l.colors[0]} 0 55%, ${l.colors[1]} 55% 80%, ${l.colors[2]} 80%)` }), h('span', null, open ? l.name : `${l.need}★`))
    })),
  )
  const seen = REEL.filter((id) => save.seen[id])
  const reel = seen.length ? h('div', { class: 'paints reel' }, h('b', null, 'Film reel'), seen.map((id) =>
    h('button', { type: 'button', class: 'paint film', onclick: () => playCut(id, showBoard) }, h('span', null, `▶ ${CUTSCENES[id].title}`)))) : null
  show(panel('board',
    h('div', { class: 'top' }, h('h2', null, 'Flight line'), h('div', { class: 'row' }, btn('Title', showTitle), switchBtn())),
    h('div', { class: 'acts' }, acts), hangar, reel,
  ))
}

function showBrief() {
  const m = F.m
  const a = ACTS[m.act - 1]
  const go = btn('Launch', launch, 'primary')
  go.dataset.first = ''
  const bonus = m.bonus.type === 'time' ? `Finish inside ${clock(m.bonus.par)}` : `Shoot down ${m.bonus.n}`
  show(panel('brief',
    h('p', { class: 'kicker' }, `${a.name} · ${a.title} · Sortie ${F.index + 1} of ${MISSIONS.length}`),
    h('h2', null, m.title),
    h('p', null, m.brief),
    h('ol', { class: 'goals' }, m.stages.map((s) => h('li', null, s.label, s.limit ? h('em', null, ` ${clock(s.limit)} limit`) : null))),
    h('ul', { class: 'starlist' },
      h('li', null, starRow(1, 1), 'Complete the sortie'),
      h('li', null, starRow(1, 1), 'Bring the same jet home'),
      h('li', null, starRow(1, 1), bonus),
    ),
    h('p', { class: 'tip' }, m.tip),
    h('p', { class: 'fine' }, `Spare jets: ${m.spares}${m.fixedLoadout ? ' · armoury loadout: missile and loader upgrades do not apply' : ''}`),
    h('div', { class: 'row' }, go, btn('Back', showBoard)),
  ))
}

function setPause(on) {
  if (on && screen !== 'flight') return
  if (!on && screen !== 'pause') return
  if (on && F.over) return
  screen = on ? 'pause' : 'flight'
  live.paused = on
  renderGame()
  if (on) {
    const go = btn('Resume', () => setPause(false), 'primary')
    const veil = panel('pause', h('h2', null, 'Paused'), h('p', { class: 'fine' }, F.stage ? F.stage.label : F.m.title),
      h('div', { class: 'col' }, go, btn('Restart sortie', () => prepare(F.index)), btn('Abort to flight line', showBoard), switchBtn()))
    veil.id = 'pause'
    ui.append(veil)
    window.GameSwitch?.wire()
    go.focus({ preventScroll: true })
  } else {
    document.getElementById('pause')?.remove()
    document.querySelector('#game [tabindex]')?.focus({ preventScroll: true })
  }
}

function debrief() {
  screen = 'debrief'
  live.paused = true
  renderGame()
  const m = F.m
  const won = F.over === 'win'
  const clean = F.lost === 0
  const bonus = m.bonus.type === 'time' ? F.t <= m.bonus.par : F.kills >= m.bonus.n
  const stars = won ? 1 + (clean ? 1 : 0) + (bonus ? 1 : 0) : 0
  const firstClear = won && !save.stars[m.id]
  const wasDone = campaignDone()
  if (won) {
    save.stars[m.id] = Math.max(save.stars[m.id] || 0, stars)
    save.best[m.id] = Math.min(save.best[m.id] || 9e9, Math.round(F.t))
    persist()
  }
  const last = F.index === MISSIONS.length - 1
  const actEnd = won && firstClear && !last && MISSIONS[F.index + 1].act !== m.act
  const onward = won
    ? last || (!wasDone && campaignDone())
      ? btn('Epilogue', () => playCut('outro', showBoard), 'primary')
      : btn('Next sortie', () => {
        const i = F.index + 1
        const id = AFTER[m.id]
        if (id && !save.seen[id]) playCut(id, () => enter(i))
        else enter(i)
      }, 'primary')
    : btn('Fly it again', () => prepare(F.index), 'primary')
  onward.dataset.first = ''
  const line = (ok, text) => h('li', { class: ok ? 'ok' : '' }, starRow(ok ? 1 : 0, 1), text)
  show(panel(`debrief${won ? '' : ' lost'}`,
    h('p', { class: 'kicker' }, `${m.title} · ${clock(F.t)}`),
    h('h2', null, won ? 'Sortie complete' : 'Sortie failed'),
    won ? h('div', { class: 'bigstars' }, starRow(stars)) : h('p', { class: 'why' }, F.why),
    h('ul', { class: 'starlist' },
      line(won, 'Complete the sortie'),
      line(won && clean, clean ? 'Brought the same jet home' : `Jets lost: ${F.lost}`),
      line(won && bonus, m.bonus.type === 'time' ? `Inside ${clock(m.bonus.par)} (yours ${clock(F.t)})` : `Shot down ${F.kills} of ${m.bonus.n}`),
    ),
    h('p', null, won ? m.debrief : 'Lantern has you on the scope the whole way down. "We will have another jet fuelled by the time you are dry."'),
    actEnd ? h('p', { class: 'tip' }, `${ACTS[m.act].name} · ${ACTS[m.act].title} is open.`) : null,
    h('div', { class: 'row' }, onward, won && btn('Fly it again', () => prepare(F.index)), btn('Flight line', showBoard)),
  ))
}

// ───────────────────────────────────────────── keys
// While a screen is up the scene must not hear the keyboard (Space, T and M mean things to it).
window.addEventListener('keydown', (e) => {
  if (window.GameSwitch?.isOpen) return // the arcade's list of games has the keyboard
  if (screen === 'flight') {
    if (e.code === 'KeyP' && !e.repeat) { e.stopPropagation(); setPause(true) }
    return
  }
  e.stopPropagation()
  if (screen === 'cut') {
    if (e.code === 'Escape') endCut()
    else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); hurryCut() }
    return
  }
  if (screen === 'pause' && (e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) setPause(false)
}, true)
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); else if (cut) cut.last = performance.now() })

backdrop()
showTitle()
window.__emberTide = { get F() { return F }, get scene() { return scene }, get screen() { return screen }, get cut() { return cut }, prepare, launch, playCut, hurryCut, endCut, cutFrame }
