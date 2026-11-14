// The text the TEE signs. The contract in contract/src/lib.rs builds the same strings.
import { createHash, createPublicKey, verify } from "node:crypto";

export function sha256hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function verdictMessage(job, deliveryHex, inputHex, pass, reason) {
  if (!/^[0-9a-f]{64}$/.test(deliveryHex) || !/^[0-9a-f]{64}$/.test(inputHex)) throw new Error("hash");
  if (typeof reason !== "string" || reason.length > 180 || /[\r\n]/.test(reason)) throw new Error("reason");
  const bit = pass ? 1 : 0;
  return `pop-tee/v1\njob:${job}\ndelivery:${deliveryHex}\ninput:${inputHex}\npass:${bit}\nreason:${reason}\n`;
}

export function initMessage(boxHex) {
  if (!/^[0-9a-f]{64}$/.test(boxHex)) throw new Error("box key");
  return `pop-tee/init\nbox:${boxHex}\n`;
}

// RFC 8032. Node has no raw ed25519 key import, so this wraps the 32 bytes as an SPKI key.
export function ed25519Ok(message, signatureHex, publicHex) {
  if (!/^[0-9a-f]{128}$/.test(signatureHex) || !/^[0-9a-f]{64}$/.test(publicHex)) return false;
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicHex, "hex")]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  return verify(null, Buffer.from(message), key, Buffer.from(signatureHex, "hex"));
}
