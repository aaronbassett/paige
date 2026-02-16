import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupLogging, getLogger } from './logger.js';
import { setupPtyIpc } from './pty/pty-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = getLogger(['paige', 'electron', 'main']);

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

/** Send an IPC message to the focused renderer window (if any). */
function sendToFocusedRenderer(channel: string): void {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.webContents.send(channel);
  }
}

/**
 * Build a custom application menu.
 *
 * Without this, Electron's default menu intercepts Cmd+S and Cmd+W at the
 * main-process level, preventing those keystrokes from reaching the renderer's
 * window.addEventListener('keydown'). We override Save and Close Tab to send
 * IPC messages that the renderer's useFileOperations hook can handle.
 */
function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu — Cmd+S and Cmd+W route to renderer via IPC
    {
      label: 'File',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CommandOrControl+S',
          click: () => sendToFocusedRenderer('menu:save'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CommandOrControl+W',
          click: () => sendToFocusedRenderer('menu:close-tab'),
        },
        { type: 'separator' },
        // On macOS, avoid role:'close' here — its default Cmd+W accelerator
        // conflicts with our custom "Close Tab" handler above.
        isMac ? { role: 'quit' as const } : { role: 'quit' as const },
      ],
    },
    // Edit menu — required for clipboard shortcuts to work in renderer
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    // View menu — reload + devtools
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

void app.whenReady().then(async () => {
  await setupLogging();
  logger.info`Paige Electron UI starting`;
  buildAppMenu();
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
