/**
 * Global type declarations for the Paige renderer process.
 *
 * Extends the Window interface with the `paige` API surface exposed
 * from the Electron preload script via contextBridge.
 *
 * Also extends React.CSSProperties to allow the Electron-specific
 * `-webkit-app-region` CSS property used for window drag regions.
 */

import 'react';

interface PaigeAPI {
  /** The operating system platform (e.g. 'darwin', 'linux', 'win32') */
  readonly platform: NodeJS.Platform;
  /** Terminal IPC bridge for PTY communication (see types/window.d.ts) */
  terminal: PaigeTerminalAPI;
}

declare global {
  interface Window {
    paige?: PaigeAPI;
  }
}

declare module 'react' {
  interface CSSProperties {
    /** Electron-specific: marks a region as draggable or not for frameless windows */
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

export {};
