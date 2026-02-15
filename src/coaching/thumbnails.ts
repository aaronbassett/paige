import fs from 'node:fs';
import path from 'node:path';
import { getLogger } from '../logger/logtape.js';
import { loadEnv } from '../config/env.js';

const logger = getLogger(['paige', 'coaching', 'thumbnails']);

/**
 * Extract YouTube video ID from various URL formats.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * Get YouTube thumbnail URL using the predictable static URL pattern.
 */
export function getYouTubeThumbnailUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Capture a screenshot of a URL using Playwright and save as thumbnail.
 * Returns the local file path or null if capture fails.
 */
export async function captureArticleThumbnail(
  url: string,
  materialId: number,
): Promise<string | null> {
  const config = loadEnv();
  const thumbnailDir = path.join(config.dataDir, 'thumbnails');

  try {
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const outputPath = path.join(thumbnailDir, `${materialId}.png`);

    // Dynamic import to avoid hard dependency — Playwright is optional
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await browser.close();

    return outputPath;
  } catch (err) {
    logger.error`Failed to capture screenshot: ${err}`;
    return null;
  }
}

/**
 * Get thumbnail URL for a learning material.
 * YouTube: static URL. Articles: Playwright capture (async, may return null).
 */
export async function getThumbnailUrl(
  type: 'youtube' | 'article',
  url: string,
  materialId: number,
): Promise<string | null> {
  if (type === 'youtube') {
    return getYouTubeThumbnailUrl(url);
  }
  return captureArticleThumbnail(url, materialId);
}
