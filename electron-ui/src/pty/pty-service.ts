import { BrowserWindow, ipcMain } from 'electron';
import { ptyManager } from './pty-manager.js';

/** IPC channel constants for terminal communication. */
const CHANNELS = {
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
  // Spawn the PTY shell
  ptyManager.spawn();

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

  ipcMain.on(CHANNELS.WRITE, handleWrite);
  ipcMain.on(CHANNELS.RESIZE, handleResize);

  // Return cleanup function
  return () => {
    ipcMain.removeListener(CHANNELS.WRITE, handleWrite);
    ipcMain.removeListener(CHANNELS.RESIZE, handleResize);
    ptyManager.kill();
  };
}
