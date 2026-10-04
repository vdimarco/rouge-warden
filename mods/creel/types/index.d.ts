/** A line out: a foreground Bash command that has run 3 seconds or more. */
export type CreelLine = { id: string; command: string; since: number }

/** One catch, as catch.ts lands it. */
export type CreelFish = { id: string; name: string; kg: number; article?: string; legend?: true; junk?: true; big?: true }

/** The creel kept across sessions. */
export type CreelBook = {
  total: number
  junk: number
  kinds: Record<string, { name: string; count: number; best: number }>
  legends: string[]
}

/** Today's catch, for the daily goal. */
export type CreelToday = { key: string; catches: CreelFish[]; done: boolean }

declare module 'claude-code' {
  interface PluginState {
    creel: {
      lines: CreelLine[]
      landed: { text: string; until: number } | null
      frame: number
      creel: CreelBook
      today: CreelToday
    }
  }
}
