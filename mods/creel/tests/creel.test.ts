import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { GOALS, landGreen, landRed, lengthOf, progressOf, revealText } from '../hooks/catch.ts'
import type { Fish } from '../hooks/catch.ts'
import { dayKey, dayNumber } from '../hooks/shared/days.ts'
import { seeded } from '../hooks/shared/rng.ts'

// A time on a day whose goal is `id`, so a test knows the goal it plays for.
function dayFor(id: string): number {
  let t = Date.UTC(2026, 9, 4, 12)
  while (GOALS[dayNumber(t) % GOALS.length]!.id !== id) t += 86_400_000
  return t
}

type Answer = { ms: number; isError?: true; stdout?: string; merged?: true }

// The world beneath the creel: Bash calls that take a set time on a mock clock, and the toasts,
// the store, panes and drawings written down.
function world(on: On, now = dayFor('five'), store: Record<string, unknown> = {}) {
  const seen = { toasts: [] as string[], store, opened: [] as string[] }
  const answers = new Map<string, Answer>()
  const clock = mock.clock(on, { now })
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('store.get', ($, e) => ({ value: seen.store[e.key] }))
  on('store.set', ($, e) => { seen.store[e.key] = e.value; return { value: undefined } })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => { seen.opened.push(e.id); return { value: { isPlaced: true as const } } })
  on('ui.close', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.receive', ($, e) => ({ text: e.text }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('tool.call', async ($, e) => {
    const command = 'command' in e ? String(e.command) : ''
    const answer = answers.get(command) ?? { ms: 100 }
    await clock.sleep(answer.ms)
    if (answer.isError) return { isError: true as const, result: 'Exit code 1', text: 'Exit code 1' }
    const gitOperation = answer.merged ? { pr: { number: 7, action: 'merged' } } : undefined
    return { result: { stdout: answer.stdout ?? 'ok', stderr: '', interrupted: false, gitOperation } }
  })
  return { seen, answers, clock }
}

const BAND = {
  hasSurvey: false, isWorking: true, maxRows: 6, bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 6, contentRows: 1 }, view: {},
}
const PANE = { title: 'Creel', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30, contentRows: 10 }, view: {} }

describe('the catch', () => {
  test('long runs bring heavier fish, and the reveal reads as in the game', () => {
    const mean = (ms: number) => {
      const random = seeded(7)
      let kg = 0
      for (let i = 0; i < 400; i++) kg += landGreen(ms, random).kg
      return kg / 400
    }
    expect(lengthOf(3000)).toBe(0)
    expect(lengthOf(300_000)).toBe(1)
    expect(mean(300_000)).toBeGreaterThan(mean(3500) * 3)
    const random = seeded(3)
    const junk = Array.from({ length: 200 }, () => landRed(random))
    expect(junk.every(f => f.junk === true)).toBe(true)
    expect(junk.filter(f => f.id === 'boot').length).toBeGreaterThan(120)
    expect(revealText({ id: 'walleye', name: 'Walleye', kg: 6.1, big: true })).toBe('It is a huge Walleye! 6.1 kg')
    expect(revealText({ id: 'boot', name: 'Old Boot', kg: 0.8, junk: true })).toBe('It is an Old Boot! 0.8 kg')
    expect(revealText({ id: 'plunger', name: "The King's Plunger", kg: 0.5, junk: true })).toBe("It is the King's Plunger! 0.5 kg")
    expect(revealText({ id: 'frisbee', name: "Pip's Frisbee", kg: 0.2, junk: true })).toBe("It is Pip's Frisbee! 0.2 kg")
    expect(revealText({ id: 'golden', name: 'Golden Loon Bass', kg: 4.6, article: 'the', legend: true })).toBe('It is the Golden Loon Bass! 4.6 kg')
  })

  test('the goals count today\'s catch', () => {
    const f = (id: string, kg: number, extra: Partial<Fish> = {}): Fish => ({ id, name: id, kg, ...extra })
    const day = [f('perch', 0.3), f('boot', 0.8, { junk: true }), f('pike', 4.2), f('pike', 2), f('brooktrout', 0.4)]
    const goal = (id: string) => GOALS.find(g => g.id === id)!
    expect(progressOf(goal('five'), day)).toBe(4)
    expect(progressOf(goal('kinds'), day)).toBe(3)
    expect(progressOf(goal('heavy'), day)).toBe(1)
    expect(progressOf(goal('trout'), day)).toBe(1)
    expect(progressOf(goal('clean'), day)).toBe(3)
    expect(progressOf(goal('huge'), day)).toBe(0)
  })
})

