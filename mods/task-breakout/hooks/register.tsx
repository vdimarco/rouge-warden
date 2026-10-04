// Task Breakout: /breakout opens a pane with the active OpenSpec change as a brick wall, one brick for
// each open task and a gap for each done one, with a ball and a paddle that play on it. When an edit
// checks a box, the ball flies to that brick and breaks it. When the last box is checked, the pane and
// a toast say STAGE CLEAR, and the prompt suggests the archive once the turn ends.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, Timer } from 'claude-code'

import { activeChange, changeOfPath, newlyChecked, openCount, parseTasks, stageClear } from './tasks.ts'
import type { Change, Task } from './tasks.ts'
import { knock, makeWall, stepWall, wallCells, wallSvg } from './wall.ts'
import type { Wall } from './wall.ts'
import type { BreakoutView } from '../types'

const view = atom({ plugin: 'task-breakout', key: 'view' } as const, null as BreakoutView | null)
const svgFrame = atom({ plugin: 'task-breakout', key: 'svgFrame' } as const, '')
const lastEdited = atom({ plugin: 'task-breakout', key: 'lastEdited' } as const, '')

const PANE = 'breakout'
const FRAME_MS = 50
// a frame for the apps every this many terminal frames (about 7 a second)
const SVG_EVERY = 3

// the scene and its loop live in the module: a reload builds them again from the task lists
let wall: Wall | null = null
let wallFor = ''
let tasksNow: Task[] = []
let size = { w: 60, h: 32 }
let loop: Timer | null = null
let frames = 0
let appSeenAt = 0
// the archive to suggest once the turn ends; the prompt box takes no suggestion during a turn
let suggestion = ''

async function loadChanges($: EngineInterface): Promise<Change[]> {
  const root = await $.session.root()
  const dir = `${root}/openspec/changes`
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
  try {
    entries = await $.fs.list(dir)
  } catch {
    return []
  }
  const changes: Change[] = []
  for (const entry of entries) {
    if (entry.kind !== 'dir' || entry.name === 'archive') continue
    const file = `${dir}/${entry.name}/tasks.md`
    try {
      const stat = await $.fs.stat(file)
      const text = await $.fs.read(file)
      if (typeof text === 'string') changes.push({ name: entry.name, tasks: parseTasks(text), mtimeMs: stat.mtimeMs })
    } catch {
      // a change with no task list has no wall
    }
  }
  return changes
}

/** Reads the task lists again, picks the active change, and builds its wall when it changed. */
async function refresh($: EngineInterface, pick?: string): Promise<Change | null> {
  const changes = await loadChanges($)
  const active = activeChange(changes, pick ?? ((await read($, lastEdited)) || null))
  const next: BreakoutView | null = active === null ? null : {
    change: active.name,
    left: openCount(active.tasks),
    total: active.tasks.length,
    next: active.tasks.filter(t => !t.done).slice(0, 3).map(t => t.text),
    cleared: stageClear(changes),
    others: changes.filter(c => openCount(c.tasks) > 0 && c.name !== active.name).map(c => c.name).sort(),
  }
  await update($, view, () => next)
  if (active !== null && (wall === null || wallFor !== active.name)) {
    tasksNow = active.tasks
    wall = makeWall(tasksNow, size.w, size.h, active.name.length)
    wallFor = active.name
  }
  return active
}

async function frameTick($: EngineInterface): Promise<void> {
  if (wall === null) return
  stepWall(wall, FRAME_MS / 1000)
  frames++
  void $.ui.blit({ requestId: PANE, key: 'wall', cells: wallCells(wall) }).catch(() => undefined)
  const now = await $.clock.now()
  if (now - appSeenAt < 5000 && frames % SVG_EVERY === 0) await update($, svgFrame, () => wallSvg(wall!))
}

function startLoop($: EngineInterface): void {
  if (loop === null) loop = $.clock.every(FRAME_MS, () => { void frameTick($) })
}

function stopLoop(): void {
  loop?.cancel()
  loop = null
}

