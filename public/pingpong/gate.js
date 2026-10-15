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
