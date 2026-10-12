# Higgsfield API tools

Server-side tools that call the Higgsfield API, and the local art steps around them. Nothing here ships with the game site.
All Higgsfield generation for this project goes through these tools and the API key,
not through the Higgsfield app or its MCP connector.

## Set up

1. Make an API key at https://open.higgsfield.ai. Copy it in the form `key-id:key-secret`.
2. In this folder, copy `.env.example` to `.env.local`. Put the key after `HF_CREDENTIALS=`.
   Git ignores `.env.local`. Do not put the key anywhere else.
3. Run `npm install`.

The tools also accept `HIGGSFIELD_API_KEY` (key ID) and `HIGGSFIELD_API_SECRET`
(secret), matching the server-only variables configured in Vercel. A combined
`key-id:key-secret` value in `HIGGSFIELD_API_KEY` also works. `HF_CREDENTIALS`
takes precedence when populated. Do not use a `NEXT_PUBLIC_` prefix.

Vercel variables are available to deployments, not automatically to these local
CLI tools. Run the tools in an environment with those variables securely injected,
or use an authenticated Vercel CLI to pull them to the git-ignored `.env.local`.
Adding Vercel variables alone does not run asset generation; this static game has
no deployed generation endpoint.

## Commands

The Monster Mash style comparison is at `/tidebreak/styles/`. Three concepts were
generated through the direct API on 2026-09-30 using `marketing-studio/image`.
`monster-styles.json` preserves the shared composition, each style prompt and the
generation parameters. The gallery's `sources.json` records the request IDs and
source URLs. These are custom Ghibli-, Pixar-, and Rick and Morty-inspired prompts,
not named provider presets or screenshots of the game's current renderer.

The generation used a temporary preview-only server function with hashed bearer
authentication, a two-hour expiry and three fixed upstream idempotency keys. It
was removed after the images completed. No generation credentials were downloaded
or committed, and the gallery contains only static assets.

- `npm run models [-- <filter>]` lists the API's models (free). The API makes images and video only.
  It has no 3D models.
- `npm run gen -- <model> <input JSON or @file.json> [--style <game>] [--out <dir>] [--name <base>] [--wait <minutes>] [--dry-run]`
  runs one model once. It prints each output URL on stdout and, with `--out`, saves the files.
  Under a key that ends in `url` or `urls`, a value `"@path/to/file.png"` is uploaded first
  (JPEG, PNG, WebP, GIF, WAV or MP4). Each run is a paid generation.
  - `--style <game>` gives the request a game's look (see [Style files](#style-files)).
  - `--dry-run` prints the input that would be sent, with the style applied, and stops. Nothing is uploaded or paid for.
  - With `--out`, `<name>.request.json` is saved next to the files. It holds the model, the input as given, the
    style that was applied, the request id and the output URLs, so the same command can make the asset again.
- `npm run swatch -- <in> <out.webp|.png|.jpg> [--size 1024] [--band 48] [--repeat] [--preview <file>]` turns a
  generated texture into a square tile (no API call). It crossfades each edge with the opposite edge over `--band`
  pixels, the step River Rush used for its ground, surface and bark tiles (`seamless.ts`). `--preview` saves the
  tile 2 by 2, with the seams in the middle. Look at it before you use the swatch.
  - Use `--repeat` for a regular pattern such as brick courses, shingles or floor tiles. The crossfade alone
    shows a doubled band there, because the pattern does not line up at the edges. `--repeat` first crops the
    square, at least half the shorter side, whose edges continue into the same place in the pattern (`repeat.ts`),
    then blends each edge with the image just past the opposite edge. It prints the crop and its mean seam
    difference (0 is an exact repeat).
- `npm test` checks the style files, the dry run and the swatch step without calling the API.
- `npm run example` sends one Seedance 2.5 text-to-video request ("A cinematic scene at sunset",
  5 s, 720p, 16:9) and prints the video URL.
- `npm run typecheck` checks the TypeScript.

Example:

```sh
npm run gen -- alibaba/qwen-image-3/edit \
  '{"prompt":"ink drawing","image_urls":["@../scratch/concept.png"],"resolution":"1k"}' \
  --out out --name ink
```

## Style files

`styles/<game>.json` holds a game's look, so a new asset starts in that look without restating it:

```json
{
  "game": "In Full Swing",
  "about": "Where this look is recorded in the repository.",
  "prompt": "The style text.",
  "references": ["public/vr/art/keyart.webp"]
}
```

`--style in-full-swing` adds `Style: <prompt>` after the request's own prompt and the reference images after its
own `image_urls`, so use it with models that take reference images in `image_urls`. Reference paths are relative
to the repository root and must be JPEG, PNG, WebP or GIF. A style with a missing image fails before anything is sent.

| Style | Game |
| --- | --- |
| `shore-of-the-ancients` | Shore of the Ancients (mythic painterly realism) |
| `in-full-swing` | In Full Swing (comic ink, cel bands, halftone) |
| `breath-of-the-lake` | Breath of the Lake (Ghibli-like gouache) |
| `river-rush` | River Rush (stylized jungle adventure) |
| `reel-it-in` | Reel It In (hand-painted storybook) |
| `olympus` | Olympus: Last Flame (painterly Greek myth) |

Each style uses text the repository already recorded for that game; `about` says where. Crimson Rogue, Down the Drain,
Get Plunger'd and the arcade key art have no recorded prompt, so they have no style file yet. When a game's look
changes, change its style file in the same commit.

Example: a brick swatch in the In Full Swing look, then a tile and a preview to judge. Run the first command
with `--dry-run` before you pay for it.

```sh
npm run gen -- <model> '{"prompt":"square tileable red brick wall texture, front on, even light"}' \
  --style in-full-swing --out ../scratch --name brick
npm run swatch -- ../scratch/brick.png ../scratch/brick-tile.webp --repeat --band 32 --preview ../scratch/brick-preview.webp
```

## How a run behaves

- Progress and errors go to stderr. Output URLs go to stdout, all of them before any download starts.
  They stay valid for at least 7 days.
- Saved files never overwrite a file: a taken name gets `_2`, `_3` and so on. A failed download still
  exits 1, after it names the URL and the request id.
- The exit code is 0 only when the request completes with an output. A failed, moderated (`nsfw`)
  or canceled request, or a timeout, exits 1 and names the request id.
- The request is sent once. The SDK's own retries are off, so an error cannot start a second paid job.
- The key goes only to api.higgsfield.ai. Uploads and downloads use the storage URLs without it.
  No message prints it, even with `DEBUG` set. With `NODE_DEBUG` set for http, https, net or tls,
  Node itself would print it, so the tools refuse to send.
- If a submit gets no clear answer (a reset, a timeout or a 5xx), the API may still have taken the job.
  Check https://open.higgsfield.ai before you run it again.
- The npm scripts use `--use-env-proxy`, so every call goes through `HTTPS_PROXY` when it is set.
- Model inputs are on each model's page: `https://open.higgsfield.ai/models/<model>/api-reference`.
