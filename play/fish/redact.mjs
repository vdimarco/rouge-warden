// Hides the key passwords in the text that Bubblewrap prints. When a signing step fails, Bubblewrap prints the whole command,
// and the command holds both passwords. build-aab.sh pipes the output of `bubblewrap build` through this file:
//   bubblewrap build ... 2>&1 | node play/fish/redact.mjs
// It reads BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD from the environment, as Bubblewrap does, and writes the text
// with each password replaced by ********. It writes text as it arrives, so a long build still shows its progress. It holds back only
// the end of the text that could be the start of a password. It exits with 0: the exit status of Bubblewrap comes from the pipe (pipefail).
import { fileURLToPath } from "url";
import path from "path";

export const MASK = "********";
export const NAMES = ["BUBBLEWRAP_KEYSTORE_PASSWORD", "BUBBLEWRAP_KEY_PASSWORD"];

// secrets: the values to hide (an empty or missing value hides nothing).
// Returns { push(text) -> the text that is safe to print now, end() -> the text that was held back }.
export function redactor(secrets) {
  // the longest first, so a password that holds another one is hidden as a whole
  const list = [...new Set(secrets.filter((s) => typeof s === "string" && s.length > 0))].sort((a, b) => b.length - a.length);
  let held = "";
  // split and join, not a regular expression: a password can hold . * [ ( \ and so on
  const hide = (text) => list.reduce((t, v) => t.split(v).join(MASK), text);
  // how many characters at the end of text are the start of a password, and so could continue in the next chunk
  const pending = (text) => {
    let n = 0;
    for (const v of list) for (let k = Math.min(v.length - 1, text.length); k > n; k--) if (text.endsWith(v.slice(0, k))) { n = k; break; }
    return n;
  };
  return {
    push(chunk) {
      const text = hide(held + chunk), n = pending(text);
      held = text.slice(text.length - n);
      return text.slice(0, text.length - n);
    },
    end() {
      const text = hide(held);
      held = "";
      return text;
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = redactor(NAMES.map((n) => process.env[n]));
  // a closed output (the terminal went away) is not an error of this filter
  process.stdout.on("error", () => process.exit(0));
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => process.stdout.write(r.push(chunk)));
  process.stdin.on("end", () => process.stdout.write(r.end()));
}
