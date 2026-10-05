# Tasks

- [x] Add `arcade.uptick.systems` to the Vercel project `warden` (team `vdimarcos-projects`). Vercel marks it verified.
- [x] Owner: add the CNAME record in Cloudflare (see the design).
- [x] Let `/api/warden` accept `https://arcade.uptick.systems`. Add `qa/api/warden.test.mjs`.
- [x] Point the share tags in 7 pages at the new host.
- [x] Point `quest/twa-manifest.json`, `qa/vr/pwa.mjs` and `quest/README.md` at the new host.
- [x] Put `https://arcade.uptick.systems/fish/privacy.html` in the Reel It In store kit and README.
- [x] Name the live address and the origin rule in the root README.
- [x] Validate the change with the OpenSpec CLI.
- [x] After the record: check DNS, the certificate, the pages, and `assetlinks.json` and its header.
- [ ] After the merge: a call to `/api/warden` from `https://arcade.uptick.systems` passes the origin check on the live site.
- [ ] Archive the change.

## Checks

- `node qa/api/warden.test.mjs`: 12 origins. On the old check, `https://arcade.uptick.systems` got 403 (11 passed, 1 failed). On the new check, all 12 pass, and the lookalike hosts still get 403.
- `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/pwa.mjs`: passes, with the host and every URL of `twa-manifest.json` on the new host.
- `npm run build:www` in `apps/fish`: the bundle check passes. The store build drops the share tags, so the new host does not reach the app.
- `openspec validate arcade-custom-domain --type change --strict` (CLI 1.14.0): valid.

## The live domain (5 October 2026)

- DNS: `arcade.uptick.systems` is a CNAME to `cname.vercel-dns.com`, and it resolves to Vercel addresses, not to the Cloudflare proxy.
- Certificate: a few minutes after the record went in, Vercel had not issued one, so it was requested through the Vercel API. Let's Encrypt issued it for `arcade.uptick.systems`, valid to 3 January 2027, with automatic renewal.
- Pages: `/`, `/fish/`, `/vr/`, `/brawl/` and `/fish/privacy.html` answer 200 over HTTPS from Vercel. The arcade page is the same file, byte for byte, on both hosts. `http://` answers 308 to `https://`.
- `/.well-known/assetlinks.json` answers 200 with `Content-Type: application/json`.
- `https://warden-alpha-wheat.vercel.app/` still answers 200, with no redirect.
- Jev: before the merge, the live site still has the old rule. A call with `Origin: https://arcade.uptick.systems` gets 403, and a call from the old host gets past the check (400 for an empty body). The branch preview needs a Vercel login, so the new rule was not called there. The check runs again after the merge.
