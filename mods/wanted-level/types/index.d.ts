/** One risky move and the stars it earned. */
export type WantedMove = { what: string; stars: number; at: number }

/** The wanted level: 0 to 5 stars, when the last risky move came, and what earned the stars. */
export type WantedLevel = { stars: number; lastAt: number; moves: WantedMove[] }

declare module 'claude-code' {
  interface PluginState {
    'wanted-level': { level: WantedLevel }
  }
}
