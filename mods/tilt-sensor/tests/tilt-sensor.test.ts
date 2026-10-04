import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { changedPath, importsOf, isCommit, isOlympusBuild, olympusSource, quietBroken, scriptsOfPage, webpSize } from '../hooks/rules.ts'

const ROOT = '/repo'

// A WebP header (VP8L) that states a width and a height, padded to `bytes`.
function webp(w: number, h: number, bytes = 2048): string {
  const b = new Uint8Array(bytes)
  b.set([...'RIFF'].map(c => c.charCodeAt(0)), 0)
  b.set([...'WEBPVP8L'].map(c => c.charCodeAt(0)), 8)
  b[20] = 0x2f
  const bits = (w - 1) | ((h - 1) << 14)
  b.set([bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255], 21)
  return btoa(String.fromCharCode(...b))
}

const QUIET_PAGE = '<html><head><script src="/arcade/quiet.js"></script><script src="./game.js"></script></head></html>'
const LOUD_PAGE = '<html><head><script src="./game.js"></script></head></html>'
const LOUD_GAME = 'import { tune } from "./audio.js"; tune()'
const LOUD_AUDIO = 'export const tune = () => new AudioContext()'

// The world beneath the sensor: files, git status, Bash results, and the toasts and status line.
function world(on: On, files: Record<string, string> = {}, status = '') {
  const seen = { toasts: [] as string[], statuses: [] as (string | undefined)[], ran: [] as string[], git: status }
  const fs = new Map(Object.entries(files).map(([k, v]) => [`${ROOT}/${k}`, v]))
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.status', ($, e) => { seen.statuses.push(e.text); return { value: undefined } })
  on('session.root', () => ({ value: ROOT }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('fs.read', ($, e) => {
    const text = fs.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: e.as === 'bytes' ? { base64: text } : text }
  })
  on('fs.stat', ($, e) => {
    const text = fs.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: 'file' as const, size: Math.floor((text.length * 3) / 4), mtimeMs: 0, isLink: false } }
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: seen.git, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', ($, e) => {
    if ('command' in e) seen.ran.push(String(e.command))
    if ('file_path' in e && 'content' in e) fs.set(String(e.file_path), String(e.content))
    return { result: { stdout: 'ok', stderr: '', interrupted: false } }
  })
  return { seen, fs }
}

const edit = (file: string) => ({ tool: 'Edit' as const, file_path: `${ROOT}/${file}`, old_string: 'a', new_string: 'b' })
const write = (file: string, content: string) => ({ tool: 'Write' as const, file_path: `${ROOT}/${file}`, content })
const commit = { tool: 'Bash' as const, command: 'git add -A && git commit -m "Ship it"' }

describe('the rules', () => {
  test('sources, commits, scripts, pages and pictures are read the way the house rules mean', () => {
    expect(olympusSource('games/olympus/App.tsx')).toBe(true)
    expect(olympusSource('games/olympus/components/Map.tsx')).toBe(true)
    expect(olympusSource('games/olympus/tests/view.test.mjs')).toBe(false)
    expect(olympusSource('games/olympus/README.md')).toBe(false)
    expect(isCommit('git commit -m "x"')).toBe(true)
    expect(isCommit('git -c user.name=x commit --amend')).toBe(true)
    expect(isCommit('git commit --dry-run')).toBe(false)
    expect(isCommit('git log --oneline')).toBe(false)
    expect(isCommit('git add -A && git commit -m "x"')).toBe(true)
    expect(isOlympusBuild('npm run build --prefix games/olympus')).toBe(true)
    expect(isOlympusBuild('git commit -m "Run npm run build --prefix games/olympus"')).toBe(false)
    expect(scriptsOfPage(LOUD_PAGE, 'public/newgame/index.html')).toEqual(['public/newgame/game.js'])
    expect(importsOf(LOUD_GAME, 'public/newgame/game.js')).toEqual(['public/newgame/audio.js'])
    expect(importsOf('import x from "/arcade/chip.js"; import y from "./lib/three.js"', 'public/g/a.js')).toEqual(['public/arcade/chip.js'])
    expect(quietBroken(LOUD_PAGE, [LOUD_GAME, LOUD_AUDIO])).toBe(true)
    expect(quietBroken(QUIET_PAGE, [LOUD_AUDIO])).toBe(false)
    expect(quietBroken(LOUD_PAGE, ['console.log(1)'])).toBe(false)
    expect(webpSize(Uint8Array.from(atob(webp(640, 528)), c => c.charCodeAt(0)))).toEqual({ w: 640, h: 528 })
    expect(changedPath(' M games/olympus/App.tsx')).toBe('games/olympus/App.tsx')
    expect(changedPath('?? public/arcade/new.webp')).toBe('public/arcade/new.webp')
    expect(changedPath('R  old.js -> public/x/index.html')).toBe('public/x/index.html')
    expect(changedPath(' D gone.js')).toBeNull()
  })
})

