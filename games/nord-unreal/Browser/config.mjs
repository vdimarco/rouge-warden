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

export function streamDimensions(touch, width, height, portrait, edge = 800) {
  if (!touch) return [1280, 720];
  const ratio = height / width;
  if (!portrait || !width || !height || ratio < 1.15) return [edge, edge * 9 / 16];
  return (ratio >= 16 / 9 ? [edge / ratio, edge] : [edge * 9 / 16, edge * 9 / 16 * ratio])
    .map(value => Math.round(value / 2) * 2);
}

export function receiverFps(stats, previous) {
  if (Number.isFinite(stats.framesPerSecond)) return stats.framesPerSecond;
  if (!previous || !Number.isFinite(stats.framesDecoded) || !Number.isFinite(previous.framesDecoded)
    || !(stats.timestamp > previous.timestamp) || stats.framesDecoded < previous.framesDecoded) return NaN;
  return (stats.framesDecoded - previous.framesDecoded) * 1000 / (stats.timestamp - previous.timestamp);
}

export function receiverLagging(stats, previous) {
  if (receiverFps(stats, previous) < 24) return true;
  if (!previous || !(stats.jitterBufferEmittedCount > previous.jitterBufferEmittedCount)) return false;
  return (stats.jitterBufferDelay - previous.jitterBufferDelay)
    / (stats.jitterBufferEmittedCount - previous.jitterBufferEmittedCount) > .12;
}
