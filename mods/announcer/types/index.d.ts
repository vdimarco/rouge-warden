export type AnnouncerTally = {
  /** Green check runs this session. */
  greens: number
  /** Red check runs this session. */
  reds: number
  /** Green check runs in a row. */
  streak: number
  /** Green check runs in the current main turn. */
  turnGreens: number
}

declare module 'claude-code' {
  interface PluginState {
    announcer: { tally: AnnouncerTally }
  }
}
