// The wanted level: risky moves earn Crimson Rogue stars before they run. The stars show in the status
// line and fade with time. At five stars the next risky call is blocked, with a message that says why
// and how the heat goes. /lay-low clears the stars. Calls that are not risky are never blocked.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { CALM, MAX_STARS, blockText, faded, movesOf, raise, raiseToast, statusText } from './heat.ts'

const level = atom({ plugin: 'wanted-level', key: 'level' } as const, CALM)

// the clock that fades the stars on screen; starts over on a reload
let fading: Timer | null = null

async function cool($: EngineInterface, fadeMs: number): Promise<number> {
  const now = await $.clock.now()
  const before = await read($, level)
  const after = faded(before, now, fadeMs)
  if (after !== before) {
    await update($, level, held => faded(held, now, fadeMs))
    $.ui.status(statusText(after.stars))
  }
  if (after.stars === 0) {
    fading?.cancel()
    fading = null
  }
  return after.stars
}

export const register: Register = (on, options) => {
  const fadeMinutes = typeof options.fadeMinutes === 'number' && options.fadeMinutes > 0 ? options.fadeMinutes : 10
  const fadeMs = fadeMinutes * 60_000

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'lay-low', description: 'Lays low: the wanted level drops to zero stars.', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'lay-low' }, async $ => {
    await update($, level, () => CALM)
    $.ui.status(undefined)
    fading?.cancel()
    fading = null
    return { text: 'You lay low. The heat is off.' }
  })

  on('tool.call', async ($, e, next) => {
    const moves = movesOf(e as { tool: string } & Record<string, unknown>)
    if (moves.length === 0) return next(e)
    const stars = await cool($, fadeMs)
    if (stars >= MAX_STARS) {
      $.ui.toast(`BUSTED · five stars blocked ${moves.map(m => m.what).join(', ')}. /lay-low clears them.`, { timeoutMs: 8000 })
      return { deny: blockText(moves, fadeMinutes) }
    }
    const now = await $.clock.now()
    const after = await update($, level, held => raise(faded(held, now, fadeMs), moves, now))
    $.ui.toast(raiseToast(after.stars, moves))
    $.ui.status(statusText(after.stars))
    if (fading === null) fading = $.clock.every(30_000, () => { void cool($, fadeMs) })
    return next(e)
  })
}
