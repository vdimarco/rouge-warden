/** The id of the cabinet in play (cabinets.ts), or '' before the session edits a game. */
export type CabinetSpinnerCabinet = string

declare module 'claude-code' {
  interface PluginState {
    'cabinet-spinner': { cabinet: CabinetSpinnerCabinet }
  }
}
