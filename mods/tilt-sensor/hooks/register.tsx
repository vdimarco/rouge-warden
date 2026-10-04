// The tilt sensor: the house rules as a pinball tilt. An edit that breaks a rule shows DANGER at once
// and keeps the rule in the status line until its build runs green or the page is fixed. A git commit
// while a rule is broken, in this session's edits or in the working tree, is blocked with TILT and the
// fix. /tilt-sensor lists the open rules and lets the person reset them.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { outcomeOf } from './shared/checks.ts'
import {
  SCREEN_MAX_BYTES, SCREEN_WIDTH, changedPath, coveredPage, dangerText, followSuitBundle, followSuitRule, followSuitSource,
  importsOf, isArcadeScreen, isCommit, isFollowSuitBuild, isOlympusBuild, olympusBundle, olympusRule, olympusSource,
  pageOfScript, quietBroken, quietRule, screenRule, scriptsOfPage, statusText, tiltText, webpSize,
} from './rules.ts'
import type { Rule } from './rules.ts'

// rules an edit broke, kept until a build or a fix closes them
const open = atom({ plugin: 'tilt-sensor', key: 'open' } as const, [] as Rule[])
// rules the working tree broke at the last check, found again at every check
const tree = atom({ plugin: 'tilt-sensor', key: 'tree' } as const, [] as Rule[])
const forgiven = atom({ plugin: 'tilt-sensor', key: 'forgiven' } as const, [] as string[])
const built = atom({ plugin: 'tilt-sensor', key: 'built' } as const, { olympus: false, followSuit: false })

const PANE = 'tilt-sensor'
// how many scripts one page check follows at most
const MAX_SCRIPTS = 60

