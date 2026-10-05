# Serve the arcade at arcade.uptick.systems

The Cottage Arcade lives at `warden-alpha-wheat.vercel.app`, a name that Vercel picked. The owner wants a real address for it: `arcade.uptick.systems`. Cloudflare runs the DNS for `uptick.systems`. Vercel keeps hosting the site.

## Scope

- Add `arcade.uptick.systems` to the Vercel project `warden`.
- The owner adds one CNAME record in Cloudflare, with the proxy off.
- Let `/api/warden` take calls from the new origin. Today it refuses every origin outside `*.vercel.app`, so Jev would stop answering on the new address.
- Point the share tags (`og:url`, `og:image` and `twitter:image`) at the new host.
- Point the Quest app for In Full Swing (`quest/twa-manifest.json`) and its test at the new host.
- Put the real privacy policy URL in the Reel It In store kit.
- Keep `warden-alpha-wheat.vercel.app` live, with no redirect. Quest apps that are already installed open that host.

## Player-facing change

The arcade and every game open at `https://arcade.uptick.systems/`, and Jev answers there. A shared link shows the new address. Old links still work.
