# Pixel Watch voice

Add a standalone Wear OS app for a Google Pixel Watch 3 and a companion Android phone app. The watch captures speech and speaks replies. The phone turns speech into text and talks to one relay. The relay, on the existing call server, routes each turn to a pluggable agent and to a shared memory store.

The Fitbit and Twilio path stays as it is.

Out of scope: shipping a Vosk model inside the APK, claiming a measured on-wrist latency, and pointing memory at a person's existing store. The default store is a JSONL file under `voice/memory/`.
