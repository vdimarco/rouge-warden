// Riftwalk: seal a private world with a password.
//
//   RIFTWALK_PASSWORD='…' node qa/lab/riftwalk-seal.mjs <world id> <folder with 150k.spz 500k.spz full.spz>
//
// Each .spz file is encrypted with AES-GCM (256-bit key). The key comes from the password through PBKDF2 with
// SHA-256 and a new random salt. Each file is written as public/lab/riftwalk/worlds/private/<id>/<size>.bin: a
// 12-byte IV, then the ciphertext and its tag. The world's screens.json gets a `lock` record: the salt, the PBKDF2
// iteration count and `check`, a short known text sealed with the same key, so the page can tell a wrong password
// at once without a download. The password is never written anywhere: it comes from the environment only.
// The page (main.js) opens the files with the browser's Web Crypto API, with the same steps in reverse.
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [id, from] = process.argv.slice(2), password = process.env.RIFTWALK_PASSWORD;
if (!id || !from || !password) { console.error('usage: RIFTWALK_PASSWORD=… node qa/lab/riftwalk-seal.mjs <world id> <folder>'); process.exit(2); }
if (password.length < 10) { console.error('Use a password of 10 characters or more.'); process.exit(2); }

export const ITERATIONS = 600000, CHECK = 'riftwalk private world';
const out = join(ROOT, 'public/lab/riftwalk/worlds/private', id); mkdirSync(out, { recursive: true });
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
async function seal(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const all = new Uint8Array(12 + body.length); all.set(iv); all.set(body, 12); return all;
}
const b64 = bytes => Buffer.from(bytes).toString('base64');
for (const size of ['150k', '500k', 'full']) {
  const file = join(from, size + '.spz'); if (!existsSync(file)) { console.error('Missing ' + file); process.exit(1); }
  const sealed = await seal(readFileSync(file)); writeFileSync(join(out, size + '.bin'), sealed); console.log(size, sealed.length, 'bytes');
}
const data = join(out, 'screens.json'), world = existsSync(data) ? JSON.parse(readFileSync(data, 'utf8')) : {};
world.lock = { kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), check: b64(await seal(new TextEncoder().encode(CHECK))) };
writeFileSync(data, JSON.stringify(world, null, 1) + '\n');
console.log('Sealed', id, 'in', out);
