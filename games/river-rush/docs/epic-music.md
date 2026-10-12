# River Rush adventure score

An original instrumental orchestral cue accompanies active runs. The score uses driving percussion, strings and a heroic melody at 144 BPM, with a gradually fuller mix as the four river acts intensify and during Rush. Existing action cues and river ambience share the mute control.

The score starts on Start/Resume rather than autoplaying on the title screen. The player's sound preference is saved locally in `river-rush-sound-enabled`. Pause, menu, completion and a hidden page silence playback; showing the tab leaves the run paused until Resume. Retry reuses one streaming player and AudioContext. A missing or blocked track leaves the game and effects available.

The locally hosted `audio/river-rush-adventure.mp3` is a 93.333-second, 56-bar loop, encoded at 128 kbps stereo and about 1.49 MB. Four bars overlap at a matching beat phase; fixed gain preserves dynamics. Exported loudness is −18.44 LUFS with −5.70 dB true peak. The MP3's gapless metadata preserves exactly 4,480,000 decoded stereo sample frames. Numerical seam and loudness checks are recorded in `epic-music-measurements.json`; they do not establish a subjective listening verdict.

Generation uses fal endpoint `elevenlabs/music/v2.5`, request `01a117c1-75ab-7091-b3c5-0be2ae2d14ed`. Its verified schema supports guaranteed instrumental output and explicit duration. Inputs, source URL and checked generation pricing are in `epic-music-source.json`. The generated original is retained outside the public build; gameplay uses the processed local asset without a provider-CDN dependency. Reproduce preparation with Python/numpy/ffmpeg using `scripts/prepare-music.py` and the recorded original checksum.

This release also restores Redstone rock continuity. A resolved crossing does not destroy a physical obstacle: a dodged rock or jumped log passes beside/under the raft and retires at the existing 16 m boundary behind the raft, beyond the near viewport. Only shield/Rush impacts mark the contacted obstacle destroyed, independently of short feedback effects. The same rule applies in 3D and fallback. Canyon mesas retain their solid course-anchored shape as the raft approaches rather than shrinking away in front of it.

Verification and release receipts are recorded in the completed OpenSpec change. Physical phone speakers, Safari and audio hardware are not measured by the software-browser checks.
