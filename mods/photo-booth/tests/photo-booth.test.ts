import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { isQaCommand, pngSize, rowsFor, shotDirs } from '../hooks/booth.ts'

const ROOT = '/repo'
const NOW = 7_000_000

// The bytes of a PNG header that states a width and a height.
function png(w: number, h: number): string {
  const b = new Uint8Array(32)
  b.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82], 0)
  b.set([(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255], 16)
  return btoa(String.fromCharCode(...b))
}

type Entry = { name: string; kind: 'file' | 'dir'; mtimeMs: number }

// Shot folders, panes and toasts; Bash runs that take no time.
function world(on: On, dirs: Record<string, Entry[]>) {
  const seen = { toasts: [] as string[], opened: [] as { id: string; focus?: true }[], listed: [] as string[] }
  mock.clock(on, { now: NOW })
  on('session.root', () => ({ value: ROOT }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.open', ($, e) => { seen.opened.push({ id: e.id, ...(e.focus ? { focus: true as const } : {}) }); return { value: { isPlaced: true as const } } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('fs.list', ($, e) => {
    seen.listed.push(e.path)
    const entries = dirs[e.path]
    if (entries === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: entries.map(x => ({ ...x, size: 1000, isLink: false })) }
  })
  on('fs.read', () => ({ value: { base64: png(1280, 800) } }))
  on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }))
  return seen
}

const PINBALL = 'SHOTS=/tmp/pinball-shots npm run test:pinball --prefix qa/browser'
const SHOTS = {
  '/tmp/pinball-shots': [
    { name: 'phone.png', kind: 'file' as const, mtimeMs: NOW + 50 },
    { name: 'desktop.png', kind: 'file' as const, mtimeMs: NOW + 80 },
    { name: 'old.png', kind: 'file' as const, mtimeMs: NOW - 60_000 },
    { name: 'notes.txt', kind: 'file' as const, mtimeMs: NOW + 90 },
    { name: 'tower', kind: 'dir' as const, mtimeMs: 0 },
  ],
  '/tmp/pinball-shots/tower': [{ name: 'landscape.png', kind: 'file' as const, mtimeMs: NOW + 70 }],
}
const pane = { title: 'Photo booth', isFocused: true, bodyColumns: 82, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40, contentRows: 30 }, view: {} }

describe('the rules', () => {
  test('QA commands, shot folders and picture sizes', () => {
    expect(isQaCommand(PINBALL)).toBe(true)
    expect(isQaCommand('NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs')).toBe(true)
    expect(isQaCommand('npm run qa --prefix follow-suit')).toBe(true)
    expect(isQaCommand('node qa/lab/tilt.sim.mjs')).toBe(true)
    expect(isQaCommand('GAME_URL=http://localhost:8765/river-rush/ node games/river-rush/tests/browser-check.mjs')).toBe(true)
    expect(isQaCommand('npm test --prefix games/olympus')).toBe(false)
    expect(isQaCommand('git status')).toBe(false)
    expect(shotDirs(PINBALL, ROOT)[0]).toBe('/tmp/pinball-shots')
    expect(shotDirs('OUT=shots/run node qa/x.mjs', ROOT, ['more'])).toContain('/repo/shots/run')
    expect(shotDirs('node qa/x.mjs', ROOT, ['more'])).toContain('/repo/more')
    expect(shotDirs('node qa/x.mjs', ROOT)).toContain('/repo/test-results')
    expect(shotDirs('node qa/river-rush/arcade.mjs', ROOT)).toContain('/tmp/river-rush-arcade-qa')
    expect(pngSize(Uint8Array.from(atob(png(1280, 800)), c => c.charCodeAt(0)))).toEqual({ w: 1280, h: 800 })
    expect(rowsFor({ w: 1280, h: 800 }, 80)).toBe(25)
    expect(rowsFor({ w: 390, h: 844 }, 80, 30)).toBe(30)
  })
})

describe('a QA run', () => {
  test('new shots bring a toast and the pane, newest first, deeper folders too', async ($, on) => {
    const seen = world(on, SHOTS)
    await $.tool.call({ tool: 'Bash', command: PINBALL })
    expect(seen.toasts).toEqual([`Photo booth: 3 new shots from ${PINBALL.slice(0, 59)}…. /photo-booth shows them.`])
    expect(seen.opened).toEqual([{ id: 'photo-booth' }])
    const drawn = await $.ui.mount({ plugin: 'photo-booth', surface: 'terminal', component: 'Pane', requestId: 'photo-booth', props: pane })
    expect((await drawn.find({ type: 'Text', text: /^Photo booth ·/ }))?.text).toBe('Photo booth · 1 / 3 · desktop.png')
    const image = await drawn.find({ type: 'Image', key: 'shot' })
    expect(image).toBeDefined()
    await drawn.press({ key: 'next' })
    expect((await drawn.find({ type: 'Text', text: /^Photo booth ·/ }))?.text).toBe('Photo booth · 2 / 3 · landscape.png')
    await drawn.press({ key: 'prev' })
    await drawn.press({ key: 'prev' })
    expect((await drawn.find({ type: 'Text', text: /^Photo booth ·/ }))?.text).toBe('Photo booth · 3 / 3 · phone.png')
  })

  test('the apps list the shots with their paths', async ($, on) => {
    world(on, SHOTS)
    await $.tool.call({ tool: 'Bash', command: PINBALL })
    for (const surface of ['desktop', 'mobile'] as const) {
      const app = await $.ui.mount({ plugin: 'photo-booth', surface, component: 'Pane', requestId: 'photo-booth', props: pane })
      expect((await app.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ /tmp/pinball-shots/desktop.png')
      expect(await app.find({ type: 'Text', text: /tower\/landscape\.png/ })).toBeDefined()
      await app.unmount()
    }
  })

  test('a run with no new shots opens nothing, and other commands look nowhere', async ($, on) => {
    const seen = world(on, { '/tmp/pinball-shots': [{ name: 'old.png', kind: 'file', mtimeMs: NOW - 60_000 }] })
    await $.tool.call({ tool: 'Bash', command: PINBALL })
    expect(seen.toasts).toEqual([])
    expect(seen.opened).toEqual([])
    const looked = seen.listed.length
    await $.tool.call({ tool: 'Bash', command: 'npm test --prefix games/olympus' })
    await $.tool.call({ tool: 'Bash', command: PINBALL, run_in_background: true })
    expect(seen.listed.length).toBe(looked)
  })

  test('/photo-booth opens the pane with the keys, and says when the booth is empty', async ($, on) => {
    const seen = world(on, {})
    const out = await $.command.run({ command: 'photo-booth', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
    expect(out.text).toBe('No shots yet. A QA run that saves PNG files fills the booth.')
    expect(seen.opened).toEqual([{ id: 'photo-booth', focus: true }])
  })
})
