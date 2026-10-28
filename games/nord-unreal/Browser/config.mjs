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

export function streamDimensions(touch, width, height, portrait, edge = 960) {
  if (!touch) return [1280, 720];
  if (!portrait || !width || !height) return [edge, edge * 9 / 16];
  const ratio = height / width;
  // Give both orientations the same pixel budget, without stretching a 16:9 frame.
  const pixels = edge * edge * 9 / 16;
  return [Math.sqrt(pixels / ratio), Math.sqrt(pixels * ratio)]
    .map(value => Math.floor(value / 2) * 2);
}

export function receiverFps(stats, previous) {
  if (Number.isFinite(stats.framesPerSecond)) return stats.framesPerSecond;
  if (!previous || !Number.isFinite(stats.framesDecoded) || !Number.isFinite(previous.framesDecoded)
    || !(stats.timestamp > previous.timestamp) || stats.framesDecoded < previous.framesDecoded) return NaN;
  return (stats.framesDecoded - previous.framesDecoded) * 1000 / (stats.timestamp - previous.timestamp);
}

export function receiverLagging(stats, previous) {
  if (receiverFps(stats, previous) < 29) return true;
  if (!previous || !(stats.jitterBufferEmittedCount > previous.jitterBufferEmittedCount)) return false;
  return (stats.jitterBufferDelay - previous.jitterBufferDelay)
    / (stats.jitterBufferEmittedCount - previous.jitterBufferEmittedCount) > .12;
}

const phoneProfiles = [{ edge: 1280, bitrate: 6000 }, { edge: 960, bitrate: 2000 }, { edge: 800, bitrate: 1500 }, { edge: 640, bitrate: 1000 }];

// A QA build (NORD_QA_PIN) holds one phone rung from ?pin=0-3 for a whole gauntlet sample; production ignores the query.
export function pinnedLevel(search, qaBuild) {
  const pin = qaBuild ? new URLSearchParams(search).get('pin') : null;
  return /^\d$/.test(pin) && Number(pin) < phoneProfiles.length ? Number(pin) : null;
}

export function phoneStreamState(now, pinned = null) {
  const level = pinned ?? 1;
  return { ...phoneProfiles[level], level, changedAt: now, poor: 0, healthy: 0, critical: 0 };
}

export function adaptPhoneStream(state, video, now) {
  const previous = state.previous;
  state.previous = { ...video };
  if (now - state.changedAt < 5000) {
    state.poor = state.healthy = state.critical = 0;
    return false;
  }
  const poor = video.freezeCount > previous?.freezeCount || receiverLagging(video, previous);
  state.poor = poor ? state.poor + 1 : 0;
  state.critical = receiverFps(video, previous) < 12 ? state.critical + 1 : 0;
  // Require headroom above 30 FPS before restoring a more demanding profile.
  state.healthy = !poor && receiverFps(video, previous) >= 35 ? state.healthy + 1 : 0;
  if ((state.poor >= 5 || state.critical >= 2) && state.level < phoneProfiles.length - 1) state.level++;
  else if (state.healthy >= 15 && state.level > 0) state.level--;
  else return false;
  Object.assign(state, phoneProfiles[state.level]);
  state.changedAt = now;
  state.poor = state.healthy = state.critical = 0;
  return true;
}
