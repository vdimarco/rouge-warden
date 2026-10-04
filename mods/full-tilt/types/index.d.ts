/** The lines over and under the table. */
export type FullTiltHud = {
  score: number
  /** Balls left, the one in play included. */
  balls: number
  multiplier: number
  best: number
  message: string
  state: 'ready' | 'play' | 'over'
  paused: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'full-tilt': {
      hud: FullTiltHud
      /** The last SVG frame, for the desktop and mobile apps. */
      svgFrame: string
    }
  }
}
