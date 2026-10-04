/** How the pane came up: by itself when the session went idle, by /attract, or not at all. */
export type AttractOpened = '' | 'idle' | 'asked'

declare module 'claude-code' {
  interface PluginState {
    'attract-mode': {
      /** The last SVG frame, for the desktop and mobile apps. */
      svgFrame: string
      opened: AttractOpened
    }
  }
}
