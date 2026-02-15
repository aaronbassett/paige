import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CompletionModal } from '../../../../../renderer/src/components/Dashboard/materials/CompletionModal';
import type { LearningMaterial } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Mock framer-motion to avoid animation issues in happy-dom
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      // Strip framer-motion-specific props to avoid DOM warnings
      const { variants, initial, animate, exit, transition, layout, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeMaterial(overrides?: Partial<LearningMaterial>): LearningMaterial {
  return {
    id: 1,
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Learn React Hooks',
    description: 'A great intro to React hooks',
    thumbnailUrl: null,
    question: 'What is the purpose of useState?',
    viewCount: 0,
    status: 'pending',
    createdAt: '2026-02-15T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompletionModal', () => {
  it('renders the material title', () => {
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Learn React Hooks')).toBeInTheDocument();
  });

  it('renders the comprehension question', () => {
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('What is the purpose of useState?')).toBeInTheDocument();
  });

  it('renders "Comprehension check" subtitle', () => {
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Comprehension check')).toBeInTheDocument();
  });

  it('disables submit button when textarea is empty', () => {
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('enables submit button when text is entered', async () => {
    const user = userEvent.setup();
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'Some answer');
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('calls onSubmit with material id and trimmed answer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={onSubmit} onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'useState manages component state');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(1, 'useState manages component state');
  });

  it('trims whitespace from the answer before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={onSubmit} onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), '  my answer  ');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(1, 'my answer');
  });

  it('does not submit when only whitespace is entered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={onSubmit} onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), '   ');
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal body is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows "Checking..." text when submitting is true', () => {
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} submitting />
    );
    expect(screen.getByRole('button', { name: /submit/i })).toHaveTextContent('Checking...');
  });

  it('disables textarea and buttons when submitting', () => {
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} submitting />
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('has an accessible dialog role', () => {
    render(<CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
