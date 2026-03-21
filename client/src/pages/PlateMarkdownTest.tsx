'use client';

/**
 * Plate Markdown Test Page
 *
 * This page renders the full App from plate-markdown for testing purposes.
 * It imports the same App component from the standalone vite-markdown app
 * to test features without affecting the main hypowork structure.
 */

import App from '@/plate-markdown/App';

export function PlateMarkdownTest() {
  return <App />;
}

export default PlateMarkdownTest;
