import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { FLIP_S, SOFT_PULL, launchBall, makeGame, press, scoreEvent, tickGame } from '../hooks/game.ts'

describe('the game', () => {
  test('a full launch sends the ball up the shooter lane and into play', () => {
    const game = makeGame(40)
    expect(game.state).toBe('ready')
    expect(launchBall(game, 1)).toBe(true)
    expect(launchBall(game, 1)).toBe(false)
    tickGame(game, 0.1)
    expect(game.state).toBe('play')
    expect(game.world.ball.y).toBeGreaterThan(200)
  })

  test('a flip key raises its flipper for a short tap', () => {
    const game = makeGame(40)
    press(game, -1)
    expect(game.world.flippers.find(f => f.side < 0)?.held).toBe(true)
    expect(game.world.flippers.find(f => f.side > 0)?.held).toBe(false)
    // one tick runs at most 0.1 s, so a long pause cannot run the table away
    for (let t = 0; t < FLIP_S + 0.02; t += 0.05) tickGame(game, 0.05)
    expect(game.world.flippers.find(f => f.side < 0)?.held).toBe(false)
  })

  test('bumpers, drop targets and lanes score, and three lit lanes raise the multiplier', () => {
    const game = makeGame(40)
    scoreEvent(game, { k: 'bumper', id: 1 })
    expect(game.score).toBe(100)
    for (const id of [0, 1, 2]) scoreEvent(game, { k: 'lane', id })
    expect(game.multiplier).toBe(2)
    expect(game.lanes).toEqual([false, false, false])
    scoreEvent(game, { k: 'bumper', id: 0 })
    expect(game.score).toBe(100 + 300 + 200)
    for (const d of game.table.drops) d.up = false
    scoreEvent(game, { k: 'drop', id: 2 })
    expect(game.score).toBe(600 + 500 + 2000)
    for (let i = 0; i < 11; i++) tickGame(game, 0.1)
    expect(game.table.drops.every(d => d.up)).toBe(true)
  })

  test('a soft launch drops into a top lane and pays the skill shot', () => {
    const game = makeGame(40)
    launchBall(game, SOFT_PULL)
    for (let i = 0; i < 90; i++) tickGame(game, 1 / 30)
    expect(game.score).toBeGreaterThanOrEqual(1000)
    expect(game.message).toBe('Skill shot! +1,000')
  })

  test('three drains end the game', () => {
    const game = makeGame(40)
    scoreEvent(game, { k: 'drain' })
    expect(game.state).toBe('ready')
    expect(game.balls).toBe(2)
    scoreEvent(game, { k: 'drain' })
    scoreEvent(game, { k: 'drain' })
    expect(game.state).toBe('over')
  })
})

// The world beneath the pane: blits, panes, the store, and a clock that moves when told.
function world(on: On) {
  const seen = { blits: 0, opened: [] as { id: string; focus?: true }[], closed: [] as string[], store: {} as Record<string, unknown> }
  const clock = mock.clock(on, { now: 2_000_000 })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => { seen.opened.push({ id: e.id, ...(e.focus ? { focus: true as const } : {}) }); return { value: { isPlaced: true as const } } })
  on('ui.close', ($, e) => { seen.closed.push(e.id); return { value: undefined } })
  on('ui.blit', () => { seen.blits++; return { value: {} } })
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('store.get', ($, e) => ({ value: seen.store[e.key] }))
  on('store.set', ($, e) => { seen.store[e.key] = e.value; return { value: undefined } })
  return { seen, clock }
}

const FULL_TILT = { command: 'full-tilt', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } }
const pane = (isFocused: boolean) => ({ title: 'Full Tilt', isFocused, bodyColumns: 50, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 52, contentRows: 50 }, view: {} })

describe('the pane', () => {
  test('/full-tilt opens the table with the keys, and the keys play it', async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    expect((await $.command.run(FULL_TILT)).text).toContain('z and m flip, l launches')
    expect(w.seen.opened).toEqual([{ id: 'full-tilt', focus: true }])
    const table = await $.ui.mount({ plugin: 'full-tilt', surface: 'terminal', component: 'Pane', requestId: 'full-tilt', props: pane(true) })
    expect(await table.find({ type: 'Raster', key: 'table' })).toBeDefined()
    expect((await table.find({ type: 'Text', text: /^SCORE/ }))?.text).toBe('SCORE 0  BALL 1/3  BEST 0')
    for (const key of ['left', 'right', 'launch', 'soft', 'new', 'pause', 'close']) expect(await table.find({ type: 'Button', key })).toBeDefined()
    await table.press({ key: 'soft' })
    await w.clock.advance(3000)
    expect(w.seen.blits).toBeGreaterThan(60)
    expect((await table.find({ type: 'Text', text: /^SCORE/ }))?.text).toMatch(/^SCORE [1-9][\d,]*/)
  })

  test('the table waits while the terminal pane does not hold the keys', async ($, on) => {
    const w = world(on)
    await $.command.run(FULL_TILT)
    const table = await $.ui.mount({ plugin: 'full-tilt', surface: 'terminal', component: 'Pane', requestId: 'full-tilt', props: pane(false) })
    await table.press({ key: 'launch' })
    await w.clock.advance(200)
    expect((await table.find({ type: 'Text', text: /PAUSED/ }))?.text).toBe('PAUSED · click the table or press ctrl+x tab to play')
    await table.redraw(pane(true))
    await w.clock.advance(200)
    expect(await table.find({ type: 'Text', text: /PAUSED/ })).toBeUndefined()
  })

  test('the apps get the table as SVG and the Buttons', async ($, on) => {
    world(on)
    await $.command.run(FULL_TILT)
    for (const surface of ['desktop', 'mobile'] as const) {
      const app = await $.ui.mount({ plugin: 'full-tilt', surface, component: 'Pane', requestId: 'full-tilt', props: pane(false) })
      expect(await app.find({ type: 'Svg' })).toBeDefined()
      expect(await app.find({ type: 'Button', key: 'left' })).toBeDefined()
      await app.unmount()
    }
  })

  test('a finished game keeps the best score, and Close stops the table', async ($, on) => {
    const w = world(on)
    await $.command.run(FULL_TILT)
    const table = await $.ui.mount({ plugin: 'full-tilt', surface: 'terminal', component: 'Pane', requestId: 'full-tilt', props: pane(true) })
    for (let ball = 0; ball < 3; ball++) {
      await table.press({ key: 'soft' })
      await w.clock.advance(8000)
    }
    expect((await table.find({ type: 'Text', text: /GAME OVER/ }))?.text).toMatch(/^GAME OVER · [\d,]+ · n starts a new game$/)
    expect(Number(w.seen.store.best)).toBeGreaterThanOrEqual(3000)
    await table.press({ key: 'close' })
    expect(w.seen.closed).toEqual(['full-tilt'])
    const blits = w.seen.blits
    await w.clock.advance(1000)
    expect(w.seen.blits).toBe(blits)
  })
})
