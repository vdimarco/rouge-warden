# The support email for Reel It In

The privacy policy held a marked placeholder for the support email, and the release build (`--release`) stopped on it, so no signed bundle could be made for a store upload. The owner chose `support@uptick.systems`.

## Scope

- Put `support@uptick.systems` in `public/fish/privacy.html`, as text and as a `mailto:` link, and remove the placeholder.
- Name it in the store kit: the Play contact email, and the App Store support URL (the privacy page, which gives the address).
- Remove the decided row from the README's open owner decisions, and say that the release check stops on any placeholder.

## Player-facing change

The privacy policy ends with "Questions: support@uptick.systems", and the address opens a new mail. The owner makes the address deliver mail. The mail of `uptick.systems` runs on Google Workspace (its MX records point to Google), so the address is an alias or a group there. Cloudflare Email Routing would replace those MX records and stop the domain's mail.
