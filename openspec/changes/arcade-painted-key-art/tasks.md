# Tasks

- [x] Generate painted key art for the eight games with Higgsfield, using each old frame as a reference.
- [x] Record the jobs in `higgsfield/arcade-key-art.json` and add `scripts/arcade-key-art.mjs` to download them.
- [x] Download the art to `public/arcade/key/` and look at each picture.
- [x] Point the switcher entries and the five still machine screens at the new art.
- [x] Add a size and format check (WebP, under 100 KB) for `public/arcade/key/` to `qa/arcade/machines.mjs`.
- [ ] Run `node qa/arcade/machines.mjs` and check the switcher in a browser at 390 x 844 and 1280 x 720.
- [ ] Validate the spec with the OpenSpec CLI when it is available.
