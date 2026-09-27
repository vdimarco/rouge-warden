# Higgsfield API tools

Server-side tools that call the Higgsfield API. Nothing here ships with the game site.
All Higgsfield generation for this project goes through these tools and the API key,
not through the Higgsfield app or its MCP connector.

## Set up

1. Make an API key at https://open.higgsfield.ai. Copy it in the form `key-id:key-secret`.
2. In this folder, copy `.env.example` to `.env.local`. Put the key after `HF_CREDENTIALS=`.
   Git ignores `.env.local`. Do not put the key anywhere else.
3. Run `npm install`.

## Commands

- `npm run models [-- <filter>]` lists the API's models (free). The API makes images and video only.
  It has no 3D models.
- `npm run gen -- <model> <input JSON or @file.json> [--out <dir>] [--name <base>] [--wait <minutes>]`
  runs one model once. It prints each output URL on stdout and, with `--out`, saves the files.
  Under a key that ends in `url` or `urls`, a value `"@path/to/file.png"` is uploaded first
  (JPEG, PNG, WebP, GIF, WAV or MP4). Each run is a paid generation.
- `npm run example` sends one Seedance 2.5 text-to-video request ("A cinematic scene at sunset",
  5 s, 720p, 16:9) and prints the video URL.
- `npm run typecheck` checks the TypeScript.

Example:

```sh
npm run gen -- alibaba/qwen-image-3/edit \
  '{"prompt":"ink drawing","image_urls":["@../scratch/concept.png"],"resolution":"1k"}' \
  --out out --name ink
```

## How a run behaves

- Progress and errors go to stderr. Output URLs go to stdout. They stay valid for at least 7 days.
- The exit code is 0 only when the request completes with an output. A failed, moderated (`nsfw`)
  or canceled request, or a timeout, exits 1 and names the request id.
- The request is sent once. The SDK's own retries are off, so an error cannot start a second paid job.
- The key goes only to api.higgsfield.ai. Uploads and downloads use the storage URLs without it.
  No message prints it, even with `DEBUG` set.
- Model inputs are on each model's page: `https://open.higgsfield.ai/models/<model>/api-reference`.
