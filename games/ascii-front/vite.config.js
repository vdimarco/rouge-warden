import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'arcade' ? [{
    name: 'warden-arcade-shell',
    transformIndexHtml(html) {
      return html.replace('<head>', '<head><script src="/arcade/quiet.js"></script>')
        .replace('</body>', '<script src="/arcade/switch.js"></script><script src="/arcade/analytics.js" data-game="ascii-front"></script></body>');
    },
  }] : [],
}));
