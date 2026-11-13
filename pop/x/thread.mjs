// The dry-run thread. This is the page a recording shows. Nothing here is posted to X.
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function linkify(text) {
  return esc(text).replace(
    /https:\/\/testnet\.nearblocks\.io\/txns\/[1-9A-HJ-NP-Za-km-z]+|index\.html\?job=\d+|logo\.svg/g,
    (u) => `<a href="${u}">${u}</a>`,
  );
}

export function renderThread(posts, { bot = "payonproof" } = {}) {
  const items = posts.map((p) => {
    const who = p.who === "you" ? "you" : bot;
    const img = p.image ? `<img class="swatch" alt="Delivered swatch" src="${esc(p.image)}">` : "";
    return `<article class="${p.who === "you" ? "you" : "bot"}"><b>${esc(who)}</b><p>${linkify(p.text)}</p>${img}</article>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pay on Proof thread, dry run</title>
<style>
  body { margin: 0; background: #1c1914; color: #f4efe4; font: 16px/1.45 system-ui, sans-serif; }
  main { max-width: 28rem; margin: 0 auto; padding: 12px; }
  h1 { font-size: 1.15rem; margin: 0 0 8px; }
  .note { color: #d9c89a; margin: 0 0 12px; }
  article { border-radius: 14px; padding: 12px; margin: 0 0 10px; }
  article b { display: block; font-size: 0.8rem; margin-bottom: 4px; }
  article p { margin: 0; overflow-wrap: anywhere; }
  .you { background: #3a3428; margin-left: 18%; }
  .bot { background: #2a261e; margin-right: 8%; }
  a { color: #f0c14a; }
  img.swatch { display: block; width: 100%; max-width: 12rem; height: auto; margin-top: 8px; border-radius: 8px; }
</style>
</head>
<body>
<main>
<h1>Thread replay</h1>
<p class="note">Dry run. These are the replies the bot would post. Nothing was sent to X.</p>
${items}
</main>
</body>
</html>
`;
}
