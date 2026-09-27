// Shared Higgsfield API code for the scripts in this folder (server-side only).
//
// - The credential is HF_CREDENTIALS="key-id:key-secret", from .env.local next to this file or the environment.
//   It is only ever sent to api.higgsfield.ai, and no message prints it.
// - run() sends a request once with the SDK's subscribe(), then polls the status endpoint itself,
//   because SDK 0.2.6 stops waiting on one failed status check and keeps polling a canceled request.
// - upload() puts a local file on Higgsfield's storage and gives back a URL for a model input.
// - A script exits 0 only when it calls done(); anything else, even a silent early end, exits 1.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { V2Response } from '@higgsfield/client/v2';

export const API = 'https://api.higgsfield.ai';
const WAITING = new Set(['queued', 'in_progress']);

// The status endpoint also returns "canceled", "error" and outputs that the SDK's V2Response type does not list.
export type RequestStatus = Omit<V2Response, 'status'> & { status: string; error?: string; [key: string]: unknown };

process.exitCode = 1;
let settled = false;
process.on('beforeExit', () => {
  if (!settled) fail('the request never settled (the connection closed before a response).');
});

// .env.local sits next to this file and never leaves the machine. Values already in the environment win.
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
export function redact(text: string): string {
  let out = text;
  for (const secret of [credentials, ...credentials.split(':')]) {
    if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out;
}
// Redact first, then shorten, so a cut can never split a secret.
export const clip = (value: unknown): string => redact(typeof value === 'string' ? value : JSON.stringify(value) ?? '').slice(0, 800);

export function note(message: string): void {
  console.error(`Higgsfield: ${redact(message)}`);
}
export function fail(message: string): never {
  settled = true;
  console.error(`Higgsfield: ${redact(message)}`);
  process.exit(1);
}
// The script's work is done: exit 0 when the event loop ends.
export function done(): void {
  settled = true;
  process.exitCode = 0;
}

function authHeaders(): Record<string, string> {
  if (!credentials) fail('HF_CREDENTIALS is not set. Put HF_CREDENTIALS="key-id:key-secret" in higgsfield/.env.local.');
  if (credentials.split(':').length !== 2 || credentials.split(':').some((part) => !part)) {
    fail('HF_CREDENTIALS must have the form "key-id:key-secret" (one colon).');
  }
  return { Authorization: `Key ${credentials}` };
}

// GET or POST JSON on api.higgsfield.ai. Never used for any other host.
export async function api(path: string, body?: unknown): Promise<Response> {
  return fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...authHeaders(), Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.wav': 'audio/wav', '.mp4': 'video/mp4',
};

// Put a local file on Higgsfield's storage and return the public URL to pass as image_url, video_url or audio_url.
// The credential goes to api.higgsfield.ai only, never to the storage URL.
export async function upload(path: string): Promise<string> {
  const type = TYPES[extname(path).toLowerCase()];
  if (!type) fail(`cannot upload ${basename(path)}: use JPEG, PNG, WebP, GIF, WAV or MP4.`);
  const bytes = await readFile(path).catch(() => fail(`cannot read ${path}.`));
  const res = await api('/files/generate-upload-url', { content_type: type });
  if (!res.ok) fail(`upload URL for ${basename(path)} got HTTP ${res.status}: ${clip(await res.text().catch(() => ''))}`);
  const u = (await res.json()) as { upload_url?: string; public_url?: string; upload_headers?: Record<string, string> };
  if (!u.upload_url || !u.public_url) fail(`upload URL for ${basename(path)}: unexpected answer ${clip(u)}`);
  const put = await fetch(u.upload_url, {
    method: 'PUT',
    headers: { ...(u.upload_headers ?? {}), 'Content-Type': type, 'x-amz-tagging': 'retention=temporary' },
    body: bytes,
    signal: AbortSignal.timeout(300_000),
  });
  if (!put.ok) fail(`upload of ${basename(path)} got HTTP ${put.status}.`);
  note(`uploaded ${basename(path)} (${(bytes.length / 1e6).toFixed(2)} MB).`);
  return u.public_url;
}

// Send one request and wait for its final status. Returns only a completed request; every other end fails.
export async function run(model: string, input: Record<string, unknown>, { maxWaitMs = 20 * 60_000 } = {}): Promise<RequestStatus> {
  authHeaders();
  // With DEBUG set, a module under the SDK prints request headers, and the key with them.
  // It reads DEBUG when it loads, so clear it before the SDK loads.
  delete process.env.DEBUG;
  const sdk = await import('@higgsfield/client/v2');
  // One submit only: the SDK would otherwise re-send the paid request up to 3 more times after an error.
  sdk.config({ credentials, maxRetries: 0 });

  // Never print a raw error object: an HTTP client error carries the request headers, and the key with them.
  const describe = (err: unknown): string => {
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
  };

  const started = Date.now();
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  note(`submitting ${model}.`);
  let result: RequestStatus;
  try {
    result = (await sdk.higgsfield.subscribe(model, { input, withPolling: false })) as RequestStatus;
  } catch (err) {
    fail(`submit failed. ${describe(err)}`);
  }
  const id = result.request_id;
  if (!id) fail(`the API accepted the request but returned no request id: ${clip(result)}`);
  note(`request ${id} is ${result.status}.`);
  // After this point the job may run (and be billed) even if this process stops, so say how to find it.
  const onInt = () => fail(`stopped waiting. Request ${id} may still finish; look it up on https://open.higgsfield.ai.`);
  process.on('SIGINT', onInt);

  const statusPath = `/requests/${encodeURIComponent(id)}/status`;
  let delay = 2_000, last = result.status, lastNote = Date.now();
  while (WAITING.has(result.status)) {
    if (Date.now() - started > maxWaitMs) {
      fail(`request ${id} is still ${result.status} after ${Math.round(maxWaitMs / 60_000)} minutes. It may still finish; look it up on https://open.higgsfield.ai.`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 500));
    delay = Math.min(delay * 1.5, 10_000);
    let res: Response;
    try {
      res = await api(statusPath);
    } catch (err) {
      note(`status check failed (${(err as { cause?: { code?: string } }).cause?.code ?? (err as Error).name}); trying again.`);
      continue;
    }
    if (res.status >= 500 || res.status === 429) { note(`status check got HTTP ${res.status}; trying again.`); continue; }
    if (!res.ok) fail(`status check for request ${id} got HTTP ${res.status}: ${clip(await res.text().catch(() => ''))}`);
    try {
      result = (await res.json()) as RequestStatus;
    } catch {
      note('status check returned a body that is not JSON; trying again.');
      continue;
    }
    if (result.status !== last || Date.now() - lastNote > 30_000) {
      note(`request ${id} is ${result.status} (${elapsed()}).`);
      last = result.status; lastNote = Date.now();
    }
  }
  process.off('SIGINT', onInt);

  const reason = result.error ? `: ${clip(result.error)}` : '.';
  if (result.status === 'completed') { note(`request ${id} completed in ${elapsed()}.`); return result; }
  if (result.status === 'failed') fail(`request ${id} failed${reason}`);
  if (result.status === 'nsfw') fail(`request ${id} was rejected by content moderation${reason}`);
  if (result.status === 'canceled') fail(`request ${id} was canceled${reason}`);
  fail(`request ${id} ended with status "${clip(result.status)}"${reason}`);
}

const isHttps = (u: unknown): u is string => {
  try { return typeof u === 'string' && new URL(u).protocol === 'https:'; } catch { return false; }
};

// Every output URL of a completed request: images, video, audio, audios and any other { url } artifact.
export function outputs(result: RequestStatus): { kind: string; url: string }[] {
  const out: { kind: string; url: string }[] = [];
  for (const [key, value] of Object.entries(result)) {
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) {
      const url = item && typeof item === 'object' ? (item as { url?: unknown }).url : undefined;
      if (isHttps(url)) out.push({ kind: key, url });
    }
  }
  return out;
}

// Save an output file. The credential is never sent to the file's host.
export async function download(url: string, dir: string, name: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok) fail(`download of ${name} got HTTP ${res.status}.`);
  await mkdir(dir, { recursive: true });
  const ext = extname(new URL(url).pathname) || '';
  const path = join(dir, name + ext);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}
