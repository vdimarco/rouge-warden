// Full Tilt in a pane: /full-tilt opens the classic Full Tilt table, run by the game's own physics.
// z and m flip, l launches, k drops the ball soft into a top lane for a skill shot, n starts a new
// game, p pauses. In the terminal the table pauses while the pane does not hold the keys. The desktop
// and mobile apps get the table as SVG and press the Buttons. The best score is kept across sessions.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, Timer } from 'claude-code'

import { FULL_PULL, SOFT_PULL, launchBall, makeGame, newGame, press, shownMessage, sizeGame, tableCells, tableSvg, tickGame } from './game.ts'
import type { Game } from './game.ts'
import type { FullTiltHud } from '../types'

const hud = atom({ plugin: 'full-tilt', key: 'hud' } as const, { score: 0, balls: 3, multiplier: 1, best: 0, message: '', state: 'ready', paused: false } as FullTiltHud)
const svgFrame = atom({ plugin: 'full-tilt', key: 'svgFrame' } as const, '')

const PANE = 'full-tilt'
const FRAME_MS = 33
// a frame for the apps every this many terminal frames (about 7 a second)
const SVG_EVERY = 4

// the table and its clock live in the module: a reload starts a new game
let game: Game | null = null
let loop: Timer | null = null
let frames = 0
let held = false
let terminalSeen = false
let terminalFocused = true
let appSeenAt = 0
let best = 0

const paused = (now: number): boolean => held || (terminalSeen && !terminalFocused && now - appSeenAt > 5000)

async function showHud($: EngineInterface, now: number): Promise<void> {
  if (game === null) return
  const next: FullTiltHud = {
    score: game.score, balls: game.balls, multiplier: game.multiplier, best: Math.max(best, game.score),
    message: shownMessage(game), state: game.state, paused: paused(now),
  }
  const was = await read($, hud)
  if (JSON.stringify(was) !== JSON.stringify(next)) await update($, hud, () => next)
}

async function frameTick($: EngineInterface): Promise<void> {
  if (game === null) return
  const now = await $.clock.now()
  const before = game.state
  if (!paused(now)) tickGame(game, FRAME_MS / 1000)
  frames++
  if (before !== 'over' && game.state === 'over' && game.score > best) {
    best = game.score
    await $.store.set('best', best)
  }
  void $.ui.blit({ requestId: PANE, key: 'table', cells: tableCells(game) }).catch(() => undefined)
  if (now - appSeenAt < 5000 && frames % SVG_EVERY === 0) await update($, svgFrame, () => tableSvg(game!))
  if (frames % 3 === 0) await showHud($, now)
}

function stopLoop(): void {
  loop?.cancel()
  loop = null
}

async function act($: EngineInterface, what: 'left' | 'right' | 'launch' | 'soft' | 'new' | 'pause'): Promise<void> {
  if (game === null) return
  if (what === 'left') press(game, -1)
  if (what === 'right') press(game, 1)
  if (what === 'launch') launchBall(game, FULL_PULL)
  if (what === 'soft') launchBall(game, SOFT_PULL)
  if (what === 'new') newGame(game)
  if (what === 'pause') held = !held
  await showHud($, await $.clock.now())
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'full-tilt', description: 'Plays Full Tilt pinball in a pane: z and m flip, l launches.', immediate: true })
    const kept = await $.store.get('best')
    if (typeof kept === 'number') best = kept
    return next(e)
  })

  on('command.run', { command: 'full-tilt' }, async $ => {
    game ??= makeGame(40)
    held = false
    await $.ui.open({ id: PANE, title: 'Full Tilt', focus: true })
    if (loop === null) loop = $.clock.every(FRAME_MS, () => { void frameTick($) })
    await showHud($, await $.clock.now())
    return { text: 'Full Tilt: z and m flip, l launches, k drops the ball soft into a top lane for a skill shot, n starts a new game, p pauses.' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopLoop()
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    game ??= makeGame(40)
    const shown = await read($, hud)
    const body: RenderElement[] = []
    if (e.surface === 'terminal') {
      terminalSeen = true
      terminalFocused = e.props.isFocused
      // the table and the lines under it share the pane's rows
      sizeGame(game, Math.min(48, e.props.bodyColumns - 2), Math.max(40, (e.props.scroll.bodyRows - 6) * 2))
      const { Raster } = $.ui.resolve(e)
      body.push(<Raster key="table" columns={game.cols} rows={game.rows / 2} cells={tableCells(game)} />)
    } else {
      appSeenAt = await $.clock.now()
      const { Svg } = $.ui.resolve(e)
      body.push(<Svg source={(await read($, svgFrame)) || tableSvg(game)} alt={`A pinball table. Score ${shown.score}.`} width={260} />)
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    const line = `SCORE ${shown.score.toLocaleString('en-US')}${shown.multiplier > 1 ? `  ×${shown.multiplier}` : ''}  BALL ${Math.min(3, 4 - shown.balls)}/3  BEST ${shown.best.toLocaleString('en-US')}`
    const note = shown.state === 'over'
      ? `GAME OVER · ${shown.score.toLocaleString('en-US')} · n starts a new game`
      : shown.paused ? (held ? 'PAUSED · p plays on' : 'PAUSED · click the table or press ctrl+x tab to play') : shown.message
    return (
      <Box flexDirection="column">
        <Text bold color="#f5a6e5">{line}</Text>
        {body}
        <Text color={shown.state === 'over' ? '#ff6b4a' : '#ffd84a'} wrap="truncate-end">{note || ' '}</Text>
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Button key="left" label="◀ flip" hotkey="z" plain onPress={() => void act($, 'left')} />
          <Button key="right" label="flip ▶" hotkey="m" plain onPress={() => void act($, 'right')} />
          <Button key="launch" label="launch" hotkey="l" plain onPress={() => void act($, 'launch')} />
          <Button key="soft" label="soft" hotkey="k" plain onPress={() => void act($, 'soft')} />
          <Button key="new" label="new" hotkey="n" plain onPress={() => void act($, 'new')} />
          <Button key="pause" label={held ? 'play' : 'pause'} hotkey="p" plain onPress={() => void act($, 'pause')} />
          <Button key="close" label="close" role="dismiss" plain onPress={() => { stopLoop(); void $.ui.close({ id: PANE }) }} />
        </Box>
      </Box>
    )
  })
}
