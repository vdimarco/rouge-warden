// Attract mode: when the main session has been idle for a few minutes, a pane opens with a live
// Primordia Lenia dish, like the attract screen of an arcade cabinet. The next prompt closes a pane
// that attract mode opened by itself. /attract opens one at any time, and it stays until closed.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, Timer } from 'claude-code'

import { dishCells, dishSvg, makeDish, stepDish } from './dish.ts'
import type { Dish } from './dish.ts'

const svgFrame = atom({ plugin: 'attract-mode', key: 'svgFrame' } as const, '')
// how the pane came up: 'idle' by itself, 'asked' by /attract, '' while closed
const opened = atom({ plugin: 'attract-mode', key: 'opened' } as const, '' as '' | 'idle' | 'asked')

const PANE = 'attract'
const FRAME_MS = 66
// a frame for the apps every this many terminal frames (about 5 a second)
const SVG_EVERY = 3

// the dish and its clocks live in the module: a reload grows a new dish
let dish: Dish | null = null
let loop: Timer | null = null
let idle: Timer | null = null
let cols = 64
let frames = 0
let drawn = false
let appSeenAt = 0

async function frameTick($: EngineInterface): Promise<void> {
  // a pane that waits undrawn (a narrow terminal) costs nothing
  if (dish === null || !drawn) return
  stepDish(dish)
  frames++
  void $.ui.blit({ requestId: PANE, key: 'dish', cells: dishCells(dish, cols) }).catch(() => undefined)
  const now = await $.clock.now()
  if (now - appSeenAt < 5000 && frames % SVG_EVERY === 0) await update($, svgFrame, () => dishSvg(dish!))
}

async function start($: EngineInterface, how: 'idle' | 'asked'): Promise<boolean> {
  dish ??= makeDish(64, Math.floor((await $.clock.now()) / 1000))
  drawn = false
  await update($, opened, () => how)
  const placed = await $.ui.open(how === 'asked'
    ? { id: PANE, title: 'Primordia', focus: true, closeOnEscape: true }
    : { id: PANE, title: 'Primordia' })
  if (loop === null) loop = $.clock.every(FRAME_MS, () => { void frameTick($) })
  return placed.isPlaced
}

async function stop($: EngineInterface): Promise<void> {
  loop?.cancel()
  loop = null
  drawn = false
  await update($, opened, () => '')
}

/** Back to work: a pane that attract mode opened by itself goes. */
async function wake($: EngineInterface): Promise<void> {
  idle?.cancel()
  idle = null
  if ((await read($, opened)) === 'idle') {
    await stop($)
    await $.ui.close({ id: PANE })
  }
}

export const register: Register = (on, options) => {
  const minutes = typeof options.idleMinutes === 'number' && options.idleMinutes > 0 ? options.idleMinutes : 3

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'attract', description: 'Opens attract mode: a live Primordia Lenia dish.', immediate: true })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      idle?.cancel()
      idle = $.clock.after(minutes * 60_000, () => {
        idle = null
        void start($, 'idle')
      })
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await wake($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await wake($)
    return next(e)
  })

  on('command.run', { command: 'attract' }, async $ => {
    idle?.cancel()
    idle = null
    await start($, 'asked')
    return { text: 'Attract mode: a live Primordia dish. Esc closes it.' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await stop($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    dish ??= makeDish(64, 1)
    drawn = true
    const how = await read($, opened)
    const body: RenderElement[] = []
    if (e.surface === 'terminal') {
      // an even width, so the square dish is cols cells by cols / 2 rows of two pixels
      cols = Math.max(16, Math.min(64, e.props.bodyColumns)) & ~1
      const { Raster } = $.ui.resolve(e)
      body.push(<Raster key="dish" columns={cols} rows={cols / 2} cells={dishCells(dish, cols)} />)
    } else {
      appSeenAt = await $.clock.now()
      const { Svg } = $.ui.resolve(e)
      body.push(<Svg source={(await read($, svgFrame)) || dishSvg(dish)} alt="A live Lenia dish: two Orbiums glide over the agar." width={288} />)
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {body}
        <Text bold color="#3ff0e0">PRIMORDIA · INSERT COIN</Text>
        <Text dimColor wrap="wrap">{how === 'idle' ? 'A Lenia dish from the Primordia cabinet. Your next prompt closes it.' : 'A Lenia dish from the Primordia cabinet.'}</Text>
        <Box>
          <Button key="close" label="Close" role="dismiss" onPress={() => { void stop($); void $.ui.close({ id: PANE }) }} />
        </Box>
      </Box>
    )
  })
}
