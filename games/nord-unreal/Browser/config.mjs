const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function signallingUrl(value, pageHostname) {
  if (!value?.trim()) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('The game connection address is invalid.');
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error('The game connection address must not contain credentials, query parameters or a fragment.');
  }
  const local = loopbackHosts.has(pageHostname) && loopbackHosts.has(url.hostname);
  if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && local)) {
    throw new Error('The game connection requires a secure WSS address.');
  }
  return url.href;
}
