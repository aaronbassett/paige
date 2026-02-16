/**
 * Type declarations for the Paige terminal IPC bridge.
 *
 * The terminal API is exposed from the Electron preload script via
 * contextBridge as `window.paige.terminal`. It provides a typed
 * interface for communicating with the PTY process running in the
 * Electron main process.
 */

interface PaigeTerminalAPI {
  /** Spawn a new PTY with the given working directory. */
  spawn: (cwd?: string) => void;

  /** Send raw data (user keystrokes) to the PTY process. */
  write: (data: string) => void;

  /** Resize the PTY to match the terminal viewport. */
  resize: (cols: number, rows: number) => void;

  /** Subscribe to PTY output data. */
  onData: (callback: (data: string) => void) => void;

  /** Subscribe to PTY exit events. */
  onExit: (callback: (info: { code: number; signal?: number }) => void) => void;
}

interface PaigeMenuAPI {
  /** Subscribe to Cmd+S (Save) routed from the application menu. Returns cleanup function. */
  onSave: (callback: () => void) => () => void;

  /** Subscribe to Cmd+W (Close Tab) routed from the application menu. Returns cleanup function. */
  onCloseTab: (callback: () => void) => () => void;
}

interface PaigeAPI {
  readonly platform: NodeJS.Platform;
  /** Open a URL in the host OS default browser. */
  openExternal: (url: string) => void;
  terminal: PaigeTerminalAPI;
  menu: PaigeMenuAPI;
}

interface Window {
  paige: PaigeAPI;
}
