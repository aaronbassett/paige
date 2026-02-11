/**
 * Unit tests for the HintManagerService.
 *
 * Covers hint application (all three styles), intensity gradient logic,
 * conflict resolution, auto-expand path computation, subscribe/unsubscribe,
 * clearHints, and the getAncestorPaths helper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HintManagerService,
  getAncestorPaths,
} from '../../../renderer/src/services/hint-manager';
import type { ExplorerHint } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService(): HintManagerService {
  return new HintManagerService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HintManagerService', () => {
  let service: HintManagerService;

  beforeEach(() => {
    service = createService();
  });

  // -------------------------------------------------------------------------
  // getAncestorPaths helper
  // -------------------------------------------------------------------------

  describe('getAncestorPaths', () => {
    it('extracts ancestor paths from a deep file path', () => {
      const result = getAncestorPaths('/src/components/Editor/Editor.tsx');
      expect(result).toEqual(['/src', '/src/components', '/src/components/Editor']);
    });

    it('returns empty array for a root-level file', () => {
      const result = getAncestorPaths('/file.txt');
      expect(result).toEqual([]);
    });

    it('returns single ancestor for a file one level deep', () => {
      const result = getAncestorPaths('/src/index.ts');
      expect(result).toEqual(['/src']);
    });

    it('handles deeply nested paths correctly', () => {
      const result = getAncestorPaths('/a/b/c/d/e/f.ts');
      expect(result).toEqual(['/a', '/a/b', '/a/b/c', '/a/b/c/d', '/a/b/c/d/e']);
    });
  });

  // -------------------------------------------------------------------------
  // applyHints — subtle style
  // -------------------------------------------------------------------------

  describe('applyHints with subtle style', () => {
    it('adds a hint only for the file itself', () => {
      const hints: ExplorerHint[] = [{ path: '/src/App.tsx', style: 'subtle' }];

      service.applyHints(hints);

      expect(service.getHint('/src/App.tsx')).toBeDefined();
      expect(service.getHint('/src')).toBeUndefined();
    });

    it('uses base intensity and spring values', () => {
      const hints: ExplorerHint[] = [{ path: '/src/App.tsx', style: 'subtle' }];

      service.applyHints(hints);

      const hint = service.getHint('/src/App.tsx')!;
      expect(hint.style).toBe('subtle');
      expect(hint.intensity).toBe(1.0);
      expect(hint.stiffness).toBe(120);
      expect(hint.damping).toBe(14);
    });

    it('does not auto-expand any paths', () => {
      const hints: ExplorerHint[] = [{ path: '/src/components/Editor.tsx', style: 'subtle' }];

      service.applyHints(hints);

      expect(service.getAutoExpandPaths().size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // applyHints — obvious style
  // -------------------------------------------------------------------------

  describe('applyHints with obvious style', () => {
    it('adds hints for the file and specified directories', () => {
      const hints: ExplorerHint[] = [
        {
          path: '/src/components/Editor/Editor.tsx',
          style: 'obvious',
          directories: ['/src/components', '/src/components/Editor'],
        },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src/components/Editor/Editor.tsx')).toBeDefined();
      expect(service.getHint('/src/components')).toBeDefined();
      expect(service.getHint('/src/components/Editor')).toBeDefined();
    });

    it('does not add hints for non-specified ancestor directories', () => {
      const hints: ExplorerHint[] = [
        {
          path: '/src/components/Editor/Editor.tsx',
          style: 'obvious',
          directories: ['/src/components/Editor'],
        },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src')).toBeUndefined();
      expect(service.getHint('/src/components')).toBeUndefined();
    });

    it('uses base intensity for all paths', () => {
      const hints: ExplorerHint[] = [
        {
          path: '/src/Editor.tsx',
          style: 'obvious',
          directories: ['/src'],
        },
      ];

      service.applyHints(hints);

      const fileHint = service.getHint('/src/Editor.tsx')!;
      const dirHint = service.getHint('/src')!;

      expect(fileHint.intensity).toBe(1.0);
      expect(dirHint.intensity).toBe(1.0);
      expect(fileHint.style).toBe('obvious');
      expect(dirHint.style).toBe('obvious');
    });

    it('auto-expands only the top-level directory', () => {
      const hints: ExplorerHint[] = [
        {
          path: '/src/components/Editor/Editor.tsx',
          style: 'obvious',
          directories: ['/src/components/Editor'],
        },
      ];

      service.applyHints(hints);

      const expandPaths = service.getAutoExpandPaths();
      expect(expandPaths.size).toBe(1);
      expect(expandPaths.has('/src')).toBe(true);
    });

    it('handles obvious hint without directories array', () => {
      const hints: ExplorerHint[] = [
        { path: '/src/App.tsx', style: 'obvious' },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src/App.tsx')).toBeDefined();
      expect(service.getAllHints().size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // applyHints — unmissable style
  // -------------------------------------------------------------------------

  describe('applyHints with unmissable style', () => {
    it('adds hints for the file and all ancestor directories', () => {
      const hints: ExplorerHint[] = [
        { path: '/src/components/Editor/Editor.tsx', style: 'unmissable' },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src/components/Editor/Editor.tsx')).toBeDefined();
      expect(service.getHint('/src/components/Editor')).toBeDefined();
      expect(service.getHint('/src/components')).toBeDefined();
      expect(service.getHint('/src')).toBeDefined();
    });

    it('applies intensity gradient that decreases with distance', () => {
      const hints: ExplorerHint[] = [
        { path: '/src/components/Editor/Editor.tsx', style: 'unmissable' },
      ];

      service.applyHints(hints);

      // Distance 0: file itself
      const file = service.getHint('/src/components/Editor/Editor.tsx')!;
      expect(file.intensity).toBe(1.0);
      expect(file.stiffness).toBe(120);
      expect(file.damping).toBe(14);

      // Distance 1: parent directory
      const parent = service.getHint('/src/components/Editor')!;
      expect(parent.intensity).toBe(0.9);
      expect(parent.stiffness).toBe(140);
      expect(parent.damping).toBe(16);

      // Distance 2: grandparent
      const grandparent = service.getHint('/src/components')!;
      expect(grandparent.intensity).toBe(0.7);
      expect(grandparent.stiffness).toBe(160);
      expect(grandparent.damping).toBe(18);

      // Distance 3: great-grandparent (clamped)
      const root = service.getHint('/src')!;
      expect(root.intensity).toBe(0.5);
      expect(root.stiffness).toBe(180);
      expect(root.damping).toBe(20);
    });

    it('clamps gradient at distance 3+ for very deep paths', () => {
      const hints: ExplorerHint[] = [
        { path: '/a/b/c/d/e/f.ts', style: 'unmissable' },
      ];

      service.applyHints(hints);

      // File at distance 0
      expect(service.getHint('/a/b/c/d/e/f.ts')!.intensity).toBe(1.0);
      // Parent at distance 1
      expect(service.getHint('/a/b/c/d/e')!.intensity).toBe(0.9);
      // Grandparent at distance 2
      expect(service.getHint('/a/b/c/d')!.intensity).toBe(0.7);
      // Distance 3 (clamped to 0.5)
      expect(service.getHint('/a/b/c')!.intensity).toBe(0.5);
      // Distance 4 (still clamped to 0.5)
      expect(service.getHint('/a/b')!.intensity).toBe(0.5);
      // Distance 5 (still clamped to 0.5)
      expect(service.getHint('/a')!.intensity).toBe(0.5);
    });

    it('auto-expands all ancestor directories', () => {
      const hints: ExplorerHint[] = [
        { path: '/src/components/Editor/Editor.tsx', style: 'unmissable' },
      ];

      service.applyHints(hints);

      const expandPaths = service.getAutoExpandPaths();
      expect(expandPaths.has('/src')).toBe(true);
      expect(expandPaths.has('/src/components')).toBe(true);
      expect(expandPaths.has('/src/components/Editor')).toBe(true);
      expect(expandPaths.size).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Conflict resolution
  // -------------------------------------------------------------------------

  describe('conflict resolution', () => {
    it('highest intensity wins when multiple hints affect same directory', () => {
      // Two hints: one unmissable deep in /src, one subtle in /src
      // The unmissable hint's gradient for /src should be lower (0.5),
      // but if another hint gives /src intensity 1.0, that should win.
      const hints: ExplorerHint[] = [
        { path: '/src/deep/nested/file.ts', style: 'unmissable' },
        {
          path: '/src/other.ts',
          style: 'obvious',
          directories: ['/src'],
        },
      ];

      service.applyHints(hints);

      // /src from unmissable would get 0.5 (distance 3),
      // but from obvious it gets 1.0 — highest wins
      const srcHint = service.getHint('/src')!;
      expect(srcHint.intensity).toBe(1.0);
    });

    it('keeps existing higher-intensity hint when a lower one arrives', () => {
      // Process obvious first (gives /src 1.0), then unmissable
      // that would give /src 0.5 — the 1.0 should be retained.
      const hints: ExplorerHint[] = [
        {
          path: '/src/one.ts',
          style: 'obvious',
          directories: ['/src'],
        },
        { path: '/src/deep/nested/two.ts', style: 'unmissable' },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src')!.intensity).toBe(1.0);
    });

    it('overwrites lower-intensity hint with higher one', () => {
      // Process unmissable first (gives /src 0.5), then obvious
      // that gives /src 1.0 — the 1.0 should win.
      const hints: ExplorerHint[] = [
        { path: '/src/deep/nested/one.ts', style: 'unmissable' },
        {
          path: '/src/two.ts',
          style: 'obvious',
          directories: ['/src'],
        },
      ];

      service.applyHints(hints);

      expect(service.getHint('/src')!.intensity).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // clearHints
  // -------------------------------------------------------------------------

  describe('clearHints', () => {
    it('removes all hints', () => {
      service.applyHints([
        { path: '/src/App.tsx', style: 'unmissable' },
        { path: '/src/index.ts', style: 'subtle' },
      ]);

      expect(service.getAllHints().size).toBeGreaterThan(0);

      service.clearHints();

      expect(service.getAllHints().size).toBe(0);
      expect(service.getHint('/src/App.tsx')).toBeUndefined();
    });

    it('clears auto-expand paths', () => {
      service.applyHints([{ path: '/src/deep/file.ts', style: 'unmissable' }]);

      expect(service.getAutoExpandPaths().size).toBeGreaterThan(0);

      service.clearHints();

      expect(service.getAutoExpandPaths().size).toBe(0);
    });

    it('notifies listeners', () => {
      service.applyHints([{ path: '/src/App.tsx', style: 'subtle' }]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.clearHints();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when already empty', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.clearHints();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // New applyHints replaces previous hints
  // -------------------------------------------------------------------------

  describe('hint replacement', () => {
    it('replaces all previous hints with new set', () => {
      service.applyHints([{ path: '/src/old.ts', style: 'subtle' }]);
      expect(service.getHint('/src/old.ts')).toBeDefined();

      service.applyHints([{ path: '/src/new.ts', style: 'subtle' }]);

      expect(service.getHint('/src/old.ts')).toBeUndefined();
      expect(service.getHint('/src/new.ts')).toBeDefined();
    });

    it('replaces auto-expand paths with new set', () => {
      service.applyHints([{ path: '/src/deep/old.ts', style: 'unmissable' }]);
      expect(service.getAutoExpandPaths().has('/src')).toBe(true);
      expect(service.getAutoExpandPaths().has('/src/deep')).toBe(true);

      service.applyHints([{ path: '/lib/new.ts', style: 'unmissable' }]);

      expect(service.getAutoExpandPaths().has('/src')).toBe(false);
      expect(service.getAutoExpandPaths().has('/lib')).toBe(true);
    });

    it('applies empty array to clear all hints', () => {
      service.applyHints([{ path: '/src/App.tsx', style: 'unmissable' }]);
      expect(service.getAllHints().size).toBeGreaterThan(0);

      service.applyHints([]);

      expect(service.getAllHints().size).toBe(0);
      expect(service.getAutoExpandPaths().size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -------------------------------------------------------------------------

  describe('subscribe/unsubscribe', () => {
    it('notifies listeners on applyHints', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.applyHints([{ path: '/src/App.tsx', style: 'subtle' }]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearHints', () => {
      service.applyHints([{ path: '/src/App.tsx', style: 'subtle' }]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.clearHints();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      service.applyHints([{ path: '/a.ts', style: 'subtle' }]);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      service.applyHints([{ path: '/b.ts', style: 'subtle' }]);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('supports multiple concurrent listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);
      service.subscribe(listener3);

      service.applyHints([{ path: '/a.ts', style: 'subtle' }]);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('continues notifying remaining listeners when one throws', () => {
      const listener1 = vi.fn();
      const throwingListener = vi.fn().mockImplementation(() => {
        throw new Error('test error');
      });
      const listener3 = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.subscribe(listener1);
      service.subscribe(throwingListener);
      service.subscribe(listener3);

      service.applyHints([{ path: '/a.ts', style: 'subtle' }]);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(throwingListener).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[HintManagerService] Listener error:',
        'test error',
      );

      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // getAllHints
  // -------------------------------------------------------------------------

  describe('getAllHints', () => {
    it('returns empty map when no hints applied', () => {
      expect(service.getAllHints().size).toBe(0);
    });

    it('returns all hints as a map', () => {
      service.applyHints([
        { path: '/src/a.ts', style: 'subtle' },
        { path: '/src/b.ts', style: 'subtle' },
      ]);

      const allHints = service.getAllHints();
      expect(allHints.size).toBe(2);
      expect(allHints.has('/src/a.ts')).toBe(true);
      expect(allHints.has('/src/b.ts')).toBe(true);
    });

    it('includes directory hints for unmissable style', () => {
      service.applyHints([
        { path: '/src/deep/file.ts', style: 'unmissable' },
      ]);

      const allHints = service.getAllHints();
      // File + /src + /src/deep = 3 entries
      expect(allHints.size).toBe(3);
      expect(allHints.has('/src/deep/file.ts')).toBe(true);
      expect(allHints.has('/src/deep')).toBe(true);
      expect(allHints.has('/src')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getAutoExpandPaths — comprehensive per-style
  // -------------------------------------------------------------------------

  describe('getAutoExpandPaths', () => {
    it('returns empty set for subtle hints', () => {
      service.applyHints([{ path: '/src/deep/nested/file.ts', style: 'subtle' }]);
      expect(service.getAutoExpandPaths().size).toBe(0);
    });

    it('returns top-level directory for obvious hints', () => {
      service.applyHints([
        {
          path: '/src/deep/nested/file.ts',
          style: 'obvious',
          directories: ['/src/deep'],
        },
      ]);

      const paths = service.getAutoExpandPaths();
      expect(paths.size).toBe(1);
      expect(paths.has('/src')).toBe(true);
    });

    it('returns all ancestor directories for unmissable hints', () => {
      service.applyHints([{ path: '/src/deep/nested/file.ts', style: 'unmissable' }]);

      const paths = service.getAutoExpandPaths();
      expect(paths.has('/src')).toBe(true);
      expect(paths.has('/src/deep')).toBe(true);
      expect(paths.has('/src/deep/nested')).toBe(true);
      expect(paths.size).toBe(3);
    });

    it('merges auto-expand paths from multiple hints', () => {
      service.applyHints([
        { path: '/src/a.ts', style: 'unmissable' },
        { path: '/lib/b.ts', style: 'obvious', directories: ['/lib'] },
      ]);

      const paths = service.getAutoExpandPaths();
      expect(paths.has('/src')).toBe(true);
      expect(paths.has('/lib')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles root-level file with unmissable style', () => {
      service.applyHints([{ path: '/file.ts', style: 'unmissable' }]);

      // File itself gets a hint, but no ancestors
      expect(service.getHint('/file.ts')).toBeDefined();
      expect(service.getHint('/file.ts')!.intensity).toBe(1.0);
      expect(service.getAllHints().size).toBe(1);
      expect(service.getAutoExpandPaths().size).toBe(0);
    });

    it('handles root-level file with obvious style and no directories', () => {
      service.applyHints([{ path: '/file.ts', style: 'obvious' }]);

      expect(service.getHint('/file.ts')).toBeDefined();
      expect(service.getAllHints().size).toBe(1);
      // No top-level dir for root-level file
      expect(service.getAutoExpandPaths().size).toBe(0);
    });

    it('handles multiple hints for the same file path', () => {
      // Two hints for the same file — second processed after first.
      // Since we clear first, only the current batch matters.
      // Within a batch, last hint should not overwrite if lower intensity.
      service.applyHints([
        { path: '/src/App.tsx', style: 'unmissable' },
        { path: '/src/App.tsx', style: 'subtle' },
      ]);

      // Unmissable is processed first (intensity 1.0 for the file).
      // Subtle is processed second (intensity 1.0 for the file).
      // Both have same intensity for the file, so the first one stays.
      const hint = service.getHint('/src/App.tsx')!;
      expect(hint.intensity).toBe(1.0);
    });

    it('returns a readonly map from getAllHints', () => {
      service.applyHints([{ path: '/src/a.ts', style: 'subtle' }]);
      const allHints = service.getAllHints();

      // The returned type is ReadonlyMap, so it should not have a set method
      // exposed to TypeScript. At runtime the underlying Map does, but
      // the type system prevents mutation.
      expect(allHints).toBeInstanceOf(Map);
    });

    it('returns a readonly set from getAutoExpandPaths', () => {
      service.applyHints([{ path: '/src/file.ts', style: 'unmissable' }]);
      const paths = service.getAutoExpandPaths();
      expect(paths).toBeInstanceOf(Set);
    });
  });
});
