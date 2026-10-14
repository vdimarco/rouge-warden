These three cues are original deterministic procedural synthesis from
`Scripts/create_feedback_audio.py`, using only Python's standard library.
They contain no downloaded audio, recordings, samples, speech, or Argon media.

- `Checkpoint.wav`: 0.34-second soft ascending pair for objective/race progress.
- `Complete.wav`: 0.68-second soft ascending triad for a finished encounter/lap.
- `Dialogue.wav`: 0.075-second warm tick for a brief resident interaction.

All are mono 16-bit PCM at 24,000 Hz, nonlooping, with a short cosine attack and
release, and a peak below -12 dBFS. Gameplay supplies the audible event; captions
and progress remain the visual alternative. These cues are not recorded voices.

Regenerate from the game root:

```bash
python3 Scripts/create_feedback_audio.py
python3 Scripts/test_feedback_audio.py
```

Import in a fresh offline process, after any prior authoring process exits:

```bash
/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor-Cmd \
  "$PWD/Quebec.uproject" -NullRHI -unattended -nop4 \
  -run=PythonScript -script="$PWD/Scripts/import_feedback_audio.py"
```

The importer accepts only the NullRHI Python commandlet. It validates all sources
before mutation, imports/saves exactly `/Game/Audio/Feedback/Checkpoint`,
`/Game/Audio/Feedback/Complete`, and `/Game/Audio/Feedback/Dialogue` as SoundWaves,
and never opens, modifies, or saves a map. Reimport replaces only these owned cues.
