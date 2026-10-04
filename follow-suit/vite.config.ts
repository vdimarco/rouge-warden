import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// `npm run build:arcade` builds the copy that the Cottage Arcade serves at /follow-suit/. That copy loads two
// scripts from the arcade: quiet.js, which must be the first script on the page because it silences the game
// while the page is hidden, and switch.js, the game switcher.
function arcadeScripts(): Plugin {
  const charset = '<meta charset="UTF-8" />';
  return {
    name: 'follow-suit-arcade-scripts',
    transformIndexHtml(html) {
      if (!html.includes(charset)) throw new Error(`index.html needs ${charset} for the arcade scripts`);
      return html.replace(
        charset,
        `${charset}\n    <script src="/arcade/quiet.js"></script>\n    <script src="/arcade/switch.js"></script>`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const arcade = mode === 'arcade';
  return {
    base: arcade ? '/follow-suit/' : '/',
    plugins: arcade ? [react(), arcadeScripts()] : [react()],
    build: arcade ? { outDir: '../public/follow-suit', emptyOutDir: true } : {},
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  };
});
