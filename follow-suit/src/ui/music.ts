import { CONFIG } from '../config';

/** The pitch of a step on the major scale. Step 0 is the root, step 7 the root an octave up. */
export function scaleStepHz(step: number, rootHz: number = CONFIG.sound.rootHz): number {
  const scale = CONFIG.sound.majorScale;
  const octave = Math.floor(step / scale.length);
  const semitones = scale[step - octave * scale.length] + 12 * octave;
  return rootHz * 2 ** (semitones / 12);
}
