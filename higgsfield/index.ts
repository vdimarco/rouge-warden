// Seedance 2.5 text-to-video through the Higgsfield API (server-side only).
//
// Run:  npm run example        (from this folder)
// Needs HF_CREDENTIALS="key-id:key-secret" in .env.local or in the environment.
// Prints the video URL on stdout. Progress and errors go to stderr.
// Exit code 0 only when the request completes with a video URL.
//
// The SDK's subscribe() sends the request once. This file then polls the status endpoint itself,
// because SDK 0.2.6 stops waiting on one failed status check and keeps polling a canceled request.

import type { V2Response } from '@higgsfield/client/v2';

const MODEL = 'bytedance/seedance-2.5/text-to-video';
const INPUT = {
  prompt: 'A cinematic scene at sunset',
  duration: 5,
  resolution: '720p',
  aspect_ratio: '16:9',
};
const API = 'https://api.higgsfield.ai';
const MAX_WAIT_MS = 20 * 60_000;
const WAITING = new Set(['queued', 'in_progress']);

// The status endpoint also returns "canceled" and an "error" field,
// which the SDK's V2Response type does not list.
type RequestStatus = Omit<V2Response, 'status'> & { status: string; error?: string };

// Anything short of a printed URL exits 1, even if the process ends early and silently.
process.exitCode = 1;
let settled = false;

// .env.local sits next to this file and never leaves the machine.
// Values already in the environment win over the file.
try {
  process.loadEnvFile(new URL('./.env.local', import.meta.url));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error('Higgsfield: could not read .env.local.');
    process.exit(1);
  }
}

const credentials = process.env.HF_CREDENTIALS?.trim() ?? '';

// Remove the credential from any text before it is printed.
function redact(text: string): string {
  let out = text;
  for (const secret of [credentials, ...credentials.split(':')]) {
    if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out;
}

function fail(message: string): never {
  settled = true;
  console.error(`Higgsfield: ${redact(message)}`);
  process.exit(1);
}

function note(message: string): void {
  console.error(`Higgsfield: ${redact(message)}`);
}

// Redact first, then shorten, so a cut can never split a secret.
const clip = (value: unknown): string => redact(typeof value === 'string' ? value : JSON.stringify(value) ?? '').slice(0, 800);

process.on('beforeExit', () => {
  if (!settled) fail('the request never settled (the connection closed before a response).');
});

async function main(): Promise<void> {
  if (!credentials) {
    fail('HF_CREDENTIALS is not set. Put HF_CREDENTIALS="key-id:key-secret" in higgsfield/.env.local.');
  }
  if (credentials.split(':').length !== 2 || credentials.split(':').some((part) => !part)) {
    fail('HF_CREDENTIALS must have the form "key-id:key-secret" (one colon).');
  }

  // With DEBUG set, a module under the SDK prints request headers, and the key with them.
  // It reads DEBUG when it loads, so clear it before the SDK loads.
  delete process.env.DEBUG;
  const sdk = await import('@higgsfield/client/v2');

  // One submit only: the SDK would otherwise re-send the paid request up to 3 more times after an error.
  sdk.config({ credentials, maxRetries: 0 });

  // Never print a raw error object: an HTTP client error carries the request
  // headers, and the Authorization header holds the key.
  function describe(err: unknown): string {
    if (err instanceof sdk.CredentialsMissedError) return 'the SDK found no credentials.';
    if (err instanceof sdk.AuthenticationError) return 'HTTP 401: the API rejected the credentials.';
    if (err instanceof sdk.NotEnoughCreditsError) {
      return 'HTTP 403: the SDK reports this as not enough credits on the API balance. ' +
        'A network policy or proxy that blocks api.higgsfield.ai also gives a 403.';
    }
    if (err instanceof sdk.ValidationError || err instanceof sdk.BadInputError) {
      return `HTTP ${err.statusCode}: the API rejected the input: ${clip(err.details ?? err.message)}`;
    }
    if (err instanceof sdk.APIError) return `HTTP ${err.statusCode ?? '?'}: ${clip(err.message)} ${clip(err.responseData ?? '')}`;
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      return `${err.name}${code ? ` (${code})` : ''}: ${clip(err.message)}`;
    }
    return 'unknown error.';
  }

  const started = Date.now();
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  note(`submitting ${MODEL} (${INPUT.duration}s, ${INPUT.resolution}, ${INPUT.aspect_ratio}).`);

  let result: RequestStatus;
  try {
    result = (await sdk.higgsfield.subscribe(MODEL, { input: INPUT, withPolling: false })) as RequestStatus;
  } catch (err) {
    fail(`submit failed. ${describe(err)}`);
  }

  const id = result.request_id;
  if (!id) fail(`the API accepted the request but returned no request id: ${clip(result)}`);
  note(`request ${id} is ${result.status}.`);
  // After this point the job may run (and be billed) even if this process stops, so say how to find it.
  process.on('SIGINT', () => fail(`stopped waiting. Request ${id} may still finish; look it up on https://open.higgsfield.ai.`));

  const statusUrl = `${API}/requests/${encodeURIComponent(id)}/status`;
  let delay = 2_000;
  let last = result.status;
  let lastNote = Date.now();
  while (WAITING.has(result.status)) {
    if (Date.now() - started > MAX_WAIT_MS) {
      fail(`request ${id} is still ${result.status} after ${MAX_WAIT_MS / 60_000} minutes. It may still finish; look it up on https://open.higgsfield.ai.`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 500));
    delay = Math.min(delay * 1.5, 10_000);

    let res: Response;
    try {
      res = await fetch(statusUrl, {
        headers: { Authorization: `Key ${credentials}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      note(`status check failed (${cause ?? (err as Error).name}); trying again.`);
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      note(`status check got HTTP ${res.status}; trying again.`);
      continue;
    }
    if (!res.ok) {
      fail(`status check for request ${id} got HTTP ${res.status}: ${clip(await res.text().catch(() => ''))}`);
    }
    try {
      result = (await res.json()) as RequestStatus;
    } catch {
      note('status check returned a body that is not JSON; trying again.');
      continue;
    }
    if (result.status !== last || Date.now() - lastNote > 30_000) {
      note(`request ${id} is ${result.status} (${elapsed()}).`);
      last = result.status;
      lastNote = Date.now();
    }
  }

  const reason = result.error ? `: ${clip(result.error)}` : '.';
  switch (result.status) {
    case 'completed': {
      const url = result.video?.url;
      let ok = false;
      try { ok = typeof url === 'string' && new URL(url).protocol === 'https:'; } catch { /* not a URL */ }
      if (!ok) fail(`request ${id} completed but returned no usable video URL: ${clip(result.video ?? null)}`);
      settled = true;
      note(`request ${id} completed in ${elapsed()}.`);
      console.log(url);
      process.exitCode = 0;
      return;
    }
    case 'failed':
      fail(`request ${id} failed${reason}`);
    case 'nsfw':
      fail(`request ${id} was rejected by content moderation${reason}`);
    case 'canceled':
      fail(`request ${id} was canceled${reason}`);
    default:
      fail(`request ${id} ended with status "${clip(result.status)}"${reason}`);
  }
}

main().catch((err: unknown) => fail(`unexpected error: ${err instanceof Error ? `${err.name}: ${clip(err.message)}` : 'unknown'}`));
