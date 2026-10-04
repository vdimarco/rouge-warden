/** One broken house rule: its key, what is wrong, and the fix. */
export type TiltRule = { key: string; title: string; fix: string }

declare module 'claude-code' {
  interface PluginState {
    'tilt-sensor': {
      /** The rules an edit broke, kept until a build or a fix closes them. */
      open: TiltRule[]
      /** The rules the working tree broke at the last check. */
      tree: TiltRule[]
      /** Rule keys the person reset; the working tree check leaves them alone. */
      forgiven: string[]
      /** Builds that ran green this session. */
      built: { olympus: boolean; followSuit: boolean }
    }
  }
}
