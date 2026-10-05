# Design

**DNS only.** The Cloudflare proxy stays off for this record. Vercel does not recommend a reverse proxy in front of it: the proxy hides the traffic from the Vercel Firewall and adds latency and cache problems. With a plain CNAME, Vercel issues the certificate and serves the site directly.

**The record.**

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `arcade` | `cname.vercel-dns.com` | DNS only | Auto |

Vercel needs no TXT record. It marked the domain verified when the domain was added to the project.

**No redirect from the old host.** A Quest app built from the old `twa-manifest.json` trusts only `warden-alpha-wheat.vercel.app`. A redirect to another origin would fail its Trusted Web Activity check, and the app would show a URL bar. Both hosts serve the same deployment, so both serve `/.well-known/assetlinks.json` with its `Content-Type` header.

**The API allow list.** `/api/warden` reads the `Origin` header. It now takes `https://arcade.uptick.systems`, and it still takes `https://<name>.vercel.app`, which covers the old host and the branch previews. The match is exact, so `https://arcade.uptick.systems.example.com` and `http://arcade.uptick.systems` get 403. A call with no `Origin` header passes, as before.

**What keeps the old host.** Records of past work keep the address they used: verification notes, preview links, and the Higgsfield source list in `public/tidebreak/art/animated/sources.json`.

**The Quest app.** The next APK from `quest/build-apk.sh` opens the new host. A service worker cache belongs to one origin, so that APK starts with an empty offline cache. It needs the network for its first start, as every new install does.

**Package names.** This change leaves the app IDs alone. The Quest app keeps `com.cottagearcade.fullswing`.
