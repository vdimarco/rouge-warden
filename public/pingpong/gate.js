// The gate tap must call permission and audio resume in one turn, before any wait.
// Same order as Lawn Tennis: motion, orientation, then the audio context.

export function unlockCourt(env) {
  const asked = {};
  const motion = env && env.DeviceMotionEvent;
  const orient = env && env.DeviceOrientationEvent;
  if (motion && typeof motion.requestPermission === 'function') {
    asked.motion = motion.requestPermission();
  }
  if (orient && typeof orient.requestPermission === 'function') {
    asked.orient = orient.requestPermission();
  }
  const AudioContext = env && (env.AudioContext || env.webkitAudioContext);
  let audio = (env && env.audio) || null;
  if (!audio && typeof AudioContext === 'function') audio = new AudioContext();
  let resume = null;
  if (audio && typeof audio.resume === 'function') resume = audio.resume();
  return { asked, audio, resume };
}

// A fine pointer is a mouse or trackpad. A coarse touch phone keeps the tilt path,
// even when this browser has no motion API, so the existing swipe fallback still runs.
export function desktopCourt(env) {
  const match = (query) => {
    try {
      const media = env && typeof env.matchMedia === 'function' ? env.matchMedia(query) : null;
      return !!(media && media.matches);
    } catch (err) {
      return false;
    }
  };
  if (match('(pointer: fine)')) return true;
  if (match('(pointer: coarse)') || match('(any-pointer: coarse)')) return false;
  const touches = Number(env && env.navigator && env.navigator.maxTouchPoints) || 0;
  if (touches > 0) return false;
  const motion = env && env.DeviceMotionEvent;
  const hasMotion = typeof motion === 'function' || !!(motion && typeof motion.requestPermission === 'function');
  return !hasMotion;
}
