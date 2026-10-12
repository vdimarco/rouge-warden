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
    NORD_DEFAULT_STREAMER_ID: JSON.stringify(process.env.NORD_DEFAULT_STREAMER_ID || 'NordHost')
  }
});
await Promise.all(['index.html', 'styles.css', 'THIRD_PARTY_NOTICES.txt'].map(file => copyFile(file, `dist/${file}`)));
console.log(`NORD browser player built (${endpoint ? 'signalling configured' : 'host offline'}).`);
