// Loon chicks: each subagent hatches as a chick behind the loon in the band above the prompt. It swims
// while it runs; when its turn ends it reaches the nest (it answered) or the eel takes it (it failed,
// was stopped or refused). /chicks lists every chick of the session.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { ageText, bandClutch, clutchToast, eelToast, hatch, relabel, settle, whyOf } from './brood.ts'
import type { Chick } from '../types'

const chicks = atom({ plugin: 'loon-chicks', key: 'chicks' } as const, [] as Chick[])
const inAt = atom({ plugin: 'loon-chicks', key: 'inAt' } as const, 0)
const frame = atom({ plugin: 'loon-chicks', key: 'frame' } as const, 0)

const PANE = 'chicks'
const WATER = '#5fb8d0', LOON = '#e8f0ea', CHICK = '#ffd84a', NEST = '#c98a10', EEL = '#e04a4a'

// the band's swim clock; starts over on a reload
let ticker: Timer | null = null

async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const shown = bandClutch(await read($, chicks), await read($, inAt), now)
  const swims = shown?.some(c => c.state === 'swimming') ?? false
  if (!swims) {
    ticker?.cancel()
    ticker = null
  }
  await update($, frame, n => n + 1)
}

async function addChick($: EngineInterface, id: string, label: string, seen: 'spawn' | 'classic'): Promise<void> {
  const now = await $.clock.now()
  await update($, chicks, all => hatch(all, id, label, now, seen))
  await update($, inAt, () => 0)
  if (ticker === null) ticker = $.clock.every(500, () => { void tick($) })
}

async function comeIn($: EngineInterface, id: string, state: 'home' | 'eel', why?: string): Promise<void> {
  const now = await $.clock.now()
  const said: { result: ReturnType<typeof settle> | null } = { result: null }
  await update($, chicks, all => {
    said.result = settle(all, id, state, now, why)
    return said.result.chicks
  })
  const result = said.result
  if (result === null || result.chick === null) return
  if (result.chick.state === 'eel') $.ui.toast(eelToast(result.chick))
  if (result.clutchIn !== null) {
    $.ui.toast(clutchToast(result.clutchIn))
    await update($, inAt, () => now)
    // one last tick after the band's time is up draws it away
    $.clock.after(9000, () => { void tick($) })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'chicks', description: 'Lists this session\'s subagents as Loon Echo chicks.', immediate: true })
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny === undefined && started.agentId !== undefined) await addChick($, started.agentId, e.description || e.subagentType, 'spawn')
    return started
  })

  // agents that start with no agent.spawn the engine still reports as subagents
  on('classic.SubagentStart', async ($, e, next) => {
    if (!(await read($, chicks)).some(c => c.id === e.agent_id)) await addChick($, e.agent_id, e.agent_type, 'classic')
    return next(e)
  })

  // a spawned chick comes in with its turn's end, which says whether the eel took it; this event
  // brings home only the chicks it alone reported
  on('classic.SubagentStop', async ($, e, next) => {
    const chick = (await read($, chicks)).find(c => c.id === e.agent_id)
    if (chick?.seen === 'classic') await comeIn($, e.agent_id, 'home')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      if (e.reason === 'answer') await comeIn($, e.agentId, 'home')
      else await comeIn($, e.agentId, 'eel', whyOf(e.reason))
    }
    return next(e)
  })

  // the Agent call's description names a chick that started as its agent type
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const ran = await next(e)
    const record = (ran.result ?? {}) as { agentId?: string }
    if (ran.deny === undefined && typeof record.agentId === 'string') await update($, chicks, all => relabel(all, record.agentId!, e.description))
    return ran
  })

  on('command.run', { command: 'chicks' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Chicks', focus: true, closeOnEscape: true })
    const all = await read($, chicks)
    const swim = all.filter(c => c.state === 'swimming').length
    return { text: `${all.length} chick${all.length === 1 ? '' : 's'} this session, ${swim} swimming.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const now = await $.clock.now()
    const clutch = bandClutch(await read($, chicks), await read($, inAt), now)
    const n = await read($, frame)
    if (clutch === null) return below
    const { Box, Text } = $.ui.resolve(e)
    const swimming = clutch.filter(c => c.state === 'swimming')
    const home = clutch.filter(c => c.state === 'home').length
    const eel = clutch.filter(c => c.state === 'eel').length
    const brood = swimming.map((_, i) => ((i + n) % 2 === 0 ? '•' : '∙')).join(' ')
    const names = swimming.slice(0, 3).map(c => c.label).join(' · ') + (swimming.length > 3 ? ` (+${swimming.length - 3})` : '')
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color={NEST} bold>{`⌂ ${home} `}</Text>
          <Text color={WATER}>{n % 2 === 0 ? ' ~ ' : '~  '}</Text>
          <Text color={LOON} bold>{'<(°)'}</Text>
          <Text color={WATER}>{'~ '}</Text>
          <Text color={CHICK} bold>{brood}</Text>
          <Text color={WATER}>{n % 2 === 0 ? '  ~ ~ ~ ' : '   ~ ~ ~'}</Text>
          {eel > 0 && <Text color={EEL}>{` ✗ ${eel}`}</Text>}
          <Text dimColor>{swimming.length > 0 ? `  clutch ${clutch[0]?.clutch ?? 1}` : '  all in'}</Text>
        </Box>
        {names !== '' && <Text dimColor wrap="truncate-end">{`Swimming: ${names}`}</Text>}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const all = [...(await read($, chicks))].sort((a, b) => b.clutch - a.clutch || a.since - b.since)
    const mark = (c: Chick) => (c.state === 'swimming' ? '•' : c.state === 'home' ? '⌂' : '✗')
    const color = (c: Chick) => (c.state === 'swimming' ? CHICK : c.state === 'home' ? NEST : EEL)
    return (
      <Box flexDirection="column">
        {all.length === 0 && <Text dimColor>No chicks yet. Each subagent hatches as one.</Text>}
        {all.map(c => (
          <Box key={c.id} flexDirection="row">
            <Text color={color(c)} bold>{`${mark(c)} `}</Text>
            <Text wrap="truncate-end">{`${c.label}`}</Text>
            <Text dimColor>{`  clutch ${c.clutch} · ${c.state === 'eel' ? `eel (${c.why ?? 'lost'})` : c.state} · ${ageText(c, now)}`}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Button key="close" label="Close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
