// The announcer: green check runs are kills, and the Shore of the Ancients announcer calls them.
// A toast carries every call. The clip plays where Claude Code can play one (afplay on macOS), one at
// a time, and a machine with no player stays quiet with no error.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { githubNews, kindOf, mergedByBash, mergedByTool, outcomeOf, shortCommand } from './shared/checks.ts'
import { EMPTY, GREETING, LOST, green, merged, newTurn, red, toastOf } from './calls.ts'
import type { Call, Tally } from './calls.ts'

const tally = atom({ plugin: 'announcer', key: 'tally' } as const, EMPTY)

// how long one clip holds the line before the next may start
const CLIP_MS = 1800

// when the last queued clip ends; starts over on a reload, which only lets one clip overlap
let quietUntil = 0

async function announce($: EngineInterface, call: Call, sound: boolean): Promise<void> {
  $.ui.toast(toastOf(call))
  if (!sound) return
  const now = await $.clock.now()
  const wait = Math.max(0, quietUntil - now)
  quietUntil = Math.max(now, quietUntil) + CLIP_MS
  $.clock.after(wait, () => {
    void $.audio.play({ asset: `announcer/${call.clip}.mp3` }).catch(() => undefined)
  })
}

async function showStreak($: EngineInterface, t: Tally): Promise<void> {
  const best = Math.max(Number((await $.store.get('best')) ?? 0), t.streak)
  if (t.streak === best && t.streak > 0) await $.store.set('best', best)
  $.ui.status(t.streak >= 2 ? `Streak ${t.streak} · best ${best}` : undefined)
}

export const register: Register = (on, options) => {
  const sound = options.sound !== false

  on('session.start', async ($, e, next) => {
    if (options.greeting === true) await announce($, GREETING, sound)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await update($, tally, newTurn)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (mergedByBash(ran)) {
      await announce($, merged(await read($, tally)), sound)
      return ran
    }
    if (kindOf(e.command) !== 'check') return ran
    const outcome = outcomeOf(e, ran)
    if (outcome === 'skip') return ran
    // update may run the change again on a miss, so the call is the last run's
    const said: { call: Call | null } = { call: null }
    const now = await update($, tally, prev => {
      const step = outcome === 'green' ? green(prev, shortCommand(e.command)) : red(prev)
      said.call = step.call
      return step.tally
    })
    if (said.call !== null) await announce($, said.call, sound)
    await showStreak($, now)
    return ran
  })

  on('tool.call', { tool: /^mcp__.*github.*__merge_pull_request$/i }, async ($, e, next) => {
    const ran = await next(e)
    if (mergedByTool(e.tool, ran)) await announce($, merged(await read($, tally)), sound)
    return ran
  })

  on('session.receive', async ($, e, next) => {
    const news = githubNews(e.event)
    if (news === 'merged') await announce($, merged(await read($, tally)), sound)
    if (news === 'failed') await announce($, LOST, sound)
    return next(e)
  })
}
