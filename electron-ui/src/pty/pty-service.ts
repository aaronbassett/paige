import { BrowserWindow, ipcMain } from 'electron';
import { getLogger } from '../logger.js';
import { ptyManager } from './pty-manager.js';

const logger = getLogger(['paige', 'electron', 'pty']);

/** IPC channel constants for terminal communication. */
const CHANNELS = {
  SPAWN: 'terminal:spawn',
  WRITE: 'terminal:write',
  RESIZE: 'terminal:resize',
  DATA: 'terminal:data',
  EXIT: 'terminal:exit',
} as const;

/**
 * Set up IPC handlers that bridge the PTY process to the renderer.
 *
 * Spawns a PTY, registers ipcMain listeners for renderer-to-PTY communication,
 * and forwards PTY output back to the renderer via webContents.send.
 *
 * @param mainWindow - The BrowserWindow whose renderer will communicate with the PTY.
 * @returns A cleanup function that kills the PTY and removes IPC handlers.
 */
export function setupPtyIpc(mainWindow: BrowserWindow): () => void {
  // Handle PTY spawn request from renderer (includes projectDir from backend)
  const handleSpawn = (_event: Electron.IpcMainEvent, cwd?: string): void => {
    if (ptyManager.isAlive) {
      logger.warn`PTY already spawned, ignoring spawn request`;
      return;
    }

    try {
      ptyManager.spawn(cwd);

      // Forward PTY output to renderer
      ptyManager.onData((data) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(CHANNELS.DATA, data);
        }
      });

      ptyManager.onExit((code, signal) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(CHANNELS.EXIT, { code, signal });
        }
      });
    } catch (error) {
      logger.error`Failed to spawn terminal: ${error}`;
      logger.error`Terminal will not be available. This may be due to node-pty native module issues.`;
      logger.error`Try rebuilding: cd electron-ui && npm rebuild node-pty`;
    }
  };

  // Handle renderer-to-PTY write
  const handleWrite = (_event: Electron.IpcMainEvent, data: string): void => {
    ptyManager.write(data);
  };

  // Handle renderer-to-PTY resize
  const handleResize = (
    _event: Electron.IpcMainEvent,
    size: { cols: number; rows: number }
  ): void => {
    ptyManager.resize(size.cols, size.rows);
  };

  ipcMain.on(CHANNELS.SPAWN, handleSpawn);
  ipcMain.on(CHANNELS.WRITE, handleWrite);
  ipcMain.on(CHANNELS.RESIZE, handleResize);

  // Return cleanup function
  return () => {
    ipcMain.removeListener(CHANNELS.SPAWN, handleSpawn);
    ipcMain.removeListener(CHANNELS.WRITE, handleWrite);
    ipcMain.removeListener(CHANNELS.RESIZE, handleResize);
    ptyManager.kill();
  };
}
