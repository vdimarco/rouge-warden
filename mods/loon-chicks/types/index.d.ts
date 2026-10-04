/** Where a chick is: swimming (the subagent runs), home (it answered), or taken by the eel. */
export type ChickState = 'swimming' | 'home' | 'eel'

/** One subagent of this session, as a chick. */
export type Chick = {
  /** The subagent's id. */
  id: string
  /** The Agent call's description, or the agent type. */
  label: string
  state: ChickState
  /** The clutch it hatched in: a new clutch starts after every chick of the last is in. */
  clutch: number
  since: number
  endedAt?: number
  /** Why the eel took it: stopped, failed, refused. */
  why?: string
  /** How it was seen to start: a spawn, whose turn's end says how it came in, or only the classic subagent event. */
  seen?: 'spawn' | 'classic'
}

declare module 'claude-code' {
  interface PluginState {
    'loon-chicks': {
      chicks: Chick[]
      /** When the last clutch came in, so the band can hide a few seconds later; 0 while one swims. */
      inAt: number
      frame: number
    }
  }
}
