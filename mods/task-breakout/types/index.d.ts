/** What the pane says about the active change. */
export type BreakoutView = {
  change: string
  left: number
  total: number
  /** The next open tasks, first first. */
  next: string[]
  /** Changes with every box checked that are not archived. */
  cleared: string[]
  /** Other changes with open tasks, for Next change. */
  others: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'task-breakout': {
      view: BreakoutView | null
      /** The last SVG frame, for the desktop and mobile apps. */
      svgFrame: string
      /** The change whose task list the session last edited. */
      lastEdited: string
    }
  }
}
