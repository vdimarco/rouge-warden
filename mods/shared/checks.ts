// What a Bash command is (a check run, a build, or neither), whether it went green, and whether a
// pull request was merged. The announcer, the cabinet spinner, the creel and the tilt sensor share it,
// so they agree on what green means. mods/sync.mjs copies it into each mod's hooks/shared/.

export type RunKind = 'check' | 'build'
export type Outcome = 'green' | 'red' | 'skip'

// What a tool call resolved to, read loosely: a deny, an error, or the tool's record.
export type Ran = {
  deny?: string
  isError?: true
  result?: unknown
  text?: string
}

const CHECKS = [
  // node --test, a QA or test script, a check script, or a file named like a test, a simulation or an
  // end-to-end run
  /\bnode\s+(?:--[\w-]+(?:=\S+)?\s+)*(?:--test\b|[^\s;&|]*\b(?:qa|tests?)\/[^\s;&|]+|[^\s;&|]*\bcheck\.[cm]?js\b|[^\s;&|]+\.(?:test|spec|sim|e2e)\.[cm]?[jt]s\b)/,
  /\bnpm\s+(?:--prefix\s+\S+\s+)?(?:test|t)\b/,
  /\bnpm\s+(?:--prefix\s+\S+\s+)?run\s+(?:test|check|qa|typecheck|lint)[\w:.-]*/,
  /\bnpx\s+(?:tsc|playwright\s+test|vitest|jest|eslint)\b/,
  /(?:^|[\s;&|(])(?:vitest|jest|pytest|tsc)(?:\s|$)/,
  /\b(?:bun|deno|cargo|go)\s+test\b/,
  /\bclaude\s+plugin\s+(?:test|validate)\b/,
  /\bpython3?\s+[^\s;&|]*\bqa\//,
  /\bopenspec\s+validate\b/,
]
const BUILDS = [
  /\bnpm\s+(?:--prefix\s+\S+\s+)?run\s+build[\w:.-]*/,
  /\bvite\s+build\b/,
  /\bnode\s+[^\s;&|]*\bbuild\.m?js\b/,
  /\besbuild\b/,
]

/**
 * The command with the words it only carries as text taken out: here-document bodies and the
 * message of `-m` or `--message`. A commit message that says "rm -rf" or "npm test" runs neither.
 */
export function bare(command: string): string {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, '')
    .replace(/(?:^|\s)(?:-m|--message)(?:=|\s+)(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g, ' ')
}

/** What a Bash command is: a check run, a build, or null for anything else. */
export function kindOf(command: string): RunKind | null {
  const run = bare(command)
  if (CHECKS.some(re => re.test(run))) return 'check'
  if (BUILDS.some(re => re.test(run))) return 'build'
  return null
}

// A failure line in the output: the repo's QA scripts print "  FAIL ..." and exit 1, tap prints
// "not ok", Bun prints "(fail)" and " 1 fail", most runners print "2 failed" or "3 failing".
const FAILURES = [
  /^\s*(?:FAIL|FAILED|not ok)\b/m,
  /^\s*[✗✘×]\s/m,
  /^\(fail\)/m,
  /\b[1-9]\d* (?:failed|failing|failures?)\b/i,
  /^\s*[1-9]\d* fail\b/m,
  /\bfailures?:\s*[1-9]/i,
  /^npm (?:ERR!|error)/m,
]
const STOPPED = /\b(?:interrupted|aborted|cancel(?:l)?ed)\b/i

/** Whether a foreground Bash run went green, went red, or does not count. */
export function outcomeOf(input: { run_in_background?: boolean }, ran: Ran): Outcome {
  if (input.run_in_background === true || ran.deny !== undefined) return 'skip'
  if (ran.isError === true) return STOPPED.test(ran.text ?? '') ? 'skip' : 'red'
  const record = (ran.result ?? {}) as { stdout?: string; stderr?: string; interrupted?: boolean; backgroundTaskId?: string }
  if (record.interrupted === true || record.backgroundTaskId !== undefined) return 'skip'
  const output = `${record.stdout ?? ''}\n${record.stderr ?? ''}\n${ran.text ?? ''}`
  return FAILURES.some(re => re.test(output)) ? 'red' : 'green'
}

/** The command as one short line, for a toast: the first segment, cut to `max` characters. */
export function shortCommand(command: string, max = 48): string {
  const first = command.trim().split('\n')[0] ?? ''
  return first.length > max ? `${first.slice(0, max - 1)}…` : first
}

/** A merge seen in a Bash result: `gh pr merge` and the like. */
export function mergedByBash(ran: Ran): boolean {
  const record = (ran.result ?? {}) as { gitOperation?: { pr?: { action?: string } } }
  return ran.deny === undefined && ran.isError !== true && record.gitOperation?.pr?.action === 'merged'
}

/** A merge made through a GitHub connector's merge tool. */
export function mergedByTool(tool: string, ran: Ran): boolean {
  return /^mcp__.*github.*__merge_pull_request$/i.test(tool) && ran.deny === undefined && ran.isError !== true
}

/** What a GitHub event delivered to the session says: a merge, a failed check, a passed check. */
export function githubNews(event: { source: string; kind: string; data: Record<string, unknown> } | undefined): 'merged' | 'failed' | 'passed' | null {
  if (event === undefined || event.source !== 'github') return null
  const { kind, data } = event
  if (/pull_request/.test(kind) && (data.outcome === 'merged' || data.merged === true || data.action === 'merged')) return 'merged'
  if (/check|status|workflow/.test(kind)) {
    const said = String(data.conclusion ?? data.outcome ?? data.state ?? data.status ?? '')
    if (/fail|error|timed_out|cancel/i.test(said)) return 'failed'
    if (/success|pass/i.test(said)) return 'passed'
  }
  return null
}
