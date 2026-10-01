// One deterministic timeline drives the camera, art and accessible transit UI.
// It depends on gameplay progress, so pausing also pauses every visual layer.
export const TRANSIT_DURATION = 6.6;
export const REDUCED_TRANSIT_DURATION = 1.1;
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
export const transitEase = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const between = (p, from, to) => transitEase((p - from) / (to - from));
const window = (p, from, full, fade, end) => between(p, from, full) * (1 - between(p, fade, end));

export function sampleTransit(progress = 0, reducedMotion = false) {
  const p = clamp(progress);
  if (reducedMotion) {
    const destination = p >= 0.5;
    return {
      progress: p, phase: destination ? 'arrival' : 'departure',
      visible: destination ? 'destination' : 'source',
      worldAlpha: destination ? between(p, 0.52, 0.96) : 1 - between(p, 0.04, 0.46),
      departure: 0, arrival: 1, galaxy: 0, horizon: 0, tunnel: 0,
      black: window(p, 0.04, 0.46, 0.52, 0.96), reducedMotion: true,
    };
  }
  const phase = p < 0.2 ? 'departure' : p < 0.4 ? 'galaxy' : p < 0.7 ? 'horizon' : p < 0.85 ? 'tunnel' : 'arrival';
  const visible = p < 0.22 ? 'source' : p >= 0.84 ? 'destination' : null;
  return {
    progress: p, phase, visible,
    worldAlpha: visible === 'source' ? 1 - between(p, 0.08, 0.22) : visible === 'destination' ? between(p, 0.84, 0.94) : 0,
    departure: between(p, 0, 0.22), arrival: between(p, 0.84, 0.985),
    galaxy: window(p, 0.10, 0.23, 0.36, 0.48),
    horizon: window(p, 0.30, 0.43, 0.70, 0.80),
    tunnel: window(p, 0.62, 0.73, 0.87, 0.98),
    black: 0, reducedMotion: false,
  };
}

// These positions form a spiral chart. They are deliberately unrelated to the
// engine's coordinate layout: systems represent distant places in one galaxy.
export function galaxyNode(index, count = 6) {
  const t = count > 1 ? index / (count - 1) : 0;
  const angle = -2.45 + t * 4.9;
  const radius = 0.28 + t * 0.58;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.66 };
}

export function visibleSectorIds(run, options = {}) {
  if (options.overview) return [];
  if (run.phase !== 'flight' || !run.flight) return [run.sectorIndex];
  const visible = sampleTransit(run.flight.progress, options.reducedMotion).visible;
  return visible === 'source' ? [run.flight.fromSector] : visible === 'destination' ? [run.flight.toSector] : [];
}
