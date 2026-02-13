import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupPtyIpc } from './pty/pty-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';

  const window = new BrowserWindow({
    width: 1920,
    height: 1188,
    minWidth: 1200,
    minHeight: 742,
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    void window.loadURL('http://localhost:5173');
  } else {
    void window.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Set up PTY ↔ renderer IPC bridge
  const cleanupPty = setupPtyIpc(window);

  window.on('closed', () => {
    cleanupPty();
  });

  return window;
}

void app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    // and no other windows are open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, applications typically stay active until the user
  // explicitly quits with Cmd+Q.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
