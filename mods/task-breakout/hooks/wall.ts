// The brick wall: one brick for each task of a change, a gap for each done one, a ball and a paddle
// that play on it. Bricks stand until a box is checked; then the ball flies to that brick and breaks
// it. Pure, so mods/qa/frames.mjs can time it: register.tsx steps it on a timer and draws it.
import { disc, fillRect, mix, pixels, plot, rasterCells, svgOf } from './shared/cells.ts'
import type { Pixels } from './shared/cells.ts'
import { seeded } from './shared/rng.ts'
import type { Random } from './shared/rng.ts'
import type { Task } from './tasks.ts'

export type Brick = { task: number; x: number; y: number; color: number; alive: boolean }
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: number }
export type Wall = {
  w: number
  h: number
  bricks: Brick[]
  /** How many tasks did not fit on the wall. */
  hidden: number
  ball: { x: number; y: number; vx: number; vy: number; px: number; py: number }
  paddle: number
  sparks: Spark[]
  /** Task indexes waiting for the ball, first first. */
  queue: number[]
  random: Random
  t: number
}

export const BRICK_W = 4, BRICK_H = 2, GAP = 1, TOP = 2, PADDLE_W = 9
const SPEED = 34
const PALETTE = [0xff8a3a, 0xffca51, 0x8fcf7a, 0x5fb8d0, 0xf5a6e5, 0xd0485f, 0x9ff2de, 0xedc06b]
const BG = 0x0b0e18, EDGE = 0x1f2740, PADDLE = 0xe8f0ea, BALL = 0xffd84a

export function makeWall(tasks: readonly Task[], w: number, h: number, seed = 1): Wall {
  const cols = Math.max(1, Math.floor((w - 2 + GAP) / (BRICK_W + GAP)))
  const left = Math.floor((w - (cols * (BRICK_W + GAP) - GAP)) / 2)
  const rows = Math.max(1, Math.floor((h * 0.55 - TOP) / (BRICK_H + GAP)))
  const sections = [...new Set(tasks.map(t => t.section))]
  const shown = tasks.slice(0, cols * rows)
  const bricks = shown.map((t, i) => ({
    task: i,
    x: left + (i % cols) * (BRICK_W + GAP),
    y: TOP + Math.floor(i / cols) * (BRICK_H + GAP),
    color: PALETTE[sections.indexOf(t.section) % PALETTE.length] ?? PALETTE[0]!,
    alive: !t.done,
  }))
  const random = seeded(seed)
  const x = w / 2, y = h - 4
  return {
    w, h, bricks, hidden: tasks.length - shown.length, sparks: [], queue: [], random, t: 0,
    ball: { x, y, vx: SPEED * 0.6, vy: -SPEED * 0.8, px: x, py: y }, paddle: x,
  }
}

/** Sends the ball for the brick of a task. False when that task has no standing brick. */
export function knock(wall: Wall, task: number): boolean {
  const brick = wall.bricks.find(b => b.task === task)
  if (brick === undefined || !brick.alive || wall.queue.includes(task)) return false
  wall.queue.push(task)
  return true
}

export const standing = (wall: Wall): number => wall.bricks.filter(b => b.alive).length

const inside = (b: Brick, x: number, y: number) => x >= b.x && x < b.x + BRICK_W && y >= b.y && y < b.y + BRICK_H

function burst(wall: Wall, brick: Brick): void {
  brick.alive = false
  for (let i = 0; i < 14; i++) {
    const a = wall.random() * Math.PI * 2, s = 8 + wall.random() * 22
    wall.sparks.push({ x: brick.x + BRICK_W / 2, y: brick.y + 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, life: 0.5 + wall.random() * 0.5, color: brick.color })
  }
}