describe('the line', () => {
  test('a short command casts no line and lands nothing', async ($, on) => {
    const w = world(on)
    const pending = $.tool.call({ tool: 'Bash', command: 'ls' })
    await w.clock.advance(200)
    await pending
    expect(w.seen.toasts).toEqual([])
    expect(w.seen.store.creel).toBeUndefined()
  })

  test('a long green build shows a bobber from the third second, then lands a fish', async ($, on) => {
    const w = world(on)
    w.answers.set('npm run build --prefix games/olympus', { ms: 40_000 })
    const pending = $.tool.call({ tool: 'Bash', command: 'npm run build --prefix games/olympus' })
    await w.clock.advance(2_000)
    const band = await $.ui.mount({ plugin: 'creel', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: /Line out/ })).toBeUndefined()
    await w.clock.advance(1_500)
    await band.redraw()
    expect((await band.find({ type: 'Text', text: /Line out/ }))?.text).toContain('npm run build --prefix games/olympus')
    await w.clock.advance(40_000)
    await pending
    expect(w.seen.toasts.length).toBe(1)
    expect(w.seen.toasts[0]).toMatch(/^It is .+! [\d.]+ kg · Land 5 fish: 1\/5$/)
    expect((w.seen.store.creel as { total: number }).total).toBe(1)
    await band.redraw()
    expect(await band.find({ type: 'Text', text: /^It is / })).toBeDefined()
    await w.clock.advance(7_000)
    await band.redraw()
    expect(await band.find({ type: 'Text', text: /^It is / })).toBeUndefined()
  })

  test('a red run of five seconds lands junk', async ($, on) => {
    const w = world(on)
    w.answers.set('npm test', { ms: 5_000, isError: true })
    const pending = $.tool.call({ tool: 'Bash', command: 'npm test' })
    await w.clock.advance(5_000)
    await pending
    expect(w.seen.toasts[0]).toMatch(/^It is (an Old Boot|the King's Plunger|Pip's Frisbee)!/)
    expect((w.seen.store.creel as { junk: number }).junk).toBe(1)
  })

  test('a background command casts no line', async ($, on) => {
    const w = world(on)
    w.answers.set('npm run qa', { ms: 9_000 })
    const pending = $.tool.call({ tool: 'Bash', command: 'npm run qa', run_in_background: true })
    await w.clock.advance(9_000)
    await pending
    expect(w.seen.toasts).toEqual([])
  })

  test('a merged pull request lands the Golden Loon Bass, and it joins the legends', async ($, on) => {
    const w = world(on)
    w.answers.set('gh pr merge 7', { ms: 800, merged: true })
    const pending = $.tool.call({ tool: 'Bash', command: 'gh pr merge 7' })
    await w.clock.advance(800)
    await pending
    expect(w.seen.toasts[0]).toMatch(/^It is the Golden Loon Bass! [\d.]+ kg/)
    expect((w.seen.store.creel as { legends: string[] }).legends).toEqual(['golden'])
  })
})

describe('the day', () => {
  test('the catch that meets today\'s goal says so, once', async ($, on) => {
    const now = dayFor('five')
    const old = Array.from({ length: 4 }, () => ({ id: 'perch', name: 'Yellow Perch', kg: 0.3 }))
    const w = world(on, now, { today: { key: '', catches: [], done: false } })
    w.seen.store.today = { key: dayKey(now), catches: old, done: false }
    for (let i = 0; i < 2; i++) {
      w.answers.set(`npm run check ${i}`, { ms: 4_000 })
      const pending = $.tool.call({ tool: 'Bash', command: `npm run check ${i}` })
      await w.clock.advance(4_000)
      await pending
    }
    expect(w.seen.toasts.filter(t => t.startsWith('Daily goal done'))).toEqual(['Daily goal done: Land 5 fish'])
    expect((w.seen.store.today as { done: boolean }).done).toBe(true)
  })

  test('/creel opens a pane with the goal, the catch and the legends, on every surface', async ($, on) => {
    const w = world(on, dayFor('kinds'), {
      creel: { total: 3, junk: 1, kinds: { pike: { name: 'Northern Pike', count: 2, best: 5.2 }, golden: { name: 'Golden Loon Bass', count: 1, best: 4.4 } }, legends: ['golden'] },
    })
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    const out = await $.command.run({ command: 'creel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
    expect(out.text).toBe('The creel: 3 fish, 1 junk.')
    expect(w.seen.opened).toEqual(['creel'])
    for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
      const pane = await $.ui.mount({ plugin: 'creel', surface, component: 'Pane', requestId: 'creel', props: PANE })
      expect((await pane.find({ type: 'Text', text: /^Today:/ }))?.text).toBe('Today: Land 3 kinds of fish · 0/3')
      expect((await pane.find({ type: 'Text', text: /^Legends:/ }))?.text).toBe('Legends: Golden Loon Bass')
      expect(await pane.find({ type: 'Text', text: /Northern Pike/ })).toBeDefined()
      await pane.unmount()
    }
  })
})
