// MCP Session tracking — maps MCP transport sessions to Paige coaching sessions
// TDD stub — will be implemented in Phase 8

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

/** Clear all MCP sessions (for testing). */
export function clearMcpSessions(): void {
  sessions.clear();
}
