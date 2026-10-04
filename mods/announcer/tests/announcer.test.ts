import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { bare, kindOf, outcomeOf } from '../hooks/shared/checks.ts'

type BashRecord = { stdout: string; stderr: string; interrupted: boolean; backgroundTaskId?: string; gitOperation?: unknown }

// The world beneath the announcer: Bash answers from a script, and the toasts, the status line, the
// store and the clips are written down.
function world(on: On) {
  const seen = { toasts: [] as string[], statuses: [] as (string | undefined)[], clips: [] as string[], store: {} as Record<string, unknown> }
  const answers = new Map<string, { isError?: true; record?: BashRecord; text?: string }>()
  const clock = mock.clock(on, { now: 1_000_000 })
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.status', ($, e) => { seen.statuses.push(e.text); return { value: undefined } })
  on('store.get', ($, e) => ({ value: seen.store[e.key] }))
  on('store.set', ($, e) => { seen.store[e.key] = e.value; return { value: undefined } })
  on('audio.play', ($, e) => { if ('asset' in e.clip && e.clip.asset) seen.clips.push(e.clip.asset); return { value: undefined } })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.receive', ($, e) => ({ text: e.text }))
  on('tool.call', ($, e) => {
    const command = 'command' in e ? String(e.command) : ''
    const answer = answers.get(command) ?? { record: { stdout: 'ok', stderr: '', interrupted: false } }
    if (answer.isError) return { isError: true as const, result: answer.text ?? 'Exit code 1', text: answer.text ?? 'Exit code 1' }
    return { result: answer.record }
  })
  return { seen, answers, clock }
}

const GREEN = 'node qa/lab/tilt.sim.mjs'
let turns = 0
const turn = ($: { turn: { start: (e: { text: string; turnId: string }) => Promise<unknown> } }) =>
  $.turn.start({ text: 'go', turnId: `t${++turns}` })

describe('reading a command', () => {
  test('check runs and builds are told apart, and a message is only text', () => {
    expect(kindOf('node qa/lab/tilt.sim.mjs')).toBe('check')
    expect(kindOf('NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs')).toBe('check')
    expect(kindOf('npm test --prefix games/olympus')).toBe('check')
    expect(kindOf('npm run check --prefix follow-suit')).toBe('check')
    expect(kindOf('cd mods && claude plugin test announcer')).toBe('check')
    expect(kindOf('npm run build --prefix games/olympus')).toBe('build')
    expect(kindOf('git status')).toBeNull()
    expect(kindOf('git commit -m "Fix the tsc errors and run npm test"')).toBeNull()
    expect(kindOf("git commit -F - <<'EOF'\nRun node qa/lab/tilt.sim.mjs\nEOF")).toBeNull()
    expect(bare('git commit -m "a" && npm test')).toBe('git commit  && npm test')
    expect(outcomeOf({}, { result: { stdout: '  ok   one\n  FAIL two', stderr: '', interrupted: false } })).toBe('red')
    expect(outcomeOf({}, { result: { stdout: ' 12 pass\n 0 fail', stderr: '', interrupted: false } })).toBe('green')
    expect(outcomeOf({}, { isError: true, result: 'x', text: 'Interrupted by user' })).toBe('skip')
  })
})

describe('green runs', () => {
  test('the first green run is first blood, with its clip', async ($, on) => {
    const w = world(on)
    await turn($)
    await $.tool.call({ tool: 'Bash', command: GREEN })
    await w.clock.advance(10)
    expect(w.seen.toasts).toEqual([`FIRST BLOOD · ${GREEN}`])
    expect(w.seen.clips).toEqual(['announcer/first-blood.mp3'])
  })

  test('a streak climbs one green run a turn, and the status line keeps the best', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 5; i++) {
      await turn($)
      await $.tool.call({ tool: 'Bash', command: GREEN })
    }
    await w.clock.advance(20_000)
    expect(w.seen.toasts.map(t => t.split(' · ')[0])).toEqual(['FIRST BLOOD', 'KILLING SPREE', 'DOMINATING', 'MEGA KILL'])
    expect(w.seen.clips).toEqual([
      'announcer/first-blood.mp3', 'announcer/killing-spree.mp3', 'announcer/dominating.mp3', 'announcer/mega-kill.mp3',
    ])
    expect(w.seen.statuses.at(-1)).toBe('Streak 5 · best 5')
    expect(w.seen.store.best).toBe(5)
  })

  test('green runs in one turn are multi kills', async ($, on) => {
    const w = world(on)
    await turn($)
    for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Bash', command: GREEN })
    expect(w.seen.toasts.map(t => t.split(' · ')[0])).toEqual(['FIRST BLOOD', 'DOUBLE KILL', 'TRIPLE KILL', 'MAYHEM'])
  })

  test('clips wait their turn and never play over each other', async ($, on) => {
    const w = world(on)
    await turn($)
    await $.tool.call({ tool: 'Bash', command: GREEN })
    await $.tool.call({ tool: 'Bash', command: GREEN })
    await w.clock.advance(10)
    expect(w.seen.clips).toEqual(['announcer/first-blood.mp3'])
    await w.clock.advance(2_000)
    expect(w.seen.clips).toEqual(['announcer/first-blood.mp3', 'announcer/double-kill.mp3'])
  })
})