/** Moves the scene on by `dt` seconds. */
export function stepWall(wall: Wall, dt: number): void {
  wall.t += dt
  const ball = wall.ball
  const steps = Math.max(1, Math.ceil((SPEED * dt) / 0.5))
  const h = dt / steps
  for (let s = 0; s < steps; s++) {
    ball.px = ball.x
    ball.py = ball.y
    const target = wall.queue.length > 0 ? wall.bricks.find(b => b.task === wall.queue[0] && b.alive) : undefined
    if (wall.queue.length > 0 && target === undefined) wall.queue.shift()
    if (target !== undefined) {
      // home in on the brick of the checked task
      const dx = target.x + BRICK_W / 2 - ball.x, dy = target.y + BRICK_H / 2 - ball.y, d = Math.hypot(dx, dy) || 1
      ball.vx = (dx / d) * SPEED * 1.3
      ball.vy = (dy / d) * SPEED * 1.3
    }
    ball.x += ball.vx * h
    ball.y += ball.vy * h
    if (target !== undefined && inside(target, ball.x, ball.y)) {
      burst(wall, target)
      wall.queue.shift()
      ball.vy = Math.abs(ball.vy) || SPEED * 0.8
      ball.vx = (wall.random() - 0.5) * SPEED
      continue
    }
    if (ball.x < 1 || ball.x > wall.w - 1) { ball.vx = -ball.vx; ball.x = ball.px }
    if (ball.y < 1) { ball.vy = Math.abs(ball.vy); ball.y = ball.py }
    for (const b of wall.bricks) {
      if (!b.alive || !inside(b, ball.x, ball.y)) continue
      if (ball.py < b.y || ball.py >= b.y + BRICK_H) ball.vy = -ball.vy
      else ball.vx = -ball.vx
      ball.x = ball.px
      ball.y = ball.py
      break
    }
    const paddleY = wall.h - 2
    if (ball.vy > 0 && ball.y >= paddleY - 0.5 && Math.abs(ball.x - wall.paddle) <= PADDLE_W / 2 + 0.5) {
      const off = (ball.x - wall.paddle) / (PADDLE_W / 2)
      const angle = -Math.PI / 2 + off * 0.9
      ball.vx = Math.cos(angle) * SPEED
      ball.vy = Math.sin(angle) * SPEED
      ball.y = paddleY - 0.6
    }
    if (ball.y > wall.h - 1) { ball.vy = -Math.abs(ball.vy); ball.y = wall.h - 1.5 }
  }
  // the paddle follows the ball, a little late
  const goal = Math.max(PADDLE_W / 2, Math.min(wall.w - PADDLE_W / 2, ball.x))
  wall.paddle += Math.max(-SPEED * 1.2 * dt, Math.min(SPEED * 1.2 * dt, goal - wall.paddle))
  for (const p of wall.sparks) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 40 * dt
    p.life -= dt
  }
  wall.sparks = wall.sparks.filter(p => p.life > 0)
}

export function drawWall(wall: Wall): Pixels {
  const p = pixels(wall.w, wall.h, BG)
  fillRect(p, 0, 0, wall.w - 1, 0, EDGE)
  fillRect(p, 0, 0, 0, wall.h - 1, EDGE)
  fillRect(p, wall.w - 1, 0, wall.w - 1, wall.h - 1, EDGE)
  const blink = Math.floor(wall.t * 6) % 2 === 0
  for (const b of wall.bricks) {
    if (!b.alive) continue
    const isTarget = wall.queue[0] === b.task
    const color = isTarget && blink ? 0xffffff : b.color
    fillRect(p, b.x, b.y, b.x + BRICK_W - 1, b.y + BRICK_H - 1, mix(color, 0x000000, 0.25))
    fillRect(p, b.x, b.y, b.x + BRICK_W - 1, b.y, color)
  }
  for (const s of wall.sparks) plot(p, s.x, s.y, mix(s.color, BG, 1 - Math.min(1, s.life * 1.6)))
  fillRect(p, wall.paddle - PADDLE_W / 2, wall.h - 2, wall.paddle + PADDLE_W / 2 - 1, wall.h - 2, PADDLE)
  plot(p, wall.ball.px, wall.ball.py, mix(BALL, BG, 0.6))
  disc(p, wall.ball.x, wall.ball.y, 0.75, BALL)
  return p
}

export const wallCells = (wall: Wall): string => rasterCells(drawWall(wall))
export const wallSvg = (wall: Wall, scale = 6): string => svgOf(drawWall(wall), scale)