describe('Olympus', () => {
  test('an edit warns at once, and a commit before the build tilts with the fix', async ($, on) => {
    const w = world(on)
    await $.tool.call(edit('games/olympus/App.tsx'))
    expect(w.seen.toasts[0]).toBe('DANGER · Olympus changed and its bundle was not built. Run `npm run build --prefix games/olympus` before you commit.')
    expect(w.seen.statuses.at(-1)).toBe('DANGER ×1 · Olympus changed and its bundle was not built')
    const ran = await $.tool.call(commit)
    expect(ran.deny).toContain('TILT (tilt-sensor)')
    expect(ran.deny).toContain('npm run build --prefix games/olympus')
    expect(w.seen.ran).toEqual([])
  })

  test('a green build closes the rule, and the commit runs', async ($, on) => {
    const w = world(on, {}, ' M games/olympus/App.tsx\n M public/olympus/game.js\n')
    await $.tool.call(edit('games/olympus/App.tsx'))
    await $.tool.call({ tool: 'Bash', command: 'npm run build --prefix games/olympus' })
    expect(w.seen.statuses.at(-1)).toBeUndefined()
    const ran = await $.tool.call(commit)
    expect(ran.deny).toBeUndefined()
    expect(w.seen.ran.at(-1)).toBe(commit.command)
  })

  test('a source change in the tree from outside the session tilts too, until a build runs', async ($, on) => {
    const w = world(on, {}, ' M games/olympus/lib/fire.ts\n')
    expect((await $.tool.call(commit)).deny).toContain('Olympus changed')
    await $.tool.call({ tool: 'Bash', command: 'cd games/olympus && npm run build' })
    expect((await $.tool.call(commit)).deny).toBeUndefined()
    expect(w.seen.ran.at(-1)).toBe(commit.command)
  })

  test('tests and notes of the game need no build', async ($, on) => {
    const w = world(on, {}, ' M games/olympus/tests/view.test.mjs\n')
    await $.tool.call(edit('games/olympus/tests/view.test.mjs'))
    expect(w.seen.toasts).toEqual([])
    expect((await $.tool.call(commit)).deny).toBeUndefined()
  })
})

describe('Follow Suit', () => {
  test('a source edit needs the arcade build, and qa:arcade counts', async ($, on) => {
    const w = world(on)
    await $.tool.call(edit('follow-suit/src/engine/deck.ts'))
    expect(w.seen.toasts[0]).toContain('npm run build:arcade --prefix follow-suit')
    await $.tool.call({ tool: 'Bash', command: 'npm run qa:arcade --prefix follow-suit' })
    expect((await $.tool.call(commit)).deny).toBeUndefined()
  })
})

