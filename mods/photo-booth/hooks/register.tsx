// The photo booth: after a foreground QA run, it looks in the shot folders for PNG files the run
// wrote. When it finds some, a toast says how many and a pane opens with the newest; p and n step
// through them. The terminal draws the picture (kitty and Ghostty; other terminals show its name).
// The desktop and mobile apps list the shots with their paths. /photo-booth opens the last set.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import { shortCommand } from './shared/checks.ts'
import { isQaCommand, newShots, pngSize, rowsFor, shotDirs } from './booth.ts'
import type { Shot } from './booth.ts'
import type { PhotoBoothSet } from '../types'

const shots = atom({ plugin: 'photo-booth', key: 'shots' } as const, { command: '', files: [], index: 0 } as PhotoBoothSet)

const PANE = 'photo-booth'
// how deep and how wide one look into the shot folders goes
const DEPTH = 3, MAX_ENTRIES = 2000

// picture sizes read once per file; a reload reads them again
const sizes = new Map<string, { w: number; h: number } | null>()

async function listPngs($: EngineInterface, dir: string, depth: number, out: Shot[]): Promise<void> {
  if (out.length >= MAX_ENTRIES) return
  let entries: Awaited<ReturnType<EngineInterface['fs']['list']>>
  try {
    entries = await $.fs.list(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const path = `${dir.replace(/\/+$/, '')}/${entry.name}`
    if (entry.kind === 'file' && /\.png$/i.test(entry.name)) out.push({ path, name: entry.name, mtimeMs: entry.mtimeMs, size: entry.size })
    else if (entry.kind === 'dir' && depth > 0 && entry.name !== 'node_modules') await listPngs($, path, depth - 1, out)
    if (out.length >= MAX_ENTRIES) return
  }
}

async function sizeOf($: EngineInterface, path: string): Promise<{ w: number; h: number } | null> {
  if (sizes.has(path)) return sizes.get(path) ?? null
  let size: { w: number; h: number } | null = null
  try {
    const read = await $.fs.read(path, { as: 'bytes' })
    const head = atob(typeof read === 'string' ? '' : read.base64.slice(0, 32))
    size = pngSize(Uint8Array.from(head, c => c.charCodeAt(0)))
  } catch {
    size = null
  }
  sizes.set(path, size)
  return size
}

async function step($: EngineInterface, by: number): Promise<void> {
  await update($, shots, set => ({ ...set, index: set.files.length === 0 ? 0 : (set.index + by + set.files.length) % set.files.length }))
}

export const register: Register = (on, options) => {
  const extra = typeof options.dirs === 'string' ? options.dirs.split(',').map(d => d.trim()).filter(Boolean) : []

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'photo-booth', description: 'Shows the screenshots the last QA run saved.', immediate: true })
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.run_in_background === true || !isQaCommand(e.command)) return next(e)
    const since = (await $.clock.now()) - 1000
    const ran = await next(e)
    const root = await $.session.root()
    const found: Shot[] = []
    for (const dir of shotDirs(e.command, root, extra)) await listPngs($, dir, DEPTH, found)
    const fresh = newShots(found, since)
    if (fresh.length === 0) return ran
    const command = shortCommand(e.command, 60)
    await update($, shots, () => ({ command, files: fresh, index: 0 }))
    $.ui.toast(`Photo booth: ${fresh.length} new shot${fresh.length === 1 ? '' : 's'} from ${command}. /photo-booth shows them.`)
    await $.ui.open({ id: PANE, title: 'Photo booth' })
    return ran
  })

  on('command.run', { command: 'photo-booth' }, async $ => {
    const set = await read($, shots)
    await $.ui.open({ id: PANE, title: 'Photo booth', focus: true, closeOnEscape: true })
    if (set.files.length === 0) return { text: 'No shots yet. A QA run that saves PNG files fills the booth.' }
    return { text: `Photo booth: ${set.files.length} shot${set.files.length === 1 ? '' : 's'} from ${set.command}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const set = await read($, shots)
    const shot = set.files[set.index]
    const { Box, Text, Button } = $.ui.resolve(e)
    const body: RenderElement[] = []
    if (shot === undefined) body.push(<Text dimColor>No shots yet. A QA run that saves PNG files fills the booth.</Text>)
    else if (e.surface === 'terminal') {
      const { Image } = $.ui.resolve(e)
      const columns = Math.max(16, Math.min(120, e.props.bodyColumns - 2))
      const rows = rowsFor(await sizeOf($, shot.path), columns, Math.max(8, e.props.scroll.bodyRows - 5))
      body.push(<Image key="shot" source={{ file: shot.path, format: 'png' }} columns={columns} rows={rows} alt={`${shot.name}: ${shot.path}`} />)
    } else {
      for (const [i, s] of set.files.slice(0, 20).entries()) {
        body.push(<Text key={`shot-${i}`} color={i === set.index ? '#ffd84a' : undefined} wrap="truncate-start">{`${i === set.index ? '▶' : ' '} ${s.path}`}</Text>)
      }
    }
    return (
      <Box flexDirection="column">
        <Text bold color="#5fb8d0" wrap="truncate-end">{shot === undefined ? 'Photo booth' : `Photo booth · ${set.index + 1} / ${set.files.length} · ${shot.name}`}</Text>
        {set.command !== '' && <Text dimColor wrap="truncate-end">{`from ${set.command}`}</Text>}
        {body}
        <Box flexDirection="row" gap={2}>
          {set.files.length > 1 && <Button key="prev" label="◀ prev" hotkey="p" onPress={() => void step($, -1)} />}
          {set.files.length > 1 && <Button key="next" label="next ▶" hotkey="n" onPress={() => void step($, 1)} />}
          <Button key="close" label="Close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
