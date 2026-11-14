import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { ed25519Ok, initMessage, sha256hex, verdictMessage } from "../lib/message.mjs";
import { open, seal } from "../lib/box.mjs";

test("verdict text matches the checker", () => {
  const delivery = sha256hex(Buffer.from("hello"));
  assert.equal(delivery, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  assert.equal(
    verdictMessage(7, delivery, "ab".repeat(32), true, "ok"),
    "pop-tee/v1\njob:7\ndelivery:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\ninput:abababababababababababababababababababababababababababababababab\npass:1\nreason:ok\n",
  );
  assert.equal(initMessage("cd".repeat(32)), "pop-tee/init\nbox:" + "cd".repeat(32) + "\n");
});

test("node verifies an ed25519 signature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" });
  const raw = Buffer.from(spki).subarray(12);
  const msg = Buffer.from(verdictMessage(1, "11".repeat(32), "22".repeat(32), false, "room cut off"));
  const sig = sign(null, msg, privateKey);
  assert.equal(ed25519Ok(msg, sig.toString("hex"), raw.toString("hex")), true);
  assert.equal(ed25519Ok(msg, "00".repeat(64), raw.toString("hex")), false);
});

test("box matches the checker vector", () => {
  const secret = Buffer.alloc(32, 7);
  const eph = Buffer.alloc(32, 9);
  const nonce = Buffer.alloc(24, 3);
  const pk = Buffer.from("13be4feaeaf204c7fd3358fc9c00721881d174278128227ec674f37f7fe97b6d", "hex");
  const blob = seal(pk, eph, nonce, Buffer.from("hello"));
  assert.equal(Buffer.from(blob).toString("hex"), "0157db4b359f23ae5e146e4e2512056704722506348c150c14753d0c933d04d421030303030303030303030303030303030303030303030303d508bf26629801c8a73f296a923a23c000af5302d6");
  assert.equal(Buffer.from(open(secret, blob)).toString(), "hello");
});
