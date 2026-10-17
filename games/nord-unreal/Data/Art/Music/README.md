# NORD music loops

Two stereo 48kHz PCM16 tracks derive from the pinned local ACE-Step 1.5 auditions. `NeighborhoodLoop.wav` is 20 seconds; `RaceLoop.wav` is approximately 14.545 seconds. Their original prompts describe a 1970s Montréal instrument palette without named artist imitation or source recordings. The MIT source/model license and exact prompts, seeds, model/source pins, original/derived hashes and settings are retained in `provenance.json` and `ACE-Step-LICENSE`.

Each loop starts after one nominal bar and lasts eight nominal bars at the requested BPM (96 or 132). These are nominal bars, not verified beats. The final 150ms crossfades into original pre-roll with complementary raised-cosine weights, so the wrap returns to adjacent samples from the original recording. The full 25-second auditions and reproducible derivation script remain locally under `Saved/ToolTrials/ACE-Step/LoopAssessment`.

Listening has not verified musical quality, harmonic/beat alignment, absence of vocals or originality. Waveform checks establish PCM structure, retained provenance, unclipped output and wrap continuity only.

`Scripts/import_music.py` imports only these two files into `/Game/Audio/Music` in a fresh `-NullRHI -run=PythonScript` commandlet, verifies every input before mutation, sets looping and saves the two SoundWaves. The controller hard references both assets for cooking and chooses quiet, non-spatial music locally from the replicated campaign phase. Existing feedback cues and browser master mute remain separate.

CPU checks:

```bash
python3 Scripts/test_music.py
```
