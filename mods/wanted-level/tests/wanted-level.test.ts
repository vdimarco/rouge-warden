import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CALM, faded, movesOf, raise } from '../hooks/heat.ts'

// The world beneath the wanted level: every tool call runs, and the toasts and status line are kept.
function world(on: On) {
  const seen = { toasts: [] as string[], statuses: [] as (string | undefined)[], ran: [] as string[] }
  const clock = mock.clock(on, { now: 9_000_000 })
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.status', ($, e) => { seen.statuses.push(e.text); return { value: undefined } })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', ($, e) => {
    seen.ran.push('command' in e ? String(e.command) : e.tool)
    return { result: { stdout: 'ok', stderr: '', interrupted: false } }
  })
  return { seen, clock }
}

const bash = (command: string) => ({ tool: 'Bash' as const, command })
const LAY_LOW = { command: 'lay-low', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }
const stars = (command: string) => movesOf({ tool: 'Bash', command }).reduce((n, m) => n + m.stars, 0)

describe('the heat', () => {
  test('risky moves earn their stars, and the rest earn none', () => {
    expect(stars('git push --force origin main')).toBe(2)
    expect(stars('git push -f')).toBe(2)
    expect(stars('git push origin +main')).toBe(2)
    expect(stars('git push --force-with-lease')).toBe(1)
    expect(stars('git push -u origin ccr-38123011-6zy79i')).toBe(0)
    expect(stars('rm -rf build')).toBe(1)
    expect(stars('rm -r -f build')).toBe(1)
    expect(stars('rm build.log')).toBe(0)
    expect(stars('git reset --hard origin/main')).toBe(1)
    expect(stars('git clean -fd')).toBe(1)
    expect(stars('git branch -D old')).toBe(1)
    expect(stars('cat higgsfield/.env.local')).toBe(2)
    expect(stars('cp .env.example .env.sample')).toBe(2)
    expect(stars('cat .env.example')).toBe(0)
    expect(stars('curl -X POST https://x.vercel.app/api/warden -d {}')).toBe(1)
    expect(stars('git status && npm test')).toBe(0)
    expect(stars('git commit -m "Stop the rm -rf in the build and the git push --force"')).toBe(0)
    expect(movesOf({ tool: 'Read', file_path: '/repo/higgsfield/.env.local' })).toEqual([{ what: 'a read of higgsfield/.env.local', stars: 2 }])
    expect(movesOf({ tool: 'Read', file_path: '/repo/.env.example' })).toEqual([])
    expect(movesOf({ tool: 'Read', file_path: '/repo/api/warden.js' })).toEqual([])
    expect(movesOf({ tool: 'Edit', file_path: '/repo/api/warden.js' })[0]?.stars).toBe(1)
    expect(movesOf({ tool: 'Write', file_path: '/repo/vercel.json' })[0]?.stars).toBe(1)
    expect(movesOf({ tool: 'mcp__Vercel__delete_project' })[0]?.stars).toBe(3)
    expect(movesOf({ tool: 'mcp__Supabase__reset_branch' })[0]?.stars).toBe(3)
    expect(movesOf({ tool: 'mcp__Vercel__list_projects' })).toEqual([])
  })

  test('the stars fade one at a time, from the last risky move', () => {
    const hot = raise(CALM, [{ what: 'x', stars: 3 }], 0)
    expect(faded(hot, 9 * 60_000, 600_000).stars).toBe(3)
    expect(faded(hot, 10 * 60_000, 600_000).stars).toBe(2)
    const later = faded(hot, 25 * 60_000, 600_000)
    expect(later.stars).toBe(1)
    expect(faded(later, 30 * 60_000, 600_000).stars).toBe(0)
  })
})

describe('the level', () => {
  test('rm -rf runs and earns one star', async ($, on) => {
    const w = world(on)
    const ran = await $.tool.call(bash('rm -rf build'))
    expect(ran.deny).toBeUndefined()
    expect(w.seen.ran).toEqual(['rm -rf build'])
    expect(w.seen.toasts).toEqual(['★☆☆☆☆ WANTED · +1 for rm -rf'])
    expect(w.seen.statuses.at(-1)).toBe('★☆☆☆☆ WANTED')
  })

  test('at five stars the next risky call is blocked, and a safe one still runs', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 3; i++) await $.tool.call(bash('git push --force'))
    expect(w.seen.statuses.at(-1)).toBe('★★★★★ WANTED')
    expect(w.seen.ran.length).toBe(3)
    const blocked = await $.tool.call(bash('git push --force'))
    expect(blocked.deny).toContain('WANTED (wanted-level): five stars')
    expect(blocked.deny).toContain('/lay-low')
    expect(w.seen.ran.length).toBe(3)
    expect(w.seen.toasts.at(-1)).toContain('BUSTED')
    const safe = await $.tool.call(bash('npm test'))
    expect(safe.deny).toBeUndefined()
    expect(w.seen.ran.at(-1)).toBe('npm test')
  })

  test('the heat fades on the status line, and a faded level lets a risky call run again', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 3; i++) await $.tool.call(bash('git push --force'))
    await w.clock.advance(10 * 60_000 + 30_000)
    expect(w.seen.statuses.at(-1)).toBe('★★★★☆ WANTED')
    const ran = await $.tool.call(bash('rm -rf dist'))
    expect(ran.deny).toBeUndefined()
    expect(w.seen.statuses.at(-1)).toBe('★★★★★ WANTED')
  })

  test('/lay-low clears the stars', async ($, on) => {
    const w = world(on)
    for (let i = 0; i < 3; i++) await $.tool.call(bash('git push --force'))
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    expect((await $.command.run(LAY_LOW)).text).toBe('You lay low. The heat is off.')
    expect(w.seen.statuses.at(-1)).toBeUndefined()
    expect((await $.tool.call(bash('git push --force'))).deny).toBeUndefined()
    expect(w.seen.statuses.at(-1)).toBe('★★☆☆☆ WANTED')
  })

  test('a read of a secret earns two stars, and an example file earns none', async ($, on) => {
    const w = world(on)
    await $.tool.call({ tool: 'Read', file_path: '/repo/.env.example' })
    await $.tool.call({ tool: 'Read', file_path: '/repo/higgsfield/.env.local' })
    expect(w.seen.toasts).toEqual(['★★☆☆☆ WANTED · +2 for a read of higgsfield/.env.local'])
  })

  test('the fade time follows the setting', { options: { fadeMinutes: 1 } }, async ($, on) => {
    const w = world(on)
    await $.tool.call(bash('git push --force'))
    await w.clock.advance(61_000)
    expect(w.seen.statuses.at(-1)).toBe('★☆☆☆☆ WANTED')
  })
})
