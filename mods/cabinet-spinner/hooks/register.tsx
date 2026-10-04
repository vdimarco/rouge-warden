// The cabinet spinner: the game whose folder the session last edited is the cabinet in play. In the
// terminal the spinner says that cabinet's verbs and the turn ends with its phrase; the desktop and
// mobile apps keep their own step words. The status line names the cabinet and the arcade tokens.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, RenderNode } from 'claude-code'

import { kindOf, outcomeOf } from './shared/checks.ts'
import { hashOf } from './shared/rng.ts'
import { MAX_TOKENS, START_TOKENS, byId, cabinetOf, durationText, statusOf } from './cabinets.ts'

// the cabinet in play, by id; '' before the session edits a game
const current = atom({ plugin: 'cabinet-spinner', key: 'cabinet' } as const, '')

// a person's prompt spends a token; a notification, a peer or a plugin does not
const PERSON = new Set(['composer', 'bridge', 'sdk'])

async function tokensNow($: EngineInterface): Promise<number> {
  const kept = await $.store.get('tokens')
  return typeof kept === 'number' ? kept : START_TOKENS
}

async function setTokens($: EngineInterface, tokens: number): Promise<number> {
  const kept = Math.max(0, Math.min(MAX_TOKENS, tokens))
  await $.store.set('tokens', kept)
  $.ui.status(statusOf(byId(await read($, current)), kept))
  return kept
}

/** The tree with `from` swapped for `to` in its text, or null when no text held `from`. */
function swapText(node: RenderNode, from: string, to: string): RenderNode | null {
  if (typeof node === 'string') return node.includes(from) ? node.replace(from, to) : null
  const children = ('children' in node ? (node.children ?? []) : []) as RenderNode[]
  let changed = false
  const next = children.map(child => {
    const swapped = swapText(child, from, to)
    if (swapped === null) return child
    changed = true
    return swapped
  })
  return changed ? ({ ...node, children: next } as RenderElement) : null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'change', description: 'The change machine: three more arcade tokens.', immediate: true })
    await setTokens($, await tokensNow($))
    return next(e)
  })

  on('command.run', { command: 'change' }, async $ => {
    const before = await tokensNow($)
    const after = await setTokens($, before + 3)
    if (after === before) return { text: `Your pockets are full: ${after} tokens.` }
    return { text: `The change machine gives you ${after - before} token${after - before === 1 ? '' : 's'}. You have ${after}.` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (PERSON.has(e.origin.kind)) await setTokens($, (await tokensNow($)) - 1)
    return next(e)
  })

  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const file = 'file_path' in e ? String(e.file_path) : 'notebook_path' in e ? String(e.notebook_path) : ''
    const cabinet = cabinetOf(file)
    if (cabinet !== null && cabinet.id !== (await read($, current))) {
      await update($, current, () => cabinet.id)
      $.ui.status(statusOf(cabinet, await tokensNow($)))
    }
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (kindOf(e.command) === 'check' && outcomeOf(e, ran) === 'green') await setTokens($, (await tokensNow($)) + 1)
    return ran
  })

  on('ui.render', { component: 'Spinner', surface: 'terminal' }, async ($, e, next) => {
    const cabinet = byId(await read($, current))
    const verb = cabinet.verbs[hashOf(e.props.word) % cabinet.verbs.length] ?? e.props.word
    return next({ ...e, props: { ...e.props, word: verb } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const drawn = await next(e)
    const cabinet = byId(await read($, current))
    const swapped = swapText(drawn, `${e.props.word} for `, `${cabinet.end} `)
    if (swapped !== null && typeof swapped !== 'string') return swapped
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{`✻ ${cabinet.end} ${durationText(e.props.durationMs)}`}</Text>
  })
}
