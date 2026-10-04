// Full Tilt on the classic table: the physics and the table are the game's own (vendor/physics.js and
// vendor/table.js are public/lab/tilt/physics.js and table.js, which qa/lab/tilt.sim.mjs checks). The
// rules, the scoring and the drawing are this mod's, since the game scores its open-space voyage.
// Pure, so mods/qa/frames.mjs can time it: register.tsx runs it on a timer and draws it.
import { makeTable as makeTableJs } from './vendor/table.js'
import { H, launch as launchJs, makeWorld as makeWorldJs, pullPower, serve as serveJs, setFlip as setFlipJs, step as stepJs, tip as tipJs } from './vendor/physics.js'
import { disc, fillRect, line, mix, pixels, rasterCells } from './shared/cells.ts'
import type { Pixels } from './shared/cells.ts'

export const BALLS = 3
/** How long a flip key holds its flipper up: a key sends a press and no release. */
export const FLIP_S = 0.14
/** The pulls of a full launch and of a soft one, which drops the ball into a top lane. */
export const FULL_PULL = 1, SOFT_PULL = 0.45
/** How long after a soft launch a top lane pays the skill shot. */
export const SKILL_S = 2.5

const POINTS = { bumper: 100, sling: 10, drop: 250, lane: 100, drops: 1000, skill: 1000 } as const

// the shapes of table.js and physics.js, which are plain JavaScript
type Pt = [number, number]
type Drop = { id: number; a: Pt; b: Pt; up: boolean }
type Wall = { a: Pt; b: Pt; e: number; sling?: string; drop?: Drop; oneway?: boolean }
type Circle = { x: number; y: number; r: number }
type Lane = { id: number; x: number; y: number; lit: boolean }
type Flipper = { side: number; px: number; py: number; len: number; r1: number; r2: number; th: number; held: boolean }
type Table = { walls: Wall[]; posts: Circle[]; bumpers: (Circle & { id: number })[]; drops: Drop[]; lanes: Lane[]; W: number; H: number }
type World = { ball: { x: number; y: number; vx: number; vy: number; live: boolean; lane: boolean }; flippers: Flipper[] }
type PhysicsEvent = { k: string; id?: number; side?: number | string }

const makeTable = makeTableJs as unknown as () => Table
const makeWorld = makeWorldJs as unknown as (table: Table) => World
const serve = serveJs as unknown as (w: World) => void
const launch = launchJs as unknown as (w: World, power: number) => boolean
const setFlip = setFlipJs as unknown as (w: World, side: number, held: boolean) => void
const step = stepJs as unknown as (w: World, events: PhysicsEvent[]) => void
const tip = tipJs as unknown as (f: Flipper) => Pt

export type GameState = 'ready' | 'play' | 'over'

export type Game = {
  table: Table
  world: World
  state: GameState
  score: number
  /** Balls left, the one in play included. */
  balls: number
  multiplier: number
  lanes: boolean[]
  message: string
  messageUntil: number
  /** Simulated seconds. */
  t: number
  acc: number
  flipUntil: { left: number; right: number }
  skillUntil: number
  dropsResetAt: number
  flash: Map<number, number>
  /** The drawing's size: columns of the Raster, and pixel rows (two a row). */
  cols: number
  rows: number
  still: Pixels | null
}

export function makeGame(cols = 40, rowsCap = 200): Game {
  const table = makeTable()
  const world = makeWorld(table)
  serve(world)
  const game: Game = {
    table, world, state: 'ready', score: 0, balls: BALLS, multiplier: 1, lanes: [false, false, false],
    message: 'l launches, k drops it soft into a lane', messageUntil: 4, t: 0, acc: 0,
    flipUntil: { left: 0, right: 0 }, skillUntil: 0, dropsResetAt: 0, flash: new Map(), cols: 0, rows: 0, still: null,
  }
  sizeGame(game, cols, rowsCap)
  return game
}

/** Sizes the drawing: `cols` wide, as tall as the table's shape asks, at most `rowsCap` pixel rows. */
export function sizeGame(game: Game, cols: number, rowsCap = 200): void {
  const aspect = game.table.H / game.table.W
  let c = Math.max(16, Math.floor(cols))
  if (Math.round(c * aspect) > rowsCap) c = Math.max(16, Math.floor(rowsCap / aspect))
  const rows = Math.round(c * aspect) + (Math.round(c * aspect) % 2)
  if (c === game.cols && rows === game.rows) return
  game.cols = c
  game.rows = rows
  game.still = null
}

