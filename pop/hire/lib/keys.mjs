// Keys for the hire run. Git ignores pop/hire/.keys. Nothing here logs a secret.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEYDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".keys");

export function keyStore() {
  const file = path.join(KEYDIR, "testnet.json");
  const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
  return {
    file,
    get: (name) => read()[name],
    put(name, entry) {
      fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
      const all = read();
      all[name] = entry;
      fs.writeFileSync(file, JSON.stringify(all, null, 2), { mode: 0o600 });
    },
    all: read,
  };
}

const PROG = path.join(KEYDIR, "progress.json");
export function loadProgress() {
  return fs.existsSync(PROG) ? JSON.parse(fs.readFileSync(PROG, "utf8")) : {};
}
export function saveProgress(p) {
  fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PROG, JSON.stringify(p, null, 2), { mode: 0o600 });
}