function relOf(root: string, file: string): string {
  const clean = file.replace(/\\/g, '/')
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  if (clean.startsWith(`${base}/`)) return clean.slice(base.length + 1)
  return clean.replace(/^\.\//, '')
}

async function readText($: EngineInterface, file: string): Promise<string | null> {
  try {
    const text = await $.fs.read(file)
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

/** Every broken rule now: the edits' and the tree's, each once, less the ones the person reset. */
async function brokenNow($: EngineInterface): Promise<Rule[]> {
  const pardoned = new Set(await read($, forgiven))
  const all = new Map<string, Rule>()
  for (const rule of [...(await read($, open)), ...(await read($, tree))]) if (!pardoned.has(rule.key)) all.set(rule.key, rule)
  return [...all.values()]
}

async function openRule($: EngineInterface, rule: Rule): Promise<void> {
  await update($, forgiven, keys => keys.filter(k => k !== rule.key))
  const before = await read($, open)
  if (before.some(r => r.key === rule.key)) return
  await update($, open, rules => [...rules.filter(r => r.key !== rule.key), rule])
  $.ui.toast(dangerText(rule), { timeoutMs: 8000 })
  $.ui.status(statusText(await brokenNow($)))
}

async function closeRule($: EngineInterface, key: string): Promise<void> {
  const before = await read($, open)
  if (!before.some(r => r.key === key)) return
  await update($, open, rules => rules.filter(r => r.key !== key))
  await update($, tree, rules => rules.filter(r => r.key !== key))
  $.ui.status(statusText(await brokenNow($)))
}

/** Whether a page breaks the quiet.js rule, its scripts and their imports read too. */
async function pageBroken($: EngineInterface, root: string, page: string): Promise<boolean> {
  const html = await readText($, `${root}/${page}`)
  if (html === null) return false
  const todo = scriptsOfPage(html, page), seen = new Set<string>(), texts: string[] = []
  while (todo.length > 0 && seen.size < MAX_SCRIPTS) {
    const file = todo.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const js = await readText($, `${root}/${file}`)
    if (js === null) continue
    texts.push(js)
    todo.push(...importsOf(js, file))
  }
  return quietBroken(html, texts)
}

async function checkPage($: EngineInterface, root: string, page: string): Promise<void> {
  if (await pageBroken($, root, page)) await openRule($, quietRule(page))
  else await closeRule($, `quiet:${page}`)
}

async function screenProblem($: EngineInterface, root: string, file: string): Promise<Rule | null> {
  try {
    const stat = await $.fs.stat(`${root}/${file}`)
    const read = await $.fs.read(`${root}/${file}`, { as: 'bytes' })
    const text = atob(typeof read === 'string' ? '' : read.base64)
    const size = webpSize(Uint8Array.from(text.slice(0, 64), c => c.charCodeAt(0)))
    if (size !== null && size.w === SCREEN_WIDTH && stat.size < SCREEN_MAX_BYTES) return null
    return screenRule(file, size?.w ?? null, stat.size)
  } catch {
    return null
  }
}

/** The rules the working tree breaks: changed pages and screens, and sources whose build is missing. */
async function treeProblems($: EngineInterface, root: string): Promise<Rule[]> {
  let status = ''
  try {
    const ran = await $.process.run(['git', 'status', '--porcelain', '-uall'], { cwd: root })
    if (ran.exitCode !== 0) return []
    status = ran.stdout
  } catch {
    return []
  }
  const changed = status.split('\n').map(changedPath).filter((p): p is string => p !== null)
  const rules: Rule[] = []
  for (const rel of changed) {
    if (coveredPage(rel) && (await pageBroken($, root, rel))) rules.push(quietRule(rel))
    if (isArcadeScreen(rel)) {
      const problem = await screenProblem($, root, rel)
      if (problem !== null) rules.push(problem)
    }
  }
  const builds = await read($, built)
  if (!builds.olympus && changed.some(olympusSource) && !changed.some(olympusBundle)) rules.push(olympusRule())
  if (!builds.followSuit && changed.some(followSuitSource) && !changed.some(followSuitBundle)) rules.push(followSuitRule())
  return rules
}

/** Every rule a commit would break now: the edits' rules, a page checked again, and the working tree's. */
async function commitProblems($: EngineInterface): Promise<Rule[]> {
  const root = await $.session.root()
  for (const rule of await read($, open)) {
    const page = rule.key.startsWith('quiet:') ? rule.key.slice(6) : null
    if (page !== null && !(await pageBroken($, root, page))) await update($, open, rules => rules.filter(r => r.key !== rule.key))
  }
  const found = await treeProblems($, root)
  await update($, tree, () => found)
  const rules = await brokenNow($)
  $.ui.status(statusText(rules))
  return rules
}

async function reset($: EngineInterface): Promise<void> {
  const root = await $.session.root()
  const keys = [...(await read($, open)), ...(await treeProblems($, root))].map(r => r.key)
  await update($, forgiven, held => [...new Set([...held, ...keys])])
  await update($, open, () => [])
  await update($, tree, () => [])
  $.ui.status(undefined)
  $.ui.toast('The tilt sensor is reset. The table is level.')
}

async function recheck($: EngineInterface): Promise<void> {
  const rules = await commitProblems($)
  $.ui.toast(rules.length === 0 ? 'All clear. The table is level.' : `DANGER ×${rules.length}: see /tilt-sensor.`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tilt-sensor', description: 'Shows the house rules this work breaks, and resets the sensor.', immediate: true })
    return next(e)
  })

  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const root = await $.session.root()
    const rel = relOf(root, 'file_path' in e ? String(e.file_path) : 'notebook_path' in e ? String(e.notebook_path) : '')
    if (olympusSource(rel)) await openRule($, olympusRule())
    if (followSuitSource(rel)) await openRule($, followSuitRule())
    if (coveredPage(rel)) await checkPage($, root, rel)
    const page = pageOfScript(rel)
    if (page !== null && coveredPage(page)) await checkPage($, root, page)
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (isCommit(e.command)) {
      const rules = await commitProblems($)
      if (rules.length > 0) {
        $.ui.toast(`TILT · ${rules.length} house rule${rules.length === 1 ? ' is' : 's are'} broken. The commit did not run.`, { timeoutMs: 8000 })
        return { deny: tiltText(rules) }
      }
      return next(e)
    }
    const ran = await next(e)
    if (outcomeOf(e, ran) !== 'green') return ran
    if (isOlympusBuild(e.command)) {
      await update($, built, b => ({ ...b, olympus: true }))
      await closeRule($, 'olympus')
    }
    if (isFollowSuitBuild(e.command)) {
      await update($, built, b => ({ ...b, followSuit: true }))
      await closeRule($, 'follow-suit')
    }
    return ran
  })

  on('command.run', { command: 'tilt-sensor' }, async $ => {
    const rules = await commitProblems($)
    await $.ui.open({ id: PANE, title: 'Tilt sensor', focus: true, closeOnEscape: true })
    return { text: rules.length === 0 ? 'The table is level: no house rule is broken.' : `DANGER ×${rules.length}: ${rules.map(r => r.title).join('; ')}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const rules = await brokenNow($)
    return (
      <Box flexDirection="column">
        {rules.length === 0 && <Text color="#7fd18b">All clear. The table is level.</Text>}
        {rules.map(rule => (
          <Box key={rule.key} flexDirection="column" marginBottom={1}>
            <Text color="#ff6b4a" bold>{`DANGER · ${rule.title}`}</Text>
            <Text>{rule.fix}</Text>
          </Box>
        ))}
        <Box flexDirection="row" gap={2}>
          <Button key="recheck" label="Recheck" hotkey="c" onPress={() => void recheck($)} />
          <Button key="reset" label="Reset" hotkey="r" variant="primary" onPress={() => void reset($)} />
          <Button key="close" label="Close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
