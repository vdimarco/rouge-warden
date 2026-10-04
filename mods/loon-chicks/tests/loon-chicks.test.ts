import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { bandClutch, hatch, settle } from '../hooks/brood.ts'

// The world beneath the chicks: spawns that start with the next id, turns that end, the classic
// subagent events, and the toasts written down.
function world(on: On) {
  const seen = { toasts: [] as string[], opened: [] as string[] }
  const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
  const clock = mock.clock(on, { now: 5_000_000 })
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => { seen.opened.push(e.id); return { value: { isPlaced: true as const } } })
  on('ui.close', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-test', agentId: ids.shift() }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  return { seen, clock }
}

const spawn = (description: string) => ({
  tool_use_id: `tu-${description}`, prompt: 'do it', description, subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' as const }, parentModel: 'claude-test', background: true, fork: false,
})
const end = (agentId: string, reason: 'answer' | 'aborted' | 'error') => ({
  answer: 'done', durationMs: 1000, isAborted: reason === 'aborted', turnId: `turn-${agentId}`, agentId, reason,
})
const BAND = { hasSurvey: false, isWorking: true, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6, contentRows: 2 }, view: {} }
const PANE = { title: 'Chicks', isFocused: true, bodyColumns: 70, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 20, contentRows: 6 }, view: {} }

describe('the brood', () => {
  test('a chick hatches into the clutch that still swims, and a full clutch starts the next', () => {
    let all = hatch([], 'a', 'one', 0)
    all = hatch(all, 'b', 'two', 1)
    expect(all.map(c => c.clutch)).toEqual([1, 1])
    all = settle(all, 'a', 'home', 2).chicks
    const last = settle(all, 'b', 'eel', 3, 'stopped')
    expect(last.clutchIn).toEqual({ clutch: 1, home: 1, eel: 1 })
    all = hatch(last.chicks, 'c', 'three', 4)
    expect(all.at(-1)?.clutch).toBe(2)
    expect(bandClutch(all, 3, 5)?.map(c => c.id)).toEqual(['c'])
    expect(settle(all, 'a', 'eel', 6).chick).toBeNull()
  })
})

describe('the band', () => {
  test('three agents swim as three chicks behind the loon', async ($, on) => {
    world(on)
    for (const d of ['Review the creel', 'Port Lenia', 'Draw the table']) await $.agent.spawn(spawn(d))
    for (const surface of ['terminal', 'desktop'] as const) {
      const band = await $.ui.mount({ plugin: 'loon-chicks', surface, component: 'AbovePrompt', props: BAND })
      expect((await band.find({ type: 'Text', text: /[•∙] [•∙] [•∙]/ }))?.text).toMatch(/^[•∙] [•∙] [•∙]$/)
      expect((await band.find({ type: 'Text', text: /^Swimming:/ }))?.text).toBe('Swimming: Review the creel · Port Lenia · Draw the table')
      await band.unmount()
    }
  })

  test('the eel takes a stopped chick, and the clutch comes in, then the band goes', async ($, on) => {
    const w = world(on)
    for (const d of ['Review the creel', 'Port Lenia', 'Draw the table']) await $.agent.spawn(spawn(d))
    await $.turn.complete(end('a2', 'aborted'))
    expect(w.seen.toasts).toEqual(['The eel took a chick: Port Lenia (stopped).'])
    await $.turn.complete(end('a1', 'answer'))
    await $.turn.complete(end('a3', 'answer'))
    expect(w.seen.toasts.at(-1)).toBe('Clutch 1 is in: 2 home, 1 taken by the eel.')
    const band = await $.ui.mount({ plugin: 'loon-chicks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await band.find({ type: 'Text', text: /⌂/ }))?.text).toBe('⌂ 2 ')
    expect((await band.find({ type: 'Text', text: /✗/ }))?.text).toBe(' ✗ 1')
    await w.clock.advance(9_500)
    await band.redraw()
    expect(await band.find({ type: 'Text', text: /⌂/ })).toBeUndefined()
  })

  test('a clutch with every chick home says so, and the next agent starts clutch 2', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn('One'))
    await $.agent.spawn(spawn('Two'))
    await $.turn.complete(end('a1', 'answer'))
    await $.turn.complete(end('a2', 'answer'))
    expect(w.seen.toasts).toEqual(['All 2 chicks are home. A new clutch hatches next.'])
    await $.agent.spawn(spawn('Three'))
    const band = await $.ui.mount({ plugin: 'loon-chicks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await band.find({ type: 'Text', text: /clutch/ }))?.text).toBe('  clutch 2')
  })

  test('the main loop\'s turns, unknown agents and refused spawns change nothing', async ($, on) => {
    const w = world(on)
    await $.turn.complete({ answer: 'hi', durationMs: 10, isAborted: false, turnId: 'main', reason: 'answer' })
    await $.turn.complete(end('nobody', 'error'))
    expect(w.seen.toasts).toEqual([])
    const band = await $.ui.mount({ plugin: 'loon-chicks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: /⌂/ })).toBeUndefined()
  })

  test('a subagent the engine starts with no spawn still hatches, and its stop brings it home', async ($, on) => {
    const w = world(on)
    await $.classic.SubagentStart({ agent_id: 'w1', agent_type: 'Explore' })
    const band = await $.ui.mount({ plugin: 'loon-chicks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await band.find({ type: 'Text', text: /^Swimming:/ }))?.text).toBe('Swimming: Explore')
    await $.classic.SubagentStop({ agent_id: 'w1', agent_type: 'Explore', agent_transcript_path: '', stop_hook_active: false })
    expect(w.seen.toasts).toEqual(['The chick is home. A new clutch hatches next.'])
  })
})

describe('the order of the ends', () => {
  test('a spawned chick stays swimming at its stop event, and its turn\'s end decides home or eel', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn('Port Lenia'))
    await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'general-purpose', agent_transcript_path: '', stop_hook_active: false })
    expect(w.seen.toasts).toEqual([])
    await $.turn.complete(end('a1', 'aborted'))
    expect(w.seen.toasts[0]).toBe('The eel took a chick: Port Lenia (stopped).')
  })
})

describe('/chicks', () => {
  test('lists every chick with its clutch and state, on every surface', async ($, on) => {
    const w = world(on)
    await $.agent.spawn(spawn('Review the creel'))
    await $.agent.spawn(spawn('Port Lenia'))
    await $.turn.complete(end('a2', 'error'))
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    const out = await $.command.run({ command: 'chicks', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
    expect(out.text).toBe('2 chicks this session, 1 swimming.')
    expect(w.seen.opened).toEqual(['chicks'])
    for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
      const pane = await $.ui.mount({ plugin: 'loon-chicks', surface, component: 'Pane', requestId: 'chicks', props: PANE })
      expect((await pane.find({ type: 'Text', text: /eel \(failed\)/ }))?.text).toMatch(/clutch 1 · eel \(failed\)/)
      expect(await pane.find({ type: 'Text', text: 'Review the creel' })).toBeDefined()
      await pane.unmount()
    }
  })
})
