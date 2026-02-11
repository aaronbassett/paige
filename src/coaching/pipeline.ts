// Coaching pipeline — transforms issue context into phased coaching plan

export interface PipelineInput {
  planText: string;
  issueSummary: string;
  issueNumber?: number;
}

export interface PipelineResult {
  planId?: number;
  title?: string;
  totalPhases?: number;
  memoryConnection?: string | null;
  estimatedDifficulty?: string;
  error?: string;
}

/** Runs the full coaching pipeline: memories -> coach agent -> store in SQLite -> broadcast. */
export function runCoachingPipeline(_input: PipelineInput): Promise<PipelineResult> {
  return Promise.reject(new Error('Not implemented'));
}
