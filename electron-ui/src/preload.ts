import { contextBridge } from 'electron';

/** API surface exposed to the renderer process via window.paige */
interface PaigeAPI {
  /** The operating system platform (e.g. 'darwin', 'linux', 'win32') */
  readonly platform: NodeJS.Platform;
  // Terminal API will be added here once IPC handlers are implemented.
  // It will expose methods like resize, write, and onData for xterm.js integration.
}

const api: PaigeAPI = {
  platform: process.platform,
};

contextBridge.exposeInMainWorld('paige', api);
