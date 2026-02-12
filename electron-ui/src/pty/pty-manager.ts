import * as pty from 'node-pty';
import type { IPty, IDisposable } from 'node-pty';

/**
 * Manages the lifecycle of a single PTY (pseudo-terminal) instance.
 * Handles spawning, data I/O, resizing, and cleanup.
 */
export class PtyManager {
  private process: IPty | null = null;
  private dataDisposable: IDisposable | null = null;
  private exitDisposable: IDisposable | null = null;

  /** Whether the PTY process is currently alive. */
  get isAlive(): boolean {
    return this.process !== null;
  }

  /**
   * Spawn a new shell PTY process.
   * Uses the user's default shell on Unix, cmd.exe on Windows.
   * @throws If a PTY is already running (call kill() first).
   */
  spawn(): void {
    if (this.process) {
      throw new Error('PTY already running. Call kill() before spawning a new one.');
    }

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : (process.env.SHELL ?? '/bin/bash');

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      ),
      TERM: 'xterm-256color',
    };

    this.process = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME ?? process.cwd(),
      env,
    });
  }

  /**
   * Write data to the PTY's stdin.
   * @param data - The data string to write (typically user keystrokes).
   */
  write(data: string): void {
    if (!this.process) {
      return;
    }
    this.process.write(data);
  }

  /**
   * Resize the PTY dimensions.
   * @param cols - Number of columns.
   * @param rows - Number of rows.
   */
  resize(cols: number, rows: number): void {
    if (!this.process) {
      return;
    }
    try {
      this.process.resize(cols, rows);
    } catch {
      // Resize can fail if the process has already exited
    }
  }

  /**
   * Register a callback for PTY data output.
   * @param callback - Called with each chunk of data from the PTY.
   */
  onData(callback: (data: string) => void): void {
    this.dataDisposable?.dispose();
    this.dataDisposable = this.process?.onData(callback) ?? null;
  }

  /**
   * Register a callback for when the PTY process exits.
   * @param callback - Called with the exit code and optional signal number.
   */
  onExit(callback: (exitCode: number, signal?: number) => void): void {
    this.exitDisposable?.dispose();
    this.exitDisposable =
      this.process?.onExit(({ exitCode, signal }) => {
        this.process = null;
        callback(exitCode, signal);
      }) ?? null;
  }

  /** Kill the PTY process and clean up listeners. */
  kill(): void {
    this.dataDisposable?.dispose();
    this.dataDisposable = null;
    this.exitDisposable?.dispose();
    this.exitDisposable = null;

    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }
  }
}

/** Singleton PTY manager instance for the application. */
export const ptyManager = new PtyManager();
