import { describe, it, expect } from 'vitest';
import {
  MODEL_MAP,
  resolveModel,
  getModelPricing,
  calculateCostEstimate,
} from '../../../src/api-client/models.js';

describe('MODEL_MAP', () => {
  it('contains a haiku entry with correct model ID', () => {
    expect(MODEL_MAP.haiku).toBeDefined();
    expect(MODEL_MAP.haiku.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('contains a sonnet entry with correct model ID', () => {
    expect(MODEL_MAP.sonnet).toBeDefined();
    expect(MODEL_MAP.sonnet.modelId).toBe('claude-sonnet-4-5-20250929');
  });
});

describe('resolveModel', () => {
  it('resolves haiku to the full model ID', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
  });

  it('resolves sonnet to the full model ID', () => {
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-5-20250929');
  });
});

describe('getModelPricing', () => {
  it('returns correct pricing for haiku', () => {
    const pricing = getModelPricing('haiku');

    expect(pricing).toEqual({
      inputPerMillion: 0.8,
      outputPerMillion: 4.0,
    });
  });

  it('returns correct pricing for sonnet', () => {
    const pricing = getModelPricing('sonnet');

    expect(pricing).toEqual({
      inputPerMillion: 3.0,
      outputPerMillion: 15.0,
    });
  });
});

describe('calculateCostEstimate', () => {
  it('computes cost for haiku with 1000 input / 500 output tokens', () => {
    const cost = calculateCostEstimate('haiku', 1000, 500);

    // (1000 * 0.8 + 500 * 4.0) / 1_000_000 = (800 + 2000) / 1_000_000 = 0.0028
    expect(cost).toBeCloseTo(0.0028, 10);
  });

  it('computes cost for sonnet with 2000 input / 1000 output tokens', () => {
    const cost = calculateCostEstimate('sonnet', 2000, 1000);

    // (2000 * 3.0 + 1000 * 15.0) / 1_000_000 = (6000 + 15000) / 1_000_000 = 0.021
    expect(cost).toBeCloseTo(0.021, 10);
  });

  it('returns 0 when both token counts are zero', () => {
    const cost = calculateCostEstimate('haiku', 0, 0);

    expect(cost).toBe(0);
  });
});
