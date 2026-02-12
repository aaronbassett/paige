// MCP Session tracking — maps MCP transport sessions to Paige coaching sessions

/** Active MCP session state. */
export interface McpSession {
  /** MCP transport session ID. */
  transportSessionId: string;
  /** Paige coaching session database ID (null if not yet started). */
  sessionId: number | null;
}

/** Map of active MCP sessions keyed by transport session ID. */
const sessions = new Map<string, McpSession>();

/** Get an active MCP session by transport session ID. */
export function getMcpSession(_transportSessionId: string): McpSession | undefined {
  return sessions.get(_transportSessionId);
}

/** Set an active MCP session. */
export function setMcpSession(_transportSessionId: string, _session: McpSession): void {
  sessions.set(_transportSessionId, _session);
}

/** Remove an MCP session. */
export function removeMcpSession(_transportSessionId: string): void {
  sessions.delete(_transportSessionId);
}

/** Get the count of active MCP sessions. */
export function getMcpSessionCount(): number {
  return sessions.size;
}

/** Clear all MCP sessions (for testing). Also clears the active session ID. */
export function clearMcpSessions(): void {
  sessions.clear();
  activeSessionId = null;
}

// ── Active Session Tracking ────────────────────────────────────────────────

/**
 * Simple module-level active session ID.
 * Tracks the currently active Paige coaching session (database primary key).
 * Only one session may be active at a time.
 */
let activeSessionId: number | null = null;

/** Returns the currently active session ID, or null if no session is active. */
export function getActiveSessionId(): number | null {
  return activeSessionId;
}

/** Sets the active session ID. */
export function setActiveSessionId(id: number): void {
  activeSessionId = id;
}

/** Clears the active session ID. */
export function clearActiveSessionId(): void {
  activeSessionId = null;
}
