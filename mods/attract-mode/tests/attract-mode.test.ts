import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { RESEED_STEPS, cellColor, makeDish, stepDish } from '../hooks/dish.ts'

// The world beneath attract mode: panes that open and close, blits, and a clock that moves when told.
function world(on: On) {
  const seen = { opened: [] as { id: string; focus?: true }[], closed: [] as string[], blits: 0 }
  const clock = mock.clock(on, { now: 1_000_000 })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => { seen.opened.push({ id: e.id, ...(e.focus ? { focus: true as const } : {}) }); return { value: { isPlaced: true as const } } })
  on('ui.close', ($, e) => { seen.closed.push(e.id); return { value: undefined } })
  on('ui.blit', () => { seen.blits++; return { value: {} } })
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  return { seen, clock }
}

const end = { answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' as const }
const prompt = { text: 'next', wait: false, origin: { kind: 'composer' as const } }
const ATTRACT = { command: 'attract', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } }
const pane = (bodyColumns: number) => ({ title: 'Primordia', isFocused: false, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40, contentRows: 36 }, view: {} })

describe('the dish', () => {
  test('two Orbiums glide on and keep their mass, and the dish seeds again in time', () => {
    const dish = makeDish(64, 3)
    for (let i = 0; i < 400; i++) stepDish(dish)
    expect(dish.world.massA).toBeGreaterThan(100)
    expect(dish.seeds).toBe(1)
    for (let i = 0; i < RESEED_STEPS; i++) stepDish(dish)
    expect(dish.seeds).toBe(2)
    expect(cellColor(0, 1)).toBe(0x051823)
    expect(cellColor(1, 1) & 0xff).toBeGreaterThan(200)
  })
})

describe('idle', () => {
  test('three idle minutes open the dish unasked, and the next prompt closes it', async ($, on) => {
    const w = world(on)
    await $.turn.complete(end)
    await w.clock.advance(2 * 60_000)
    expect(w.seen.opened).toEqual([])
    await w.clock.advance(60_000 + 10)
    expect(w.seen.opened).toEqual([{ id: 'attract' }])
    await $.ui.mount({ plugin: 'attract-mode', surface: 'terminal', component: 'Pane', requestId: 'attract', props: pane(80) })
    await w.clock.advance(1000)
    expect(w.seen.blits).toBeGreaterThan(10)
    await $.prompt.submit(prompt)
    expect(w.seen.closed).toEqual(['attract'])
    const blits = w.seen.blits
    await w.clock.advance(1000)
    expect(w.seen.blits).toBe(blits)
  })

  test('a prompt before the time is up keeps the dish shut, and a subagent\'s turn is not idle', async ($, on) => {
    const w = world(on)
    await $.turn.complete(end)
    await w.clock.advance(60_000)
    await $.turn.start({ text: 'go', turnId: 't2' })
    await $.turn.complete({ ...end, agentId: 'a1' })
    await w.clock.advance(10 * 60_000)
    expect(w.seen.opened).toEqual([])
  })

  test('a dish that waits undrawn costs no frames', async ($, on) => {
    const w = world(on)
    await $.turn.complete(end)
    await w.clock.advance(3 * 60_000 + 2000)
    expect(w.seen.opened.length).toBe(1)
    expect(w.seen.blits).toBe(0)
  })

  test('the idle time follows the setting', { options: { idleMinutes: 1 } }, async ($, on) => {
    const w = world(on)
    await $.turn.complete(end)
    await w.clock.advance(60_000 + 10)
    expect(w.seen.opened).toEqual([{ id: 'attract' }])
  })
})

describe('/attract', () => {
  test('opens a pane with the keys that a prompt leaves open, drawn on every surface', async ($, on) => {
    const w = world(on)
    expect((await $.command.run(ATTRACT)).text).toBe('Attract mode: a live Primordia dish. Esc closes it.')
    expect(w.seen.opened).toEqual([{ id: 'attract', focus: true }])
    await $.prompt.submit(prompt)
    expect(w.seen.closed).toEqual([])
    const wide = await $.ui.mount({ plugin: 'attract-mode', surface: 'terminal', component: 'Pane', requestId: 'attract', props: pane(80) })
    const raster = await wide.find({ type: 'Raster', key: 'dish' })
    expect(raster).toBeDefined()
    expect(await wide.find({ type: 'Text', text: 'PRIMORDIA · INSERT COIN' })).toBeDefined()
    await wide.unmount()
    for (const surface of ['desktop', 'mobile'] as const) {
      const app = await $.ui.mount({ plugin: 'attract-mode', surface, component: 'Pane', requestId: 'attract', props: pane(80) })
      expect(await app.find({ type: 'Svg' })).toBeDefined()
      await app.unmount()
    }
  })

  test('the Close button closes the pane and stops the dish', async ($, on) => {
    const w = world(on)
    await $.command.run(ATTRACT)
    const drawn = await $.ui.mount({ plugin: 'attract-mode', surface: 'terminal', component: 'Pane', requestId: 'attract', props: pane(41) })
    await w.clock.advance(500)
    await drawn.press({ key: 'close' })
    expect(w.seen.closed).toEqual(['attract'])
    const blits = w.seen.blits
    await w.clock.advance(1000)
    expect(w.seen.blits).toBe(blits)
  })
})
