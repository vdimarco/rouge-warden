/** One screenshot a QA run saved. */
export type PhotoBoothShot = { path: string; name: string; mtimeMs: number; size: number }

/** The last QA run's shots, newest first, and the one shown. */
export type PhotoBoothSet = { command: string; files: PhotoBoothShot[]; index: number }

declare module 'claude-code' {
  interface PluginState {
    'photo-booth': { shots: PhotoBoothSet }
  }
}
