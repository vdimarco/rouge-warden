# Tasks

- [x] Add `.github/workflows/fish-ios.yml` with the simulator job and the TestFlight job.
- [x] Document the Apple setup and the secrets in `apps/fish/README.md`.
- [ ] Run the simulator job in GitHub Actions and look at the screenshot.
- [ ] Archive the change.

## Checks

- On Linux: `npm run build:www -- --release` and `npx cap sync ios` in `apps/fish` pass, and the YAML parses.
- The Xcode build, the simulator launch and the TestFlight upload need the macOS runner.
