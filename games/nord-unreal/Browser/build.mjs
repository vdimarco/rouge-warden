import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { signallingUrl } from './config.mjs';

const endpoint = process.env.NORD_SIGNALLING_URL || '';
// Local HTTP inspection may use loopback WS; every deployed browser validates WSS again.
signallingUrl(endpoint, process.env.VERCEL ? 'deployment.vercel.app' : 'localhost');
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await build({
  entryPoints: ['player.js'],
  outfile: 'dist/player.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['chrome110', 'firefox115', 'safari17'],
  define: {
    NORD_SIGNALLING_URL: JSON.stringify(endpoint),
    NORD_DEFAULT_STREAMER_ID: JSON.stringify(process.env.NORD_DEFAULT_STREAMER_ID || 'NordHost'),
    // Viewport-shaped phone frames need the tall HUD; NORD_PORTRAIT_STREAM=0 retains legacy adaptive 16:9 frames.
    NORD_PORTRAIT_STREAM: JSON.stringify(process.env.NORD_PORTRAIT_STREAM !== '0')
  }
});
await Promise.all(['index.html', 'styles.css', 'hero.css', 'intro.css', 'menu.css', 'hero.js', 'crew.js', 'intro.js', 'menu.js', 'install.js', 'crew-sprite.webp', 'THIRD_PARTY_NOTICES.txt', 'manifest.webmanifest', 'bungee-400.woff2', 'barlow-condensed-500.woff2', 'barlow-condensed-700.woff2', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].map(file => copyFile(file, `dist/${file}`)));
console.log(`NORD browser player built (${endpoint ? 'signalling configured' : 'host offline'}).`);
