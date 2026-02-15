import { describe, it, expect } from 'vitest';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../../../src/coaching/thumbnails.js';

describe('thumbnails', () => {
  describe('extractYouTubeVideoId', () => {
    it('extracts from standard watch URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
    });

    it('extracts from short URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from embed URL', () => {
      expect(extractYouTubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for non-YouTube URL', () => {
      expect(extractYouTubeVideoId('https://example.com')).toBeNull();
    });
  });

  describe('getYouTubeThumbnailUrl', () => {
    it('returns mqdefault thumbnail URL', () => {
      const result = getYouTubeThumbnailUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    });

    it('returns null for invalid URL', () => {
      expect(getYouTubeThumbnailUrl('https://example.com')).toBeNull();
    });
  });
});
