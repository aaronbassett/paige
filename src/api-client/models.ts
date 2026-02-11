// Model alias resolution and pricing tables for Claude API
// Maps friendly tier names to full model IDs with per-token cost data.

/** Supported model tiers for API calls. */
export type ModelTier = 'haiku' | 'sonnet';

/** Per-million-token pricing for a model. */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Model mapping entry: tier → model ID + pricing. */
export interface ModelEntry {
  modelId: string;
  pricing: ModelPricing;
}

/** Map of model tiers to their full model IDs and pricing. */
export const MODEL_MAP: Record<ModelTier, ModelEntry> = {
  haiku: {
    modelId: 'claude-haiku-4-5-20251001',
    pricing: { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  },
  sonnet: {
    modelId: 'claude-sonnet-4-5-20250929',
    pricing: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  },
};

/**
 * Resolves a model tier to the full model ID.
 * @throws Error if tier is not recognized.
 */
export function resolveModel(_tier: ModelTier): string {
  return Promise.reject(new Error('Not implemented')) as unknown as string;
}

/**
 * Returns the pricing for a model tier.
 * @throws Error if tier is not recognized.
 */
export function getModelPricing(_tier: ModelTier): ModelPricing {
  return Promise.reject(new Error('Not implemented')) as unknown as ModelPricing;
}

/**
 * Computes cost estimate in USD from token counts and model tier.
 */
export function calculateCostEstimate(
  _tier: ModelTier,
  _inputTokens: number,
  _outputTokens: number,
): number {
  return Promise.reject(new Error('Not implemented')) as unknown as number;
}
