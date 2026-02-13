import { contextBridge, ipcRenderer } from 'electron';

/** API surface exposed to the renderer process via window.paige */
interface PaigeAPI {
  /** The operating system platform (e.g. 'darwin', 'linux', 'win32') */
  readonly platform: NodeJS.Platform;
  /** Terminal IPC bridge for xterm.js integration */
  terminal: {
    /** Spawn a new PTY with the given working directory. */
    spawn: (cwd?: string) => void;
    /** Write data to the PTY stdin (user keystrokes). */
    write: (data: string) => void;
    /** Resize the PTY to match terminal dimensions. */
    resize: (cols: number, rows: number) => void;
    /** Register a listener for PTY data output. */
    onData: (callback: (data: string) => void) => void;
    /** Register a listener for PTY process exit. */
    onExit: (callback: (info: { code: number; signal?: number }) => void) => void;
  };
}

const api: PaigeAPI = {
  platform: process.platform,
  terminal: {
    spawn: (cwd?: string) => {
      ipcRenderer.send('terminal:spawn', cwd);
    },
    write: (data: string) => {
      ipcRenderer.send('terminal:write', data);
    },
    resize: (cols: number, rows: number) => {
      ipcRenderer.send('terminal:resize', { cols, rows });
    },
    onData: (callback: (data: string) => void) => {
      ipcRenderer.on('terminal:data', (_event, data: string) => {
        callback(data);
      });
    },
    onExit: (callback: (info: { code: number; signal?: number }) => void) => {
      ipcRenderer.on('terminal:exit', (_event, info: { code: number; signal?: number }) => {
        callback(info);
      });
    },
  },
};

contextBridge.exposeInMainWorld('paige', api);
