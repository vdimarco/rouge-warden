// Pairing links shared by the Node relay and the Cloudflare worker.
// wristagent://pair?u=<relay>&k=<token> opens the phone app. The /pair page redirects there.

export function deepLink(relayUrl, token) {
  return `wristagent://pair?u=${encodeURIComponent(relayUrl)}&k=${encodeURIComponent(token)}`;
}

export function pairPageUrl(pageBase, relayUrl, token) {
  const base = String(pageBase || "").replace(/\/+$/, "");
  return `${base}/pair?u=${encodeURIComponent(relayUrl)}&k=${encodeURIComponent(token)}`;
}

export function pairPage(link) {
  const href = String(link).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pair Wrist Agent</title>
<meta http-equiv="refresh" content="0;url=${href}">
</head>
<body>
<p><a href="${href}">Open the Wrist Agent phone app</a></p>
<script>location.replace(${JSON.stringify(String(link))})</script>
</body>
</html>
`;
}

export function isPrivateIPv4(host) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(host || ""));
  if (!match) return false;
  const nums = match.slice(1).map(Number);
  if (nums.some((n) => n > 255)) return false;
  const [a, b] = nums;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function isRelayBase(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol !== "http:") return false;
  const host = parsed.hostname;
  return host === "localhost" || isPrivateIPv4(host);
}
