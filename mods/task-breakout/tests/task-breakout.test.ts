import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { activeChange, changeOfPath, newlyChecked, parseTasks, stageClear } from '../hooks/tasks.ts'
import { knock, makeWall, standing, stepWall } from '../hooks/wall.ts'

const ROOT = '/repo'
const POLISH = '# Tasks\n\n## 1. Shell\n- [x] Boot screen\n- [ ] Store flag\n\n## 2. Fight\n- [ ] Slack prompt\n- [x] Gauge text\n'
const DONE = '# Tasks\n\n- [x] One\n- [x] Two\n'

// A file system of OpenSpec changes, and the toasts, suggestions and blits written down.
function world(on: On, files: Record<string, { text: string; mtimeMs: number }>) {
  const seen = { toasts: [] as string[], suggested: [] as string[], blits: 0, opened: [] as string[], store: {} as Record<string, unknown> }
  const fs = new Map(Object.entries(files).map(([k, v]) => [`${ROOT}/${k}`, v]))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 4, 12) })
  on('session.root', () => ({ value: ROOT }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.open', ($, e) => { seen.opened.push(e.id); return { value: { isPlaced: true as const } } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => { seen.blits++; return { value: {} } })
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('prompt.suggest', ($, e) => { seen.suggested.push(e.text); return { isShown: true } })
  on('store.get', ($, e) => ({ value: seen.store[e.key] }))
  on('store.set', ($, e) => { seen.store[e.key] = e.value; return { value: undefined } })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('fs.list', ($, e) => {
    const dir = `${e.path.replace(/\/$/, '')}/`
    const names = new Set<string>()
    for (const key of fs.keys()) if (key.startsWith(dir)) names.add(key.slice(dir.length).split('/')[0]!)
    return { value: [...names].map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('fs.stat', ($, e) => {
    const file = fs.get(e.path)
    if (file === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on('fs.read', ($, e) => {
    const file = fs.get(e.path)
    if (file === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: file.text }
  })
  on('tool.call', ($, e) => {
    if (e.tool === 'Edit') {
      const file = fs.get(e.file_path)!
      fs.set(e.file_path, { text: file.text.replace(e.old_string, e.new_string), mtimeMs: file.mtimeMs + 1 })
    }
    return { result: { ok: true } }
  })
  return { seen, clock }
}

const FILES = {
  'openspec/changes/fish-polish/tasks.md': { text: POLISH, mtimeMs: 200 },
  'openspec/changes/old-work/tasks.md': { text: DONE, mtimeMs: 100 },
  'openspec/changes/archive/2026-01-01-gone/tasks.md': { text: '- [ ] old', mtimeMs: 300 },
}
const check = (text: string) => ({
  tool: 'Edit' as const, file_path: `${ROOT}/openspec/changes/fish-polish/tasks.md`, old_string: `- [ ] ${text}`, new_string: `- [x] ${text}`,
})
const BREAKOUT = { command: 'breakout', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }
const PANE = { title: 'Task Breakout', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30, contentRows: 20 }, view: {} }
const end = { answer: 'ok', durationMs: 10, isAborted: false, turnId: 't', reason: 'answer' as const }

describe('the task lists', () => {
  test('boxes, sections, checked boxes, the active change and the cleared ones', () => {
    const tasks = parseTasks(POLISH)
    expect(tasks.map(t => [t.text, t.done, t.section])).toEqual([
      ['Boot screen', true, '1. Shell'], ['Store flag', false, '1. Shell'], ['Slack prompt', false, '2. Fight'], ['Gauge text', true, '2. Fight'],
    ])
    expect(newlyChecked(tasks, parseTasks(POLISH.replace('- [ ] Slack', '- [x] Slack')))).toEqual([2])
    expect(changeOfPath('/repo/openspec/changes/fish-polish/tasks.md')).toBe('fish-polish')
    expect(changeOfPath('/repo/openspec/changes/archive/tasks.md')).toBeNull()
    const changes = [{ name: 'a', tasks, mtimeMs: 1 }, { name: 'b', tasks: parseTasks(DONE), mtimeMs: 5 }]
    expect(activeChange(changes, null)?.name).toBe('a')
    expect(activeChange(changes, 'b')?.name).toBe('b')
    expect(stageClear(changes)).toEqual(['b'])
  })

  test('the wall has a brick for each open task, and a knock breaks one', () => {
    const wall = makeWall(parseTasks(POLISH), 60, 32, 3)
    expect(wall.bricks.length).toBe(4)
    expect(standing(wall)).toBe(2)
    expect(knock(wall, 0)).toBe(false)
    expect(knock(wall, 2)).toBe(true)
    for (let i = 0; i < 200 && standing(wall) === 2; i++) stepWall(wall, 0.05)
    expect(standing(wall)).toBe(1)
    expect(wall.bricks.find(b => b.task === 2)?.alive).toBe(false)
  })
})

describe('the pane', () => {
  test('/breakout opens the latest change with open tasks, drawn on every surface', async ($, on) => {
    const w = world(on, FILES)
    const out = await $.command.run(BREAKOUT)
    expect(out.text).toBe('Task Breakout: fish-polish, 2 left of 4.')
    expect(w.seen.opened).toEqual(['breakout'])
    await w.clock.advance(500)
    expect(w.seen.blits).toBeGreaterThan(5)
    const terminal = await $.ui.mount({ plugin: 'task-breakout', surface: 'terminal', component: 'Pane', requestId: 'breakout', props: PANE })
    expect(await terminal.find({ type: 'Raster', key: 'wall' })).toBeDefined()
    await terminal.unmount()
    for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
      const pane = await $.ui.mount({ plugin: 'task-breakout', surface, component: 'Pane', requestId: 'breakout', props: PANE })
      expect((await pane.find({ type: 'Text', text: /left of/ }))?.text).toBe('fish-polish · 2 left of 4')
      expect((await pane.find({ type: 'Text', text: /not archived/ }))?.text).toBe('Every box checked, not archived: old-work')
      expect(await pane.find({ type: 'Text', text: '□ Store flag' })).toBeDefined()
      await pane.unmount()
    }
    const desktop = await $.ui.mount({ plugin: 'task-breakout', surface: 'desktop', component: 'Pane', requestId: 'breakout', props: PANE })
    expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  })

  test('a checked box breaks a brick, and the last one is stage clear with an archive suggestion after the turn', async ($, on) => {
    const w = world(on, FILES)
    await $.command.run(BREAKOUT)
    await $.tool.call(check('Store flag'))
    expect(w.seen.toasts).toEqual(['Brick! Store flag · 1 left'])
    await $.tool.call(check('Slack prompt'))
    expect(w.seen.toasts.slice(1)).toEqual(['Brick! Slack prompt · 0 left', 'STAGE CLEAR · fish-polish has every box checked. Archive it.'])
    expect(w.seen.suggested).toEqual([])
    await $.turn.complete(end)
    await w.clock.advance(10)
    expect(w.seen.suggested).toEqual(['Archive the OpenSpec change fish-polish'])
    const pane = await $.ui.mount({ plugin: 'task-breakout', surface: 'terminal', component: 'Pane', requestId: 'breakout', props: PANE })
    expect((await pane.find({ type: 'Text', text: /STAGE CLEAR/ }))?.text).toBe('STAGE CLEAR · fish-polish · 0 left of 4')
  })

  test('closing the pane stops its frames', async ($, on) => {
    const w = world(on, FILES)
    await $.command.run(BREAKOUT)
    await w.clock.advance(200)
    const pane = await $.ui.mount({ plugin: 'task-breakout', surface: 'terminal', component: 'Pane', requestId: 'breakout', props: PANE })
    await pane.press({ key: 'close' })
    const before = w.seen.blits
    await w.clock.advance(1000)
    expect(w.seen.blits).toBe(before)
  })

  test('edits to other files and to the archive change nothing', async ($, on) => {
    const w = world(on, { ...FILES, 'notes.md': { text: '- [ ] a', mtimeMs: 1 } })
    await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/notes.md`, old_string: '- [ ] a', new_string: '- [x] a' })
    expect(w.seen.toasts).toEqual([])
  })
})

describe('the day', () => {
  test('a session start names the changes that wait for the archive, once a day', async ($, on) => {
    const w = world(on, FILES)
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    expect(w.seen.toasts).toEqual(['1 change has every box checked and waits for the archive. /breakout lists them.'])
  })
})