export function newGame(game: Game): void {
  for (const d of game.table.drops) d.up = true
  for (const l of game.table.lanes) l.lit = false
  serve(game.world)
  Object.assign(game, {
    state: 'ready', score: 0, balls: BALLS, multiplier: 1, lanes: [false, false, false], skillUntil: 0, dropsResetAt: 0,
  })
  say(game, 'New game. l launches, k drops it soft into a lane')
}

function say(game: Game, text: string, seconds = 2.5): void {
  game.message = text
  game.messageUntil = game.t + seconds
}

/** A flip key: the flipper goes up for a short tap. side -1 is the left flipper, 1 the right. */
export function press(game: Game, side: -1 | 1): void {
  if (game.state === 'over') return
  setFlip(game.world, side, true)
  if (side < 0) game.flipUntil.left = game.t + FLIP_S
  else game.flipUntil.right = game.t + FLIP_S
}

/** Lets the plunger go with a pull from 0 to 1. False when no ball waits on the plunger. */
export function launchBall(game: Game, pull: number): boolean {
  if (game.state !== 'ready' || !launch(game.world, pullPower(pull))) return false
  game.state = 'play'
  game.skillUntil = pull < 0.75 ? game.t + SKILL_S : 0
  return true
}

function add(game: Game, points: number): void {
  game.score += points * game.multiplier
}

/** Scores one physics event. Exported for the tests. */
export function scoreEvent(game: Game, ev: PhysicsEvent): void {
  switch (ev.k) {
    case 'bumper':
      add(game, POINTS.bumper)
      game.flash.set(ev.id ?? 0, game.t + 0.12)
      break
    case 'sling':
      add(game, POINTS.sling)
      break
    case 'drop':
      add(game, POINTS.drop)
      if (game.table.drops.every(d => !d.up) && game.dropsResetAt === 0) {
        add(game, POINTS.drops)
        game.dropsResetAt = game.t + 1
        say(game, `Drop targets! +${(POINTS.drops * game.multiplier).toLocaleString('en-US')}`)
      }
      break
    case 'lane': {
      const id = ev.id ?? 0
      if (game.skillUntil > game.t) {
        add(game, POINTS.skill)
        say(game, `Skill shot! +${(POINTS.skill * game.multiplier).toLocaleString('en-US')}`)
        game.skillUntil = 0
      }
      if (!game.lanes[id]) {
        game.lanes[id] = true
        add(game, POINTS.lane)
      }
      if (game.lanes.every(Boolean)) {
        game.multiplier = Math.min(5, game.multiplier + 1)
        game.lanes = [false, false, false]
        say(game, `All lanes lit: ×${game.multiplier}`)
      }
      break
    }
    case 'drain':
      game.balls -= 1
      game.multiplier = 1
      game.lanes = [false, false, false]
      game.skillUntil = 0
      if (game.balls <= 0) {
        game.state = 'over'
        say(game, 'GAME OVER · n starts a new game', 1e9)
      } else {
        serve(game.world)
        game.state = 'ready'
        say(game, `Ball ${BALLS - game.balls + 1} of ${BALLS} · l launches`)
      }
      break
  }
}

/** Runs the table for `dt` seconds, in the physics' own 1/120 s frames. */
export function tickGame(game: Game, dt: number): void {
  game.acc += Math.min(dt, 0.1)
  while (game.acc >= H) {
    game.acc -= H
    game.t += H
    if (game.flipUntil.left > 0 && game.t >= game.flipUntil.left) { setFlip(game.world, -1, false); game.flipUntil.left = 0 }
    if (game.flipUntil.right > 0 && game.t >= game.flipUntil.right) { setFlip(game.world, 1, false); game.flipUntil.right = 0 }
    if (game.dropsResetAt > 0 && game.t >= game.dropsResetAt) {
      for (const d of game.table.drops) d.up = true
      game.dropsResetAt = 0
    }
    if (game.state === 'over') continue
    const events: PhysicsEvent[] = []
    step(game.world, events)
    for (const ev of events) scoreEvent(game, ev)
  }
}

export const shownMessage = (game: Game): string => (game.t < game.messageUntil ? game.message : '')

// the look: a dark playfield, pink slingshots, gold bumpers that flash, a steel ball
const BG = 0x0b0e18, LANE_BG = 0x121a2e, WALL = 0x6c7aa8, SLING = 0xff6b9e, POST = 0x9ff2de, BUMPER = 0xffca51
const DROP = 0xff8a3a, LANE_OFF = 0x2a3350, LANE_ON = 0xffd84a, FLIPPER = 0xe8f0ea, BALL = 0xf0f4ff

