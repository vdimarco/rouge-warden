import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CABINETS, cabinetOf, durationText, statusOf } from '../hooks/cabinets.ts'

// The world beneath the spinner: the store, the status line, the command list, tool calls that
// succeed, prompts that enter, and an engine that draws the spinner and the turn line plainly.
function world(on: On, tokens?: number, splitLine = false) {
  const seen = { statuses: [] as (string | undefined)[], store: {} as Record<string, unknown>, commands: [] as string[] }
  if (tokens !== undefined) seen.store.tokens = tokens
  on('ui.status', ($, e) => { seen.statuses.push(e.text); return { value: undefined } })
  on('store.get', ($, e) => ({ value: seen.store[e.key] }))
  on('store.set', ($, e) => { seen.store[e.key] = e.value; return { value: undefined } })
  on('command.register', ($, e) => { seen.commands.push(e.name); return { value: { command: e.name } } })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', ($, e) => (e.tool === 'Bash' && 'command' in e && /fail/.test(String(e.command))
    ? { isError: true as const, result: 'Exit code 1', text: 'Exit code 1' }
    : { result: { stdout: 'ok', stderr: '', interrupted: false } }))
  on('ui.render', ($, e) => {
    if (e.component === 'Spinner') return { type: 'Text', children: [`${e.props.word}…`] }
    if (e.component === 'TurnDuration' && splitLine) return { type: 'Box', children: [{ type: 'Text', children: [e.props.word] }, { type: 'Text', children: ['3s'] }] }
    if (e.component === 'TurnDuration') return { type: 'Text', props: { dimColor: true }, children: [`✻ ${e.props.word} for 3s`] }
    return { type: 'Box', children: [] }
  })
  return seen
}

const SPINNER = { word: 'Sauteing', message: null, suffix: '…', mode: 'requesting' as const }
const LINE = { word: 'Baked', durationMs: 3000 }
const prompt = (kind: 'composer' | 'task-notification') => ({ text: 'go', wait: false, origin: { kind } }) as never
const change = { command: 'change', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }

describe('the cabinet', () => {
  test('the longest folder wins, and every cabinet has verbs and an end phrase', () => {
    expect(cabinetOf('/home/u/rouge-warden/public/lab/tilt/main.js')?.id).toBe('tilt')
    expect(cabinetOf('public/lab/index.html')?.id).toBe('lab')
    expect(cabinetOf('/repo/games/olympus/App.tsx')?.id).toBe('olympus')
    expect(cabinetOf('/repo/follow-suit/src/game.ts')?.id).toBe('follow-suit')
    expect(cabinetOf('/repo/README.md')).toBeNull()
    for (const cabinet of CABINETS) {
      expect(cabinet.verbs.length).toBeGreaterThan(1)
      expect(cabinet.end.endsWith(' in')).toBe(true)
    }
    expect(durationText(3000)).toBe('3s')
    expect(durationText(64000)).toBe('1m 4s')
    expect(durationText(7_500_000)).toBe('2h 5m')
  })

  test('an edit in the fish game makes Reel It In the cabinet in play', async ($, on) => {
    const seen = world(on, 3)
    await $.tool.call({ tool: 'Edit', file_path: '/repo/public/fish/js/fish.js', old_string: 'a', new_string: 'b' })
    expect(seen.statuses.at(-1)).toBe('Reel It In · 3 tokens')

    const spinner = await $.ui.mount({ plugin: 'cabinet-spinner', surface: 'terminal', component: 'Spinner', props: SPINNER })
    const word = (await spinner.find({ type: 'Text' }))?.text ?? ''
    expect(['Casting…', 'Reeling…', 'Setting the hook…', 'Waiting for a bite…']).toContain(word)

    const line = await $.ui.mount({ plugin: 'cabinet-spinner', surface: 'terminal', component: 'TurnDuration', props: LINE })
    expect((await line.find({ type: 'Text' }))?.text).toBe('✻ Landed it in 3s')
  })

  test('the apps keep the engine\'s own step words', async ($, on) => {
    world(on, 3)
    await $.tool.call({ tool: 'Edit', file_path: '/repo/public/fish/js/fish.js', old_string: 'a', new_string: 'b' })
    for (const surface of ['desktop', 'mobile', 'vscode'] as const) {
      const spinner = await $.ui.mount({ plugin: 'cabinet-spinner', surface, component: 'Spinner', props: { ...SPINNER, word: 'Creating notes.md' } })
      expect((await spinner.find({ type: 'Text' }))?.text).toBe('Creating notes.md…')
    }
  })

  test('with no game in play the arcade words show, and an odd turn line gets a line of its own', async ($, on) => {
    world(on, 3, true)
    const line = await $.ui.mount({ plugin: 'cabinet-spinner', surface: 'terminal', component: 'TurnDuration', props: LINE })
    expect((await line.find({ type: 'Text', text: /Stage clear/ }))?.text).toBe('✻ Stage clear in 3s')
  })
})

describe('tokens', () => {
  test('a person\'s prompt spends a token, a green check run pays one back, and a notification is free', async ($, on) => {
    const seen = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    expect(seen.commands).toEqual(['change'])
    expect(seen.statuses.at(-1)).toBe('Cottage Arcade · 3 tokens')
    await $.prompt.submit(prompt('composer'))
    expect(seen.statuses.at(-1)).toBe('Cottage Arcade · 2 tokens')
    await $.tool.call({ tool: 'Bash', command: 'npm test --prefix games/olympus' })
    expect(seen.statuses.at(-1)).toBe('Cottage Arcade · 3 tokens')
    await $.tool.call({ tool: 'Bash', command: 'npm test failing' })
    await $.prompt.submit(prompt('task-notification'))
    expect(seen.store.tokens).toBe(3)
  })

  test('at zero the prompt still runs, and the status line says FREE PLAY', async ($, on) => {
    const seen = world(on, 0)
    const entered = await $.prompt.submit(prompt('composer'))
    expect(entered.text).toBe('go')
    expect(seen.statuses.at(-1)).toBe('Cottage Arcade · FREE PLAY')
    expect(seen.store.tokens).toBe(0)
  })

  test('the change machine adds three, up to nine', async ($, on) => {
    const seen = world(on, 1)
    expect((await $.command.run(change)).text).toBe('The change machine gives you 3 tokens. You have 4.')
    expect(seen.statuses.at(-1)).toBe('Cottage Arcade · 4 tokens')
    seen.store.tokens = 8
    expect((await $.command.run(change)).text).toBe('The change machine gives you 1 token. You have 9.')
    expect((await $.command.run(change)).text).toBe('Your pockets are full: 9 tokens.')
    expect(statusOf(CABINETS[0]!, 1)).toBe('Cottage Arcade · 1 token')
  })
})
