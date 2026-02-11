// Session wrap-up — calls 3 agents, stores results, updates session

export interface WrapUpResult {
  memoriesAdded: number;
  gapsIdentified: number;
  katasGenerated: number;
  assessmentsUpdated: number;
}

/** Runs session wrap-up: reflection -> knowledge gaps -> dreyfus -> mark complete. */
export function runSessionWrapUp(_sessionId: number): Promise<WrapUpResult> {
  return Promise.reject(new Error('Not implemented'));
}
