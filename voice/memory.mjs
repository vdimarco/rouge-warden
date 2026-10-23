// Shared memory for every watch-relay agent.
//
// MemoryStore:
//   recall(query, limit) -> [{ at, kind, day, text }]
//   remember({ text, kind, day }) -> the stored fact
//
// The default file is voice/memory/facts.jsonl, one JSON object per line.
// Set MEMORY_PATH to a .jsonl file to use a different store. This file does not
// migrate another product's schema. Point MEMORY_PATH at a file that already
// uses this line shape, or leave the default and copy facts in yourself.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultMemoryFile = fileURLToPath(new URL("./memory/facts.jsonl", import.meta.url));

const STOP = new Set([
  "the", "and", "for", "you", "your", "with", "that", "this", "from", "have",
  "was", "are", "what", "when", "user", "said", "answer", "reply", "about",
]);

export function memoryFile(env = process.env, fallback = defaultMemoryFile) {
  const set = env.MEMORY_PATH && String(env.MEMORY_PATH).trim();
  return set || fallback;
}

export function tokens(text) {
  const found = String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  return found.filter((word) => word.length >= 4 && !STOP.has(word));
}

export function scoreFact(queryTokens, fact) {
  const words = new Set(tokens(fact.text));
  let score = 0;
  for (const word of queryTokens) if (words.has(word)) score += 1;
  return score;
}

export function readFacts(file) {
  if (!existsSync(file)) return [];
  const facts = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const fact = JSON.parse(line);
      if (fact && typeof fact.text === "string" && fact.text.trim()) facts.push(fact);
    } catch { /* torn line */ }
  }
  return facts;
}

export function createMemory({ file, now = () => Date.now() } = {}) {
  const path = file || defaultMemoryFile;
  return {
    path,
    recall(query, limit = 6) {
      const queryTokens = tokens(query);
      if (!queryTokens.length) return [];
      return readFacts(path)
        .map((fact) => ({ fact, score: scoreFact(queryTokens, fact) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || String(b.fact.at).localeCompare(String(a.fact.at)))
        .slice(0, limit)
        .map((row) => row.fact);
    },
    remember({ text, kind = "talk", day = "" }) {
      const fact = {
        at: new Date(now()).toISOString(),
        kind: String(kind || "talk"),
        day: String(day || ""),
        text: String(text || "").replace(/\s+/g, " ").trim().slice(0, 500),
      };
      if (!fact.text) return null;
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, JSON.stringify(fact) + "\n");
      return fact;
    },
  };
}

// Leaves instructions unchanged when there is nothing relevant to add.
export function withFacts(instructions, facts) {
  if (!facts || !facts.length) return instructions;
  const lines = facts.map((fact) => "- " + String(fact.text).replace(/\s+/g, " ").trim()).join("\n");
  return instructions + "\n\nFacts you already know:\n" + lines;
}
