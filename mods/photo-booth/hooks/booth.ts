// The photo booth's rules: which commands are QA runs, where their screenshots go, and how big a
// shot is. The folders are the ones the QA scripts in qa/ write to by default, plus any folder the
// command names in a SHOTS or OUT variable. Pure: register.tsx looks in them after a QA run.

/** A QA run: a script under qa/, an end-to-end or browser run, or one that names a shot folder. */
export const isQaCommand = (command: string): boolean =>
  /(?:^|[\s/])qa\/|\bnpm\s+(?:--prefix\s+\S+\s+)?run\s+(?:qa|test:[\w-]+)|\bplaywright\b|\.e2e\.[cm]?[jt]s\b|\b[A-Z_]*SHOTS[A-Z_]*=/.test(command)

/** The folders the QA scripts write shots to when the command names none. */
export const DEFAULT_DIRS = [
  '/tmp/pinball-shots', '/tmp/swing-qa', '/tmp/fish-shots', '/tmp/creature-browser', '/opt/cursor/artifacts/screenshots',
]

/** The folders to look in after a command: the ones it names, the defaults, test-results, and extras. */
export function shotDirs(command: string, root: string, extra: readonly string[] = []): string[] {
  const named: string[] = []
  for (const m of command.matchAll(/\b[A-Z_]*(?:SHOTS|OUT|SCREENSHOTS?)[A-Z_]*=("[^"]+"|'[^']+'|[^\s;&|]+)/g)) {
    const raw = (m[1] ?? '').replace(/^["']|["']$/g, '')
    if (raw === '') continue
    named.push(raw.startsWith('/') ? raw : `${root}/${raw.replace(/^\.\//, '')}`)
  }
  const extras = extra.map(d => (d.startsWith('/') ? d : `${root}/${d}`))
  return [...new Set([...named, ...DEFAULT_DIRS, `${root}/test-results`, ...extras])]
}

/** The width and height a PNG states in its header, or null. */
export function pngSize(b: Uint8Array): { w: number; h: number } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null
  const u32 = (at: number) => (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>> 0
  return { w: u32(16), h: u32(20) }
}

/** Terminal rows for a picture `columns` wide: a cell is about twice as tall as it is wide. */
export const rowsFor = (size: { w: number; h: number } | null, columns: number, maxRows = 40): number =>
  Math.max(4, Math.min(maxRows, Math.round(((size?.h ?? 10) / (size?.w ?? 16)) * columns * 0.5)))

export type Shot = { path: string; name: string; mtimeMs: number; size: number }

/** The shot folders' PNG files newer than `since`, newest first. */
export function newShots(entries: readonly Shot[], since: number): Shot[] {
  return entries.filter(s => s.mtimeMs >= since && /\.png$/i.test(s.name)).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 200)
}
