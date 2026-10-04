// The creel: while a foreground Bash command runs 3 seconds or more, a bobber sits on the water in the
// band above the prompt. When the command ends, something comes up on the line: a Reel It In fish for
// a green run (longer runs bring heavier fish), junk for a red one, and the Golden Loon Bass for a
// merged pull request. The catch is kept across sessions, with one goal a day; /creel shows it all.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { githubNews, kindOf, mergedByBash, mergedByTool, outcomeOf, shortCommand } from './shared/checks.ts'
import { dayKey, dayNumber } from './shared/days.ts'
import { hashOf, seeded } from './shared/rng.ts'
import { BITE_MS, EMPTY_CREEL, addTo, goalOf, landGreen, landLegend, landRed, progressOf, revealText } from './catch.ts'
import type { Creel, Fish } from './catch.ts'
import type { CreelLine, CreelToday } from '../types'

const lines = atom({ plugin: 'creel', key: 'lines' } as const, [] as CreelLine[])
const landed = atom({ plugin: 'creel', key: 'landed' } as const, null as { text: string; until: number } | null)
const frame = atom({ plugin: 'creel', key: 'frame' } as const, 0)
const creel = atom({ plugin: 'creel', key: 'creel' } as const, EMPTY_CREEL)
const today = atom({ plugin: 'creel', key: 'today' } as const, { key: '', catches: [], done: false } as CreelToday)

const PANE = 'creel'
// how long a catch stays on the band
const SHOW_MS = 6000
const WATER = '#5fb8d0', BOBBER = '#ff6b4a', FISH = '#ffb04a'

// the band's animation clock; starts over on a reload
let ticker: Timer | null = null

async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const shown = await read($, landed)
  const out = await read($, lines)
  if (out.length === 0 && (shown === null || shown.until <= now)) {
    ticker?.cancel()
    ticker = null
    if (shown !== null) await update($, landed, () => null)
    return
  }
  await update($, frame, n => n + 1)
}

function animate($: EngineInterface): void {
  if (ticker === null) ticker = $.clock.every(500, () => { void tick($) })
}

/** Brings today's log up to date for the day of `now`, and the creel up from the store once. */
async function loadToday($: EngineInterface, now: number): Promise<CreelToday> {
  const held = await read($, today)
  if (held.key === dayKey(now)) return held
  const kept = (await $.store.get('today')) as CreelToday | undefined
  const fresh = kept !== undefined && kept.key === dayKey(now) ? kept : { key: dayKey(now), catches: [], done: false }
  await update($, today, () => fresh)
  return fresh
}

async function land($: EngineInterface, fish: Fish): Promise<void> {
  const now = await $.clock.now()
  const kept = (await $.store.get('creel')) as Creel | undefined
  const nextCreel = addTo(kept ?? EMPTY_CREEL, fish)
  await $.store.set('creel', nextCreel)
  await update($, creel, () => nextCreel)

  const day = await loadToday($, now)
  const goal = goalOf(dayNumber(now))
  const catches = [...day.catches, fish].slice(-200)
  const progress = Math.min(goal.target, progressOf(goal, catches))
  const doneNow = !day.done && progress >= goal.target
  const nextDay = { key: day.key, catches, done: day.done || doneNow }
  await $.store.set('today', nextDay)
  await update($, today, () => nextDay)

  $.ui.toast(`${revealText(fish)} · ${goal.text}: ${progress}/${goal.target}`)
  if (doneNow) $.ui.toast(`Daily goal done: ${goal.text}`, { timeoutMs: 6000 })
  await update($, landed, () => ({ text: revealText(fish), until: now + SHOW_MS }))
  animate($)
}

async function castLine($: EngineInterface, line: CreelLine): Promise<void> {
  await update($, lines, out => [...out.filter(l => l.id !== line.id), line])
  animate($)
}

