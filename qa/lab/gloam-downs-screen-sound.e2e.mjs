// Gloam Downs: the selection screens' cues, rendered offline in a real browser (openspec/changes/gloam-downs-screens-life, "Screen
// sounds"). Each of hover, reveal, pick, kindle and tally, and choice, is played alone through the game's own sound.js (createMix and
// createSound) into an OfflineAudioContext in the Gaol's key, and its peak is read: each new cue's peak is under choice's, and none
// clips. The page is only the host of the module (?run&test); no AudioContext of the game starts.
// Needs this tree served: python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-screen-sound.e2e.mjs   (SITE_URL for another port)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
try {
  const ctx = await browser.newContext();
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7&nodraw`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
  const peaks = await page.evaluate(async () => {
    const { createMix, createSound, CUES } = await import('./sound.js');
    const out = {};
    for (const name of ['choice', 'hover', 'reveal', 'pick', 'kindle', 'tally']) {
      let worst = 0, rms = 0;
      // each of the four variants, as a run plays them in turn
      for (let variant = 0; variant < 4; variant++) {
        const SR = 44100, c = new OfflineAudioContext(2, SR * 2, SR), mix = createMix(c), fx = createSound(c, { mix, seed: 7, key: 50 });
        const r = fx.play(name, 0.05, { variant });
        if (!r) throw new Error(`${name} did not play`);
        const buf = await c.startRendering();
        let pk = 0, sum = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; sum += d[i] * d[i]; } }
        worst = Math.max(worst, pk);
        rms = Math.max(rms, Math.sqrt(sum / (buf.length * buf.numberOfChannels)));
      }
      out[name] = { peak: +(20 * Math.log10(worst || 1e-9)).toFixed(2), rms: +(20 * Math.log10(rms || 1e-9)).toFixed(2), cue: !!CUES[name] };
    }
    return out;
  });
  for (const [k, v] of Object.entries(peaks)) {
    assert(v.cue, `${k} is in CUES`);
    assert(v.peak < -1, `${k} clips: ${v.peak} dBFS`);
    if (k !== 'choice') assert(v.peak < peaks.choice.peak, `${k}'s peak ${v.peak} is not under choice's ${peaks.choice.peak}`);
  }
  assert.deepEqual(errors, []);
  pass('hover, reveal, pick, kindle and tally, each in the Gaol\'s key, peak under choice and do not clip (dBFS)', peaks);
  await ctx.close();
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