describe('quiet.js', () => {
  test('a new page with sound in an imported script warns, and the fix closes the rule', async ($, on) => {
    const w = world(on, { 'public/newgame/game.js': LOUD_GAME, 'public/newgame/audio.js': LOUD_AUDIO })
    await $.tool.call(write('public/newgame/index.html', LOUD_PAGE))
    expect(w.seen.toasts[0]).toBe('DANGER · public/newgame/index.html makes sound but does not load quiet.js first. Load `<script src="/arcade/quiet.js"></script>` as the first script in `<head>`.')
    await $.tool.call(write('public/newgame/index.html', QUIET_PAGE))
    expect(w.seen.statuses.at(-1)).toBeUndefined()
  })

  test('In Full Swing is left alone, and a silent page needs nothing', async ($, on) => {
    const w = world(on, { 'public/vr/game.js': LOUD_AUDIO })
    await $.tool.call(write('public/vr/index.html', LOUD_PAGE.replace('./game.js', '/vr/game.js')))
    await $.tool.call(write('public/quietgame/index.html', '<html><head><script src="./x.js"></script></head></html>'))
    expect(w.seen.toasts).toEqual([])
  })

  test('a script edit checks its game\'s page', async ($, on) => {
    const w = world(on, { 'public/newgame/index.html': LOUD_PAGE, 'public/newgame/game.js': 'run()' })
    await $.tool.call(write('public/newgame/game.js', 'const ctx = new AudioContext()'))
    expect(w.seen.toasts[0]).toContain('public/newgame/index.html makes sound')
  })
})

describe('arcade screens', () => {
  test('a new screen 640 pixels wide tilts the commit; one of 480 and 20 KB does not', async ($, on) => {
    const w = world(on, { 'public/arcade/newgame.webp': webp(640, 528, 3000), 'public/arcade/okgame.webp': webp(480, 396, 20_000) },
      '?? public/arcade/newgame.webp\n?? public/arcade/okgame.webp\n')
    const ran = await $.tool.call(commit)
    expect(ran.deny).toContain('public/arcade/newgame.webp is 640 pixels wide')
    expect(ran.deny).not.toContain('okgame')
    w.seen.git = '?? public/arcade/okgame.webp\n'
    expect((await $.tool.call(commit)).deny).toBeUndefined()
  })

  test('a screen of 80 KB tilts the commit', async ($, on) => {
    world(on, { 'public/arcade/big.webp': webp(480, 396, 80_000) }, ' M public/arcade/big.webp\n')
    expect((await $.tool.call(commit)).deny).toContain('public/arcade/big.webp is 480 pixels wide and 78 KB')
  })
})

describe('the pane', () => {
  test('lists the open rules, and Reset lets the next commit run', async ($, on) => {
    const w = world(on, {}, ' M games/olympus/App.tsx\n')
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    const out = await $.command.run({ command: 'tilt-sensor', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
    expect(out.text).toBe('DANGER ×1: Olympus changed and its bundle was not built.')
    const props = { title: 'Tilt sensor', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 20, contentRows: 6 }, view: {} }
    for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
      const pane = await $.ui.mount({ plugin: 'tilt-sensor', surface, component: 'Pane', requestId: 'tilt-sensor', props })
      expect((await pane.find({ type: 'Text', text: /^DANGER/ }))?.text).toBe('DANGER · Olympus changed and its bundle was not built')
      await pane.unmount()
    }
    const pane = await $.ui.mount({ plugin: 'tilt-sensor', surface: 'terminal', component: 'Pane', requestId: 'tilt-sensor', props })
    await pane.press({ key: 'reset' })
    expect(w.seen.toasts.at(-1)).toBe('The tilt sensor is reset. The table is level.')
    expect(await pane.find({ type: 'Text', text: /All clear/ })).toBeDefined()
    expect((await $.tool.call(commit)).deny).toBeUndefined()
  })

  test('other commands pass untouched', async ($, on) => {
    const w = world(on)
    const ran = await $.tool.call({ tool: 'Bash', command: 'git status' })
    expect(ran.deny).toBeUndefined()
    expect(w.seen.ran).toEqual(['git status'])
    expect(w.seen.toasts).toEqual([])
  })
})
