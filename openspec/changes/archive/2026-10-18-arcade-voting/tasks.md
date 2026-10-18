# Tasks

- [x] Inspect arcade, game menu loading, and public API documentation.
- [x] Add fixed mapping, homepage links, and current-game menu link.
- [x] Check all six mappings, accessible names, keyboard focus, target bounds, menu reopening, and Keep playing at 320, 390, and 1280px. GitHub Actions run 39174506603 passed; screenshots reviewed. Artwork and external metrics were mocked; game menu hosts used the real shared script.
- [x] Review Markdown structure manually. OpenSpec CLI was unavailable, so CLI validation did not run.
- [x] Merge PR #409 and verify production commit f821bdf on arcade.uptick.systems. All six live homepage links have the expected href, new-tab target, safe rel, and 44px height. Crimson Rogue’s live menu link and Keep playing work. Full 3D gameplay was not tested because the cloud browser has WebGL disabled.