/** The table as a canvas of game.cols by game.rows pixels. */
export function drawTable(game: Game): Pixels {
  const { table } = game
  const sx = game.cols / table.W, sy = game.rows / table.H
  const X = (x: number) => x * sx, Y = (y: number) => (table.H - y) * sy
  if (game.still === null) {
    const p = pixels(game.cols, game.rows, BG)
    fillRect(p, X(455), Y(760), X(500), Y(40), LANE_BG)
    for (const s of table.walls) if (!s.drop) line(p, X(s.a[0]), Y(s.a[1]), X(s.b[0]), Y(s.b[1]), s.sling ? SLING : WALL)
    for (const c of table.posts) disc(p, X(c.x), Y(c.y), Math.max(0.6, c.r * sx), POST)
    game.still = p
  }
  const p: Pixels = { w: game.still.w, h: game.still.h, px: game.still.px.slice() }
  for (const d of table.drops) line(p, X(d.a[0]), Y(d.a[1]), X(d.b[0]), Y(d.b[1]), d.up ? DROP : mix(DROP, BG, 0.75))
  table.lanes.forEach((l, i) => disc(p, X(l.x), Y(l.y), 0.9, game.lanes[i] ? LANE_ON : LANE_OFF))
  for (const b of table.bumpers) {
    const lit = (game.flash.get(b.id) ?? 0) > game.t
    disc(p, X(b.x), Y(b.y), b.r * sx, lit ? 0xffffff : BUMPER)
    disc(p, X(b.x), Y(b.y), b.r * sx * 0.45, lit ? BUMPER : mix(BUMPER, BG, 0.5))
  }
  for (const f of game.world.flippers) {
    const [tx, ty] = tip(f)
    line(p, X(f.px), Y(f.py), X(tx), Y(ty), FLIPPER, Math.max(0.5, f.r2 * sx))
  }
  const ball = game.world.ball
  disc(p, X(ball.x), Y(ball.y), Math.max(0.8, 13.5 * sx), BALL)
  return p
}

export const tableCells = (game: Game): string => rasterCells(drawTable(game))

/** The table as vector SVG for the apps, in the table's own millimetres. */
export function tableSvg(game: Game, width = 260): string {
  const { table } = game
  const Y = (y: number) => table.H - y
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`
  const parts: string[] = [`<rect width="${table.W}" height="${table.H}" fill="${hex(BG)}"/>`,
    `<rect x="455" y="${Y(760)}" width="45" height="${760 - 40}" fill="${hex(LANE_BG)}"/>`]
  for (const s of table.walls) {
    if (s.drop) continue
    parts.push(`<line x1="${s.a[0].toFixed(1)}" y1="${Y(s.a[1]).toFixed(1)}" x2="${s.b[0].toFixed(1)}" y2="${Y(s.b[1]).toFixed(1)}" stroke="${hex(s.sling ? SLING : WALL)}" stroke-width="6" stroke-linecap="round"/>`)
  }
  for (const d of table.drops) parts.push(`<line x1="${d.a[0]}" y1="${Y(d.a[1])}" x2="${d.b[0]}" y2="${Y(d.b[1])}" stroke="${hex(d.up ? DROP : mix(DROP, BG, 0.75))}" stroke-width="10"/>`)
  for (const c of table.posts) parts.push(`<circle cx="${c.x}" cy="${Y(c.y)}" r="${c.r}" fill="${hex(POST)}"/>`)
  table.lanes.forEach((l, i) => parts.push(`<circle cx="${l.x}" cy="${Y(l.y)}" r="9" fill="${hex(game.lanes[i] ? LANE_ON : LANE_OFF)}"/>`))
  for (const b of table.bumpers) {
    const lit = (game.flash.get(b.id) ?? 0) > game.t
    parts.push(`<circle cx="${b.x}" cy="${Y(b.y)}" r="${b.r}" fill="${hex(lit ? 0xffffff : BUMPER)}"/>`)
  }
  for (const f of game.world.flippers) {
    const [tx, ty] = tip(f)
    parts.push(`<line x1="${f.px}" y1="${Y(f.py)}" x2="${tx.toFixed(1)}" y2="${Y(ty).toFixed(1)}" stroke="${hex(FLIPPER)}" stroke-width="${f.r1 * 2}" stroke-linecap="round"/>`)
  }
  const ball = game.world.ball
  parts.push(`<circle cx="${ball.x.toFixed(1)}" cy="${Y(ball.y).toFixed(1)}" r="13.5" fill="${hex(BALL)}"/>`)
  const height = Math.round((width * table.H) / table.W)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${table.W} ${table.H}">${parts.join('')}</svg>`
}