async function legend($: EngineInterface): Promise<void> {
  await land($, landLegend(seeded(hashOf(String(await $.clock.now())))))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'creel', description: 'Shows the creel: today\'s goal, the catch by kind, and the legends.', immediate: true })
    const kept = (await $.store.get('creel')) as Creel | undefined
    if (kept !== undefined) await update($, creel, () => kept)
    await loadToday($, await $.clock.now())
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.run_in_background === true) return next(e)
    const started = await $.clock.now()
    const line: CreelLine = { id: e.tool_use_id, command: shortCommand(e.command, 40), since: started }
    const bite = $.clock.after(BITE_MS, () => { void castLine($, line) })
    const ran = await next(e).finally(() => bite.cancel())
    const ms = (await $.clock.now()) - started
    await update($, lines, out => out.filter(l => l.id !== line.id))
    if (mergedByBash(ran)) await legend($)
    if (ms < BITE_MS) return ran
    const outcome = kindOf(e.command) === null ? (ran.deny !== undefined ? 'skip' : ran.isError === true ? 'red' : 'green') : outcomeOf(e, ran)
    if (outcome === 'skip') return ran
    const random = seeded(hashOf(line.id) ^ started)
    await land($, outcome === 'green' ? landGreen(ms, random) : landRed(random))
    return ran
  })

  on('tool.call', { tool: /^mcp__.*github.*__merge_pull_request$/i }, async ($, e, next) => {
    const ran = await next(e)
    if (mergedByTool(e.tool, ran)) await legend($)
    return ran
  })

  on('session.receive', async ($, e, next) => {
    if (githubNews(e.event) === 'merged') await legend($)
    return next(e)
  })

  on('command.run', { command: 'creel' }, async $ => {
    await loadToday($, await $.clock.now())
    await $.ui.open({ id: PANE, title: 'Creel', focus: true, closeOnEscape: true })
    const kept = await read($, creel)
    return { text: `The creel: ${kept.total} fish, ${kept.junk} junk.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const out = await read($, lines)
    const shown = await read($, landed)
    const n = await read($, frame)
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    let mine
    if (out.length > 0) {
      const first = out[0]!
      const width = Math.max(4, Math.min(12, Math.floor((e.props.bodyColumns - 50) / 4)))
      const wave = (shift: number) => Array.from({ length: width }, (_, i) => ((i + n + shift) % 3 === 0 ? '~' : ' ')).join('')
      const more = out.length > 1 ? ` (+${out.length - 1})` : ''
      mine = (
        <Box flexDirection="row">
          <Text color={WATER}>{wave(0)}</Text>
          <Text color={BOBBER} bold>{n % 2 === 0 ? ' ◓ ' : ' ◒ '}</Text>
          <Text color={WATER}>{wave(1)}</Text>
          <Text dimColor wrap="truncate-end">{` Line out · ${first.command}${more} · ${Math.round((now - first.since) / 1000)}s`}</Text>
        </Box>
      )
    } else if (shown !== null && shown.until > now) {
      mine = (
        <Box flexDirection="row">
          <Text color={FISH} bold>{'><(((°> '}</Text>
          <Text wrap="truncate-end">{shown.text}</Text>
        </Box>
      )
    } else return below
    return (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const kept = await read($, creel)
    const day = await read($, today)
    const goal = goalOf(dayNumber(await $.clock.now()))
    const progress = Math.min(goal.target, progressOf(goal, day.catches))
    const kinds = Object.entries(kept.kinds).sort((a, b) => b[1].count - a[1].count || b[1].best - a[1].best)
    const nameWidth = Math.max(12, ...kinds.map(([, k]) => k.name.length))
    return (
      <Box flexDirection="column">
        <Text bold color={FISH}>{`Today: ${goal.text} · ${progress}/${goal.target}${day.done ? ' · done' : ''}`}</Text>
        <Text>{`Catch: ${kept.total} fish · ${kept.junk} junk · ${day.catches.length} today`}</Text>
        {kept.legends.length > 0 && <Text color="#ffc830">{`Legends: ${kept.legends.map(id => kept.kinds[id]?.name ?? id).join(', ')}`}</Text>}
        {kinds.length === 0 && <Text dimColor>Nothing yet. A command that runs 3 seconds or more casts a line.</Text>}
        {kinds.map(([id, k]) => (
          <Text key={id}>{`${k.name.padEnd(nameWidth)}  ${String(k.count).padStart(3)}   best ${k.best} kg`}</Text>
        ))}
        <Box marginTop={1}>
          <Button key="close" label="Close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
