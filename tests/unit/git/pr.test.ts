import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the github client before importing the module under test.
vi.mock('../../../src/github/client.js', () => ({
  getOctokit: vi.fn(),
}));

import { getOctokit } from '../../../src/github/client.js';
import { createPullRequest } from '../../../src/git/pr.js';

const mockGetOctokit = vi.mocked(getOctokit);

describe('createPullRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates PR and returns url and number', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/42',
        number: 42,
      },
    });

    mockGetOctokit.mockReturnValue({
      rest: { pulls: { create: mockCreate } },
    } as never);

    const result = await createPullRequest(
      'owner',
      'repo',
      'feature-branch',
      'main',
      'Add login feature',
      'Implements OAuth2 login',
    );

    expect(result).toEqual({
      prUrl: 'https://github.com/owner/repo/pull/42',
      prNumber: 42,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      title: 'Add login feature',
      body: 'Implements OAuth2 login',
      head: 'feature-branch',
      base: 'main',
    });
  });

  it('throws when no GitHub token', async () => {
    mockGetOctokit.mockReturnValue(null);

    await expect(
      createPullRequest('owner', 'repo', 'branch', 'main', 'title', 'body'),
    ).rejects.toThrow('GitHub API not available');
  });
});
