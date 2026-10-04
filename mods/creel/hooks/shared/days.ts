// Copied from mods/shared/days.ts by mods/sync.mjs. Edit the source there, then run node mods/sync.mjs.
// Days in local time, for daily goals and once-a-day notes. mods/sync.mjs copies it into each
// mod's hooks/shared/.

/** The local date of a time, as YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** A whole number for the local day: one more each day. */
export function dayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}
