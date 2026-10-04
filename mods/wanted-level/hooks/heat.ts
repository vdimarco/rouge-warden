// The heat: which calls are risky moves, how many stars each earns, and how the stars fade, as the
// wanted level in Crimson Rogue does. Pure: register.ts keeps the level and blocks at five stars.
import { bare } from './shared/checks.ts'
import type { WantedLevel, WantedMove } from '../types'

export type Level = WantedLevel
export type Move = Pick<WantedMove, 'what' | 'stars'>

export const MAX_STARS = 5
export const CALM: Level = { stars: 0, lastAt: 0, moves: [] }

// risky shell moves: the pattern, the stars, and what the toast calls it
const SHELL: readonly [RegExp, number, string][] = [
  [/\bgit\s+push\b[^;&|\n]*?(?:\s--force(?!-with-lease)\b|\s-f\b|\s\+[\w./-]+)/, 2, 'git push --force'],
  [/\bgit\s+push\b[^;&|\n]*?\s--force-with-lease\b/, 1, 'git push --force-with-lease'],
  [/\brm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*[rR][a-zA-Z]*|--recursive\s+--force|--force\s+--recursive|-[rR]\s+-f|-f\s+-[rR])(?:\s|$)/, 1, 'rm -rf'],
  [/\bgit\s+reset\s+(?:[^;&|\n]*\s)?--hard\b/, 1, 'git reset --hard'],
  [/\bgit\s+clean\s+(?:[^;&|\n]*\s)?-[a-zA-Z]*f/, 1, 'git clean -f'],
  [/\bgit\s+branch\s+(?:[^;&|\n]*\s)?(?:-D\b|--delete\s+--force\b)/, 1, 'git branch -D'],
  [/(?:^|[\s'"=/:])\.env(?:\.(?!example\b)[\w-]+)?(?=$|[\s'";|&)])/, 2, 'a touch of a .env file'],
  [/\b(?:curl|wget|http|fetch)\b[^\n]*\/api\/warden\b/, 1, 'a call to /api/warden'],
]

// risky connector calls: deleting or pausing a project or a branch
const CONNECTORS: readonly [RegExp, number, string][] = [
  [/^mcp__.*vercel.*__(?:delete_project|pause_project)$/i, 3, 'a Vercel project delete or pause'],
  [/^mcp__.*supabase.*__(?:delete_branch|reset_branch|pause_project)$/i, 3, 'a Supabase branch delete, reset or pause'],
]

const isSecret = (file: string): boolean => /(?:^|\/)\.env(?:\.(?!example$)[\w.-]+)?$/.test(file)
const base = (file: string) => file.replace(/\\/g, '/')

/** The risky moves in one tool call, each with its stars. */
export function movesOf(e: { tool: string } & Record<string, unknown>): Move[] {
  const moves: Move[] = []
  if (e.tool === 'Bash' && typeof e.command === 'string') {
    const run = bare(e.command)
    for (const [re, stars, what] of SHELL) if (re.test(run)) moves.push({ what, stars })
    return moves
  }
  const file = typeof e.file_path === 'string' ? base(e.file_path) : typeof e.notebook_path === 'string' ? base(e.notebook_path) : null
  if (file !== null) {
    const writes = e.tool !== 'Read'
    if (isSecret(file)) moves.push({ what: `${writes ? 'an edit' : 'a read'} of ${file.split('/').slice(-2).join('/')}`, stars: 2 })
    if (writes && /(?:^|\/)api\/warden\.js$/.test(file)) moves.push({ what: 'an edit of api/warden.js, which spends AI Gateway credits', stars: 1 })
    if (writes && /(?:^|\/)vercel\.json$/.test(file)) moves.push({ what: 'an edit of vercel.json', stars: 1 })
    return moves
  }
  for (const [re, stars, what] of CONNECTORS) if (re.test(e.tool)) moves.push({ what, stars })
  return moves
}

/** The level after the stars that faded by `now`: one star for each `fadeMs` with no risky move. */
export function faded(level: Level, now: number, fadeMs: number): Level {
  if (level.stars === 0) return level
  const drops = Math.floor((now - level.lastAt) / fadeMs)
  if (drops <= 0) return level
  const stars = Math.max(0, level.stars - drops)
  return { ...level, stars, lastAt: stars === 0 ? level.lastAt : level.lastAt + drops * fadeMs }
}

/** The level after these moves. */
export function raise(level: Level, moves: readonly Move[], now: number): Level {
  const add = moves.reduce((n, m) => n + m.stars, 0)
  return {
    stars: Math.min(MAX_STARS, level.stars + add),
    lastAt: now,
    moves: [...level.moves, ...moves.map(m => ({ ...m, at: now }))].slice(-50),
  }
}

export const starsText = (stars: number): string => '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars)

export const statusText = (stars: number): string | undefined => (stars > 0 ? `${starsText(stars)} WANTED` : undefined)

export const raiseToast = (stars: number, moves: readonly Move[]): string =>
  `${starsText(stars)} WANTED · +${moves.reduce((n, m) => n + m.stars, 0)} for ${moves.map(m => m.what).join(', ')}`

export function blockText(moves: readonly Move[], fadeMinutes: number): string {
  return [
    `WANTED (wanted-level): five stars. This risky call was blocked: ${moves.map(m => m.what).join(', ')}.`,
    `One star fades every ${fadeMinutes} minutes with no risky move, or the person can run /lay-low.`,
    'Do not look for another way to do it. Wait, or ask the person.',
  ].join(' ')
}
