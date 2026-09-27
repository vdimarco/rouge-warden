// Seedance 2.5 text-to-video through the Higgsfield API (server-side only).
//
// Run:  npm run example        (from this folder)
// Needs HF_CREDENTIALS="key-id:key-secret" in .env.local or in the environment.
// Prints the video URL on stdout. Progress and errors go to stderr.
// Exit code 0 only when the request completes with a video URL; failed, moderated (nsfw),
// canceled and timed-out requests exit 1 with the request id (see run() in lib.ts).

import { run, fail, done, clip } from './lib.ts';

const MODEL = 'bytedance/seedance-2.5/text-to-video';
const INPUT = {
  prompt: 'A cinematic scene at sunset',
  duration: 5,
  resolution: '720p',
  aspect_ratio: '16:9',
};

const result = await run(MODEL, INPUT);
const url = result.video?.url;
let ok = false;
try { ok = typeof url === 'string' && new URL(url).protocol === 'https:'; } catch { /* not a URL */ }
if (!ok) fail(`request ${result.request_id} completed but returned no usable video URL: ${clip(result.video ?? null)}`);
console.log(url);
done();
