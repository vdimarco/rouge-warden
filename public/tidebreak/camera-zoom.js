export const MIN_ZOOM = 1, MAX_ZOOM = 2.4;
export function clampZoom(value) { return Number.isFinite(value) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) : MIN_ZOOM; }
// WheelEvent modes: CSS pixels, text lines, viewport pages. Trackpad pinch also emits wheel.
export function wheelZoomFactor(event, height) {
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
  return Math.exp(Math.max(-240, Math.min(240, pixels)) * .0015);
}
