# Tasks

- [x] Add `arcade.uptick.systems` to the Vercel project `warden` (team `vdimarcos-projects`). Vercel marks it verified.
- [ ] Owner: add the CNAME record in Cloudflare (see the design).
- [x] Let `/api/warden` accept `https://arcade.uptick.systems`. Add `qa/api/warden.test.mjs`.
- [x] Point the share tags in 7 pages at the new host.
- [x] Point `quest/twa-manifest.json`, `qa/vr/pwa.mjs` and `quest/README.md` at the new host.
- [x] Put `https://arcade.uptick.systems/fish/privacy.html` in the Reel It In store kit and README.
- [x] Name the live address and the origin rule in the root README.
- [x] Validate the change with the OpenSpec CLI.
- [ ] After the record: check DNS, the certificate, the arcade page, `assetlinks.json` and its header, and a Jev call from the new origin.
- [ ] Archive the change when the domain works.

## Checks

- `node qa/api/warden.test.mjs`: 12 origins. On the old check, `https://arcade.uptick.systems` got 403 (11 passed, 1 failed). On the new check, all 12 pass, and the lookalike hosts still get 403.
- `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/pwa.mjs`: passes, with the host and every URL of `twa-manifest.json` on the new host.
- `npm run build:www` in `apps/fish`: the bundle check passes. The store build drops the share tags, so the new host does not reach the app.
- `openspec validate arcade-custom-domain --type change --strict` (CLI 1.14.0): valid.

Not checked yet: the live domain. It needs the Cloudflare record first.
