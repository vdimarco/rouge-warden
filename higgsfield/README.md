# Higgsfield API tools

Server-side tools that call the Higgsfield API. Nothing here ships with the game site.

## Set up

1. Make an API key at https://open.higgsfield.ai. Copy it in the form `key-id:key-secret`.
2. In this folder, copy `.env.example` to `.env.local`. Put the key after `HF_CREDENTIALS=`.
   Git ignores `.env.local`. Do not put the key anywhere else.
3. Run `npm install`.

## Seedance 2.5 example

`npm run example` sends one text-to-video request to `bytedance/seedance-2.5/text-to-video`:
"A cinematic scene at sunset", 5 s, 720p, 16:9. Each run is a paid generation.

- Progress goes to stderr. The video URL goes to stdout. The URL stays valid for at least 7 days.
- The exit code is 0 only when the request completes with a video URL. A failed, moderated (`nsfw`)
  or canceled request, or a timeout after 20 minutes, exits 1 with the request id.
- The request is sent once. The SDK's own retries are off, so an error cannot start a second paid job.
- `npm run typecheck` checks the TypeScript.
