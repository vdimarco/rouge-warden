## ADDED Requirements

### Requirement: The arcade answers at arcade.uptick.systems
The site SHALL serve every page of `public/` at `https://arcade.uptick.systems/` over HTTPS with a valid certificate. `https://warden-alpha-wheat.vercel.app/` SHALL keep serving the same deployment, with no redirect.

#### Scenario: Open the arcade
- **WHEN** a player opens `https://arcade.uptick.systems/`
- **THEN** the arcade page loads with a certificate for that name

#### Scenario: An old link
- **WHEN** a player opens a link on `warden-alpha-wheat.vercel.app`
- **THEN** the same page loads there

#### Scenario: Asset links for the Quest app
- **WHEN** the Quest app asks for `https://arcade.uptick.systems/.well-known/assetlinks.json`
- **THEN** the file loads with `Content-Type: application/json`

### Requirement: Jev answers on the new host
`/api/warden` SHALL accept a request whose `Origin` is `https://arcade.uptick.systems` or `https://<name>.vercel.app`, and a request with no `Origin`. It SHALL refuse every other origin with 403.

#### Scenario: A game on the new host asks Jev
- **WHEN** a game on `https://arcade.uptick.systems` posts to `/api/warden`
- **THEN** the origin check lets the request through

#### Scenario: Another site asks Jev
- **WHEN** a page on another origin posts to `/api/warden`, for example `https://arcade.uptick.systems.example.com`
- **THEN** the answer is 403 with "origin not allowed"

### Requirement: Links name the new host
The share tags (`og:url`, `og:image`, `twitter:image`), the Quest app settings in `quest/twa-manifest.json`, and the privacy policy URL in the Reel It In store kit SHALL use `https://arcade.uptick.systems`.

#### Scenario: Share a game
- **WHEN** someone shares a game page that has share tags
- **THEN** the preview uses a URL and an image on `arcade.uptick.systems`

#### Scenario: Check the Quest app settings
- **WHEN** `qa/vr/pwa.mjs` checks `quest/twa-manifest.json`
- **THEN** the host and every URL in it are on `arcade.uptick.systems`
