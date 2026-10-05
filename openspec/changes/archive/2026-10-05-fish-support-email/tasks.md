# Tasks

- [x] Put `support@uptick.systems` in `public/fish/privacy.html` as text and a `mailto:` link, and remove the placeholder.
- [x] Name the address in `apps/fish/store/listing.md` and `apps/fish/README.md`, and remove the decided owner row.
- [x] Run the release build of the bundle.
- [x] Validate the change with the OpenSpec CLI.
- [x] Archive the change.

## Checks

- `npm run build:www -- --release` in `apps/fish`: `check:www passed`. Before the change it failed on the placeholder (the run the owner pasted).
- `node apps/fish/scripts/check-www.test.mjs` passes: its placeholder cases use their own made-up pages.
