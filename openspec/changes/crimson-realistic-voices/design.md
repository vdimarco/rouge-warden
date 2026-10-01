# Design

Generate performances with elevenlabs/tts/eleven-v4 via Fal using stock voices and stable per-character casting. Keep the original script and subtitle text. Use restrained delivery tags for danger and reassurance. Store MP3s in audio/dialogue/realistic with a speaker-and-text manifest, durations and generation provenance. Mix group replies from three recorded crew voices.

Load a manifest once; decode only current scene lines or requested conversation lines. Cache by source URL and deduplicate pending loads. Bound network requests to 15 seconds. Resolve pick/hero to the selected crew ID before looking up audio. Never reuse another actor's clip because the words match.

Voice handles remain pending while loading, so subtitles and cinematic scheduling wait. Cancellation prevents late playback. Drive mouth energy and timing from the decoded recording. Reduce the score during dialogue. A tap that reveals modal text leaves speech playing; advancing to another line stops it.

