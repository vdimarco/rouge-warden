# Hermes phone

Android companion for the Pixel Watch app. The watch captures audio. This app transcribes it with Vosk and streams the reply from the relay.

Setup, the relay key, agents, memory, and install commands are in `wear/README.md`. The adapter interface is `voice/adapters.md`.

Build from the watch project, which includes this module:

```sh
cd wear && ./gradlew :phone-app:assembleDebug
```
