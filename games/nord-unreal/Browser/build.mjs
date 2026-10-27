import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { signallingUrl } from './config.mjs';

const endpoint = process.env.NORD_SIGNALLING_URL || '';
const qaPin = process.env.NORD_QA_PIN === '1';
// A deployed player never holds a phone rung.
if (qaPin && process.env.VERCEL) throw new Error('NORD_QA_PIN=1 is for a local QA build; unset it for a Vercel build');
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
    NORD_PORTRAIT_STREAM: JSON.stringify(process.env.NORD_PORTRAIT_STREAM !== '0'),
    // Only a local QA build (NORD_QA_PIN=1) lets ?pin=0-3 hold one phone rung for a gauntlet sample.
    NORD_QA_PIN: JSON.stringify(qaPin)
  }
});
await Promise.all(['index.html', 'styles.css', 'hero.css', 'intro.css', 'menu.css', 'hero.js', 'crew.js', 'intro.js', 'menu.js', 'install.js', 'mission-card.js', 'crew-sprite.webp', 'title-loop-wide.mp4', 'title-loop-tall.mp4', 'THIRD_PARTY_NOTICES.txt', 'manifest.webmanifest', 'bungee-400.woff2', 'barlow-condensed-500.woff2', 'barlow-condensed-700.woff2', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].map(file => copyFile(file, `dist/${file}`)));
console.log(`NORD browser player built (${endpoint ? 'signalling configured' : 'host offline'}${qaPin ? ', QA rung pin: do not deploy' : ''}).`);
