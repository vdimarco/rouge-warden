// The brood: every subagent hatches as a chick in the current clutch, swims while it runs, and comes in
// home or to the eel. When no chick of a clutch swims, the clutch is in, and the next chick starts a
// new one, as each full nest in Loon Echo hatches the next clutch. Pure: register.ts keeps the chicks
// and draws them.
import type { Chick } from '../types'

/** How long the band stays after a clutch comes in. */
export const HIDE_MS = 8000

export const latestClutch = (chicks: readonly Chick[]): number => chicks.reduce((n, c) => Math.max(n, c.clutch), 0)

/** A new chick, in the clutch that still swims, else in a new one. A chick it knows keeps its place. */
export function hatch(chicks: readonly Chick[], id: string, label: string, now: number, seen: 'spawn' | 'classic' = 'spawn'): Chick[] {
  if (chicks.some(c => c.id === id)) return relabel(chicks, id, label)
  const latest = latestClutch(chicks)
  const swims = chicks.some(c => c.clutch === latest && c.state === 'swimming')
  const clutch = latest === 0 ? 1 : swims ? latest : latest + 1
  const chick: Chick = { id, label, state: 'swimming', clutch, since: now, seen }
  return [...chicks, chick].slice(-200)
}

/** A better name for a chick: the Agent call's description over the agent type. */
export function relabel(chicks: readonly Chick[], id: string, label: string): Chick[] {
  if (label.trim() === '') return [...chicks]
  return chicks.map(c => (c.id === id ? { ...c, label } : c))
}

export type ClutchIn = { clutch: number; home: number; eel: number }

/** A chick comes in. Says whether that brought its whole clutch in. */
export function settle(chicks: readonly Chick[], id: string, state: 'home' | 'eel', now: number, why?: string):
  { chicks: Chick[]; chick: Chick | null; clutchIn: ClutchIn | null } {
  const chick = chicks.find(c => c.id === id)
  if (chick === undefined || chick.state !== 'swimming') return { chicks: [...chicks], chick: null, clutchIn: null }
  const done: Chick = { ...chick, state, endedAt: now, ...(why !== undefined ? { why } : {}) }
  const next = chicks.map(c => (c.id === id ? done : c))
  const mates = next.filter(c => c.clutch === chick.clutch)
  const clutchIn = mates.some(c => c.state === 'swimming') ? null : {
    clutch: chick.clutch, home: mates.filter(c => c.state === 'home').length, eel: mates.filter(c => c.state === 'eel').length,
  }
  return { chicks: next, chick: done, clutchIn }
}

/** Why the eel took a chick, from the way its turn ended. */
export const whyOf = (reason: string): string =>
  reason === 'aborted' ? 'stopped' : reason === 'refusal' ? 'refused' : reason === 'error' ? 'failed' : reason

export const eelToast = (chick: Chick): string => `The eel took a chick: ${chick.label} (${chick.why ?? 'lost'}).`

export const clutchToast = (c: ClutchIn): string =>
  c.eel > 0
    ? `Clutch ${c.clutch} is in: ${c.home} home, ${c.eel} taken by the eel.`
    : c.home === 1
      ? 'The chick is home. A new clutch hatches next.'
      : `All ${c.home} chicks are home. A new clutch hatches next.`

/** The clutch the band shows, or null when the band has nothing to show. */
export function bandClutch(chicks: readonly Chick[], inAt: number, now: number): Chick[] | null {
  const latest = latestClutch(chicks)
  if (latest === 0) return null
  const clutch = chicks.filter(c => c.clutch === latest)
  if (!clutch.some(c => c.state === 'swimming') && now - inAt > HIDE_MS) return null
  return clutch
}

/** How long a chick has swum, or swam. */
export function ageText(chick: Chick, now: number): string {
  const s = Math.max(0, Math.round(((chick.endedAt ?? now) - chick.since) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}