describe('red runs', () => {
  test('a red run ends a streak of 4 with a shut down', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 4; i++) {
      await turn($)
      await $.tool.call({ tool: 'Bash', command: GREEN })
    }
    w.answers.set('npm test', { isError: true })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await w.clock.advance(20_000)
    expect(w.seen.toasts.at(-1)).toBe('SHUT DOWN · the 4-run streak ends')
    expect(w.seen.clips.at(-1)).toBe('announcer/game-over.mp3')
    expect(w.seen.statuses.at(-1)).toBeUndefined()
  })

  test('a failure that a pipe hides is still red', async ($, on) => {
    const w = world(on)
    const piped = 'npm test 2>&1 | tail -5'
    w.answers.set(piped, { record: { stdout: 'Tests: 2 failed, 9 passed', stderr: '', interrupted: false } })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: piped })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: GREEN })
    // the red run came first, so the first green run is still first blood, and no streak was shut down
    expect(w.seen.toasts).toEqual([`FIRST BLOOD · ${GREEN}`])
  })

  test('a red run with no streak says nothing', async ($, on) => {
    const w = world(on)
    w.answers.set('npm test', { isError: true })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    expect(w.seen.toasts).toEqual([])
  })
})

describe('what does not count', () => {
  test('commands that are not check runs, background runs and stopped runs say nothing', async ($, on) => {
    const w = world(on)
    w.answers.set('npm test -- --watch', { record: { stdout: '', stderr: '', interrupted: true } })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: 'ls -la' })
    await $.tool.call({ tool: 'Bash', command: GREEN, run_in_background: true })
    await $.tool.call({ tool: 'Bash', command: 'npm test -- --watch' })
    expect(w.seen.toasts).toEqual([])
  })
})

describe('merges and GitHub', () => {
  test('a merge with no red run is a flawless victory', async ($, on) => {
    const w = world(on)
    w.answers.set('gh pr merge 12', {
      record: { stdout: 'merged', stderr: '', interrupted: false, gitOperation: { pr: { number: 12, action: 'merged' } } },
    })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: 'gh pr merge 12' })
    expect(w.seen.toasts).toEqual(['FLAWLESS VICTORY · the pull request is merged'])
  })

  test('a merge after a red run is a win, and a failed check on GitHub is a loss', async ($, on) => {
    const w = world(on)
    w.answers.set('npm test', { isError: true })
    await turn($)
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    const event = (kind: string, data: Record<string, unknown>) => ({
      origin: { kind: 'task-notification' as const }, text: kind, event: { source: 'github', kind, data, untrustedKeys: [] },
    })
    const kept = await $.session.receive(event('pull_request.closed', { pr: 'a/b#3', outcome: 'merged' }))
    await $.session.receive(event('check_suite', { conclusion: 'failure' }))
    expect(kept.text).toBe('pull_request.closed')
    expect(w.seen.toasts).toEqual(['YOU WIN · the pull request is merged', 'YOU LOSE · a check failed on GitHub'])
  })
})

describe('settings', () => {
  test('with sound off the toasts still show and no clip plays', { options: { sound: false } }, async ($, on) => {
    const w = world(on)
    await turn($)
    await $.tool.call({ tool: 'Bash', command: GREEN })
    await w.clock.advance(10)
    expect(w.seen.toasts.length).toBe(1)
    expect(w.seen.clips).toEqual([])
  })

  test('the greeting plays when a session starts', { options: { greeting: true } }, async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await w.clock.advance(10)
    expect(w.seen.toasts).toEqual(['PREPARE YOURSELF'])
    expect(w.seen.clips).toEqual(['announcer/prepare-yourself.mp3'])
  })

  test('a machine with no player stays quiet with no error', async ($, on) => {
    const toasts: string[] = []
    mock.clock(on)
    on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
    on('ui.status', () => ({ value: undefined }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('audio.play', () => { throw new Error('no player') })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }))
    await turn($)
    const ran = await $.tool.call({ tool: 'Bash', command: GREEN })
    expect(ran.isError).toBeUndefined()
    expect(toasts.length).toBe(1)
  })
})
