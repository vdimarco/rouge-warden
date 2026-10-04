// The house rules the tilt sensor knows, from AGENTS.md and the README. Pure: what breaks a rule, what
// fixes it, and how to say so. register.ts watches the edits, the builds and the commits.
import { bare } from './shared/checks.ts'
import type { TiltRule } from '../types'

export type Rule = TiltRule

const OLYMPUS = 'games/olympus/'
const FOLLOW_SUIT = 'follow-suit/'

/** A file whose change needs the Olympus bundle built again (games/olympus, not its tests or notes). */
export const olympusSource = (rel: string): boolean =>
  rel.startsWith(OLYMPUS) && !/^games\/olympus\/(?:tests\/|node_modules\/|README\.md$|package(?:-lock)?\.json$)/.test(rel)

/** A file whose change needs the arcade copy of Follow Suit built again. */
export const followSuitSource = (rel: string): boolean =>
  /^follow-suit\/(?:src\/|index\.html$|vite\.config\.ts$|public\/)/.test(rel) && !/\.test\.tsx?$/.test(rel)

/** The built copies those builds write. */
export const olympusBundle = (rel: string): boolean => rel.startsWith('public/olympus/')
export const followSuitBundle = (rel: string): boolean => rel.startsWith('public/follow-suit/')

export const isOlympusBuild = (command: string): boolean =>
  /olympus/.test(bare(command)) && /\bnpm\s+(?:--prefix\s+\S+\s+)?run\s+build\b|\bbuild\.mjs\b/.test(bare(command))

export const isFollowSuitBuild = (command: string): boolean =>
  /\bbuild:arcade\b|\bqa:arcade\b|\bvite\s+build\s+--mode\s+arcade\b/.test(bare(command))

export const isCommit = (command: string): boolean => /\bgit\s+(?:-[cC]\s+\S+\s+)*commit\b(?![^;&|]*--dry-run)/.test(bare(command))

/** A page the quiet.js rule covers: an HTML page under public/, In Full Swing aside. */
export const coveredPage = (rel: string): boolean =>
  /^public\/.+\.html$/.test(rel) && rel !== 'public/vr/index.html' && !/\/(?:lib|node_modules)\//.test(rel)

/** The page of the game folder a script sits in: public/<game>/index.html, or null. */
export function pageOfScript(rel: string): string | null {
  const m = /^public\/([^/]+)\/.+\.m?js$/.exec(rel)
  if (m === null || m[1] === 'arcade' || /\/lib\//.test(rel)) return null
  return `public/${m[1]}/index.html`
}

/** An arcade screen picture: a WebP straight in public/arcade/. */
export const isArcadeScreen = (rel: string): boolean => /^public\/arcade\/[^/]+\.webp$/.test(rel)

// what qa/arcade/quiet.mjs takes as making sound
export const AUDIO = /\b(?:webkit)?AudioContext\b|new\s+Audio\s*\(|<audio\b|createElement\(\s*["']audio["']\s*\)|<video\b(?![^>]*\bmuted)|speechSynthesis|w\.soundcloud\.com/

/** The local scripts a page loads, as paths from the root (public/...), resolved against the page. */
export function scriptsOfPage(html: string, page: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    const file = resolveFrom(m[1] ?? '', page, true)
    if (file !== null) out.push(file)
  }
  return out
}

/** The local modules a script imports, as paths from the root. */
export function importsOf(js: string, from: string): string[] {
  const out: string[] = []
  const re = /(?:\bimport\s*(?:[^'"()]*?\sfrom\s*)?|\bexport\s[^'"()]*?\sfrom\s*|\bimport\s*\(\s*)["']([^"'`$]+)["']/g
  for (const m of js.matchAll(re)) {
    const file = resolveFrom(m[1] ?? '', from, false)
    if (file !== null) out.push(file)
  }
  return out
}

function resolveFrom(spec: string, from: string, page: boolean): string | null {
  if (/^(?:https?:)?\/\//.test(spec) || (!page && !/^[./]/.test(spec))) return null
  const clean = spec.split(/[?#]/)[0] ?? ''
  const parts = clean.startsWith('/') ? ['public', ...clean.slice(1).split('/')] : [...from.split('/').slice(0, -1), ...clean.split('/')]
  const stack: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  const file = stack.join('/')
  return file.includes('/lib/') || !/\.m?js$/.test(file) ? null : file
}

/** Whether a page with these texts (its HTML first) breaks the quiet.js rule. */
export function quietBroken(html: string, texts: readonly string[]): boolean {
  if (![html, ...texts].some(t => AUDIO.test(t))) return false
  const first = /<script\b[^>]*>/.exec(html), head = html.indexOf('</head>')
  const quietFirst = first !== null && /\bsrc="\/arcade\/quiet\.js"/.test(first[0]) && (head < 0 || first.index < head)
  return !quietFirst
}

/** The width and height a WebP file states in its header, or null. */
export function webpSize(b: Uint8Array): { w: number; h: number } | null {
  const tag = (at: number) => String.fromCharCode(...b.subarray(at, at + 4))
  if (b.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null
  const u16 = (at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
  const u24 = (at: number) => u16(at) | ((b[at + 2] ?? 0) << 16)
  const chunk = tag(12)
  if (chunk === 'VP8 ') return { w: u16(26) & 0x3fff, h: u16(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { w: u24(24) + 1, h: u24(27) + 1 }
  return null
}

export const SCREEN_WIDTH = 480
export const SCREEN_MAX_BYTES = 60 * 1024

export const olympusRule = (): Rule => ({
  key: 'olympus', title: 'Olympus changed and its bundle was not built',
  fix: 'Run `npm run build --prefix games/olympus` before you commit.',
})
export const followSuitRule = (): Rule => ({
  key: 'follow-suit', title: 'Follow Suit changed and its arcade copy was not built',
  fix: 'Run `npm run build:arcade --prefix follow-suit` before you commit.',
})
export const quietRule = (page: string): Rule => ({
  key: `quiet:${page}`, title: `${page} makes sound but does not load quiet.js first`,
  fix: 'Load `<script src="/arcade/quiet.js"></script>` as the first script in `<head>`.',
})
export const screenRule = (file: string, w: number | null, bytes: number): Rule => ({
  key: `screen:${file}`, title: `${file} is ${w === null ? 'not a WebP' : `${w} pixels wide`} and ${Math.round(bytes / 1024)} KB`,
  fix: `An arcade screen is a WebP ${SCREEN_WIDTH} pixels wide and under 60 KB.`,
})

/** The deny text a commit gets while rules are broken. */
export const tiltText = (rules: readonly Rule[]): string =>
  ['TILT (tilt-sensor): this commit breaks the house rules.', ...rules.map(r => `- ${r.title}. ${r.fix}`),
    'Fix them and commit again. The person can reset the sensor with /tilt-sensor.'].join('\n')

export const dangerText = (rule: Rule): string => `DANGER · ${rule.title}. ${rule.fix}`

export const statusText = (rules: readonly Rule[]): string | undefined =>
  rules.length === 0 ? undefined : `DANGER ×${rules.length} · ${rules[0]!.title}`

/** A changed path from one line of `git status --porcelain`, or null for a deletion. */
export function changedPath(line: string): string | null {
  if (line.length < 4 || line[0] === 'D' || line[1] === 'D') return null
  const rest = line.slice(3)
  const arrow = rest.lastIndexOf(' -> ')
  const path = arrow >= 0 ? rest.slice(arrow + 4) : rest
  return path.replace(/^"|"$/g, '')
}
