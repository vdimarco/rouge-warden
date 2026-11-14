// X25519 + XChaCha20-Poly1305 box. Same bytes as pop/tee/checker seal/open.
import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "node:crypto";

function shared(secret, peer) {
  const s = x25519.getSharedSecret(secret, peer);
  if (s.every((b) => b === 0)) throw new Error("shared secret");
  return s;
}

export function seal(recipient, ephemeralSecret, nonce, plaintext) {
  const ct = xchacha20poly1305(shared(ephemeralSecret, recipient), nonce).encrypt(plaintext);
  const epk = x25519.getPublicKey(ephemeralSecret);
  const out = new Uint8Array(1 + 32 + 24 + ct.length);
  out[0] = 1;
  out.set(epk, 1);
  out.set(nonce, 33);
  out.set(ct, 57);
  return out;
}

export function open(secret, blob) {
  if (blob.length < 73 || blob[0] !== 1) throw new Error("bad box");
  const epk = blob.slice(1, 33);
  const nonce = blob.slice(33, 57);
  const ct = blob.slice(57);
  return xchacha20poly1305(shared(secret, epk), nonce).decrypt(ct);
}

// A fresh box for `boxPk` hex. The plaintext never includes a key.
export function sealDelivery(boxPkHex, plaintext) {
  const pk = Buffer.from(boxPkHex, "hex");
  if (pk.length !== 32) throw new Error("box key");
  const blob = seal(pk, randomBytes(32), randomBytes(24), Buffer.from(plaintext));
  return Buffer.from(blob).toString("base64");
}