/** An edit checked boxes: break their bricks, and say what is left. */
async function boxesChecked($: EngineInterface, name: string, before: Task[], after: Task[]): Promise<void> {
  const checked = newlyChecked(before, after)
  await update($, lastEdited, () => name)
  if (wallFor !== name) {
    // the wall of the change the edit was in, as it stood, so the ball has bricks to break
    tasksNow = before
    wall = makeWall(before, size.w, size.h, name.length)
    wallFor = name
  }
  for (const i of checked) if (wall !== null) knock(wall, i)
  const sameList = before.length === after.length && before.every((t, i) => t.text === after[i]?.text && (!t.done || after[i]!.done))
  if (!sameList) {
    tasksNow = after
    wall = makeWall(after, size.w, size.h, name.length)
  }
  await refresh($, name)
  if (checked.length === 0) return
  const left = openCount(after)
  const first = after[checked[0]!]!.text
  const what = checked.length === 1 ? (first.length > 60 ? `${first.slice(0, 59)}…` : first) : `${checked.length} tasks done`
  $.ui.toast(`Brick! ${what} · ${left} left`)
  if (left === 0) {
    $.ui.toast(`STAGE CLEAR · ${name} has every box checked. Archive it.`, { timeoutMs: 8000 })
    suggestion = `Archive the OpenSpec change ${name}`
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'breakout', description: 'Opens Task Breakout: the active OpenSpec change as a brick wall.', immediate: true })
    const today = new Date(await $.clock.now()).toDateString()
    if ((await $.store.get('noted')) !== today) {
      const cleared = stageClear(await loadChanges($))
      if (cleared.length > 0) {
        $.ui.toast(`${cleared.length} change${cleared.length === 1 ? ' has' : 's have'} every box checked and wait${cleared.length === 1 ? 's' : ''} for the archive. /breakout lists them.`)
        await $.store.set('noted', today)
      }
    }
    return next(e)
  })

  on('command.run', { command: 'breakout' }, async $ => {
    const active = await refresh($)
    await $.ui.open({ id: PANE, title: 'Task Breakout', focus: true, closeOnEscape: true })
    startLoop($)
    if (active === null) return { text: 'Task Breakout: no OpenSpec change has open tasks.' }
    return { text: `Task Breakout: ${active.name}, ${openCount(active.tasks)} left of ${active.tasks.length}.` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopLoop()
    return next(e)
  })

  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const name = changeOfPath(String(e.file_path))
    if (name === null) return next(e)
    const old = await $.fs.read(String(e.file_path)).catch(() => '')
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const now = await $.fs.read(String(e.file_path)).catch(() => '')
    if (typeof old === 'string' && typeof now === 'string') await boxesChecked($, name, parseTasks(old), parseTasks(now))
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && suggestion !== '') {
      const text = suggestion
      suggestion = ''
      $.clock.after(0, () => { void $.prompt.suggest({ text }) })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shown = await read($, view)
    const w = Math.max(30, Math.min(80, e.props.bodyColumns))
    const rows = Math.max(10, Math.min(18, Math.floor(w * 0.3)))
    if (wall === null || size.w !== w || size.h !== rows * 2) {
      size = { w, h: rows * 2 }
      if (shown !== null) wall = makeWall(tasksNow, size.w, size.h, shown.change.length)
    }
    const header = shown === null ? 'No OpenSpec change has open tasks.' : `${shown.change} · ${shown.left} left of ${shown.total}`
    const clear = shown !== null && shown.left === 0
    const hidden = wall !== null && wall.hidden > 0 ? ` · ${wall.hidden} more off the wall` : ''
    const body: RenderElement[] = []
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      if (wall !== null) body.push(<Raster key="wall" columns={size.w} rows={size.h / 2} cells={wallCells(wall)} />)
    } else {
      appSeenAt = await $.clock.now()
      const { Svg } = $.ui.resolve(e)
      const source = (await read($, svgFrame)) || (wall === null ? '' : wallSvg(wall))
      if (source !== '') body.push(<Svg source={source} alt={`A brick wall: ${header}`} width={Math.min(480, size.w * 7)} />)
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text bold color={clear ? '#7fd18b' : '#ffca51'}>{clear ? `STAGE CLEAR · ${header}` : `${header}${hidden}`}</Text>
        {body}
        {shown !== null && shown.next.map((t, i) => <Text key={`next-${i}`} dimColor wrap="truncate-end">{`□ ${t}`}</Text>)}
        {shown !== null && shown.cleared.length > 0 && (
          <Text color="#7fd18b" wrap="wrap">{`Every box checked, not archived: ${shown.cleared.join(', ')}`}</Text>
        )}
        <Box flexDirection="row" gap={2}>
          {shown !== null && shown.others.length > 0 && (
            <Button key="next" label="Next change" hotkey="n" onPress={() => void nextChange($)} />
          )}
          <Button key="close" label="Close" role="dismiss" onPress={() => { stopLoop(); void $.ui.close({ id: PANE }) }} />
        </Box>
      </Box>
    )
  })
}

async function nextChange($: EngineInterface): Promise<void> {
  const shown = await read($, view)
  if (shown === null || shown.others.length === 0) return
  const name = shown.others[0]!
  await update($, lastEdited, () => name)
  wall = null
  await refresh($, name)
}
