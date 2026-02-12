/**
 * Happy Path Test Template
 *
 * Use this template when writing tests for user-facing workflows.
 * Follow the Arrange-Act-Assert pattern for clarity.
 *
 * Structure:
 * - describe: Group by component/feature
 * - it: One assertion per test, named as user expectation
 * - Arrange: Set up component/mock state
 * - Act: Trigger user interaction
 * - Assert: Verify visible outcome
 */
import { describe, it, expect } from 'vitest';

describe('Template: Happy Path', () => {
  it('demonstrates the Arrange-Act-Assert pattern', () => {
    // Arrange: Set up initial state
    const items = ['learn', 'code', 'grow'];

    // Act: Perform the operation
    const result = items.filter((item) => item.length > 4);

    // Assert: Verify the expected outcome
    expect(result).toEqual(['learn']);
  });

  it('demonstrates async test pattern', async () => {
    // Arrange
    const fetchData = (): Promise<string> => Promise.resolve('coaching data');

    // Act
    const data = await fetchData();

    // Assert
    expect(data).toBe('coaching data');
  });
});
