// npm does not link a package's own bin. This puts `wrist-relay` on PATH for `npx wrist-relay`.
import { chmodSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const binDir = join(root, "node_modules", ".bin");
mkdirSync(binDir, { recursive: true });
const dest = join(binDir, "wrist-relay");
try {
  unlinkSync(dest);
} catch {
  // first install
}
symlinkSync(join(root, "wrist-relay.mjs"), dest);
chmodSync(join(root, "wrist-relay.mjs"), 0o755);
