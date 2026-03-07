# Progress

## Current Spec
- `02_dadpad-ipad-port`

## Current Stage
- Stage 8 — Identity cutover complete

## Status
- Spec `02_dadpad-ipad-port` is complete. DadPad now builds, installs, launches, stores config, and relaunches under DadPad-native identity on simulator.

## Last Green Commands
- `pnpm test`
- `pnpm build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm tauri dev --no-watch`
- `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
- `pnpm tauri ios init --ci --skip-targets-install`
- `pnpm tauri ios build --debug -t aarch64-sim --ci`
- `xcrun simctl uninstall booted com.ryanlaubscher.polishpad || true`
- `xcrun simctl uninstall booted com.ryanlaubscher.dadpad || true`
- `xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/DadPad.app`
- `xcrun simctl launch booted com.ryanlaubscher.dadpad`

## Blockers
- No hard blocker on the primary static simulator route.
- Repo config is back on Tauri's documented mobile dev pattern:
  - Vite `server.host = process.env.TAURI_DEV_HOST || false`
  - default `devUrl` restored to `http://localhost:1420`
  - no permanent simulator/LAN override in repo config
- `pnpm tauri ios dev --no-watch --no-dev-server -c '{"build":{"beforeDevCommand":"pnpm build","devUrl":null}}' 'iPad Pro 13-inch (M5)'` still fails on simulator, but now against `tauri://localhost/` instead of a Mac LAN URL.
- That failure is stronger evidence that the simulator `tauri ios dev` path is the unstable layer, not the host-served frontend route alone.
- Primary simulator route is now the static-assets build/install path:
  - build `src-tauri/gen/apple/build/arm64-sim/DadPad.app`
  - install with `simctl`
  - launch with `simctl`
- Remaining limitation: `tauri ios dev` on simulator should be treated as likely upstream Tauri iOS dev-path instability unless later evidence isolates a local repo issue.
- Xcode MCP is host-configured, but live-session availability must be verified per run. If `xcode` MCP startup fails or cancels, fall back to CLI/Xcode directly.
- Remaining proof gap: no physical-iPad smoke yet; current proof is simulator-only.

## Next Step
- Create the next spec for broader iPad polish and optional physical-iPad smoke.
- Keep simulator work on the static-assets route, not `tauri ios dev`, unless new evidence proves the simulator dev path is reliable again.

## Dogfood Evidence
- DadPad UI implemented. `pnpm tauri dev --no-watch` compiled and launched the desktop Tauri binary successfully.
- `pnpm tauri ios build --debug -t aarch64-sim --ci` now completes with DadPad-native identity and produces `src-tauri/gen/apple/build/arm64-sim/DadPad.app`.
- Installing and launching `com.ryanlaubscher.dadpad` on `iPad Pro 13-inch (M5)` renders the DadPad setup screen on a fresh simulator container.
- The interim DadPad icon is visibly present on the simulator home screen and dock in `tmp/identity-cutover/02-home-screen.png`.
- The fresh DadPad setup screen is captured in `tmp/identity-cutover/01-dadpad-launch.png`.
- After manual key save, DadPad writes `config.enc` and `encryption.key` under `Library/Application Support/DadPad/` inside the new simulator app container.
- After terminate + relaunch of `com.ryanlaubscher.dadpad`, DadPad returns to the main editor with status `Ready.` and the setup card hidden. Evidence: `tmp/identity-cutover/03-after-relaunch.png`.
- `tauri ios dev` remains unreliable on simulator and is no longer the primary route.
- Share proof on the static simulator app succeeded:
  - sample text entered into the editor: `share me from dadpad`
  - DadPad `Share` button tapped from the static simulator build
  - native iOS share sheet became visibly present on-screen with `Reminders`, `More`, `Copy`, and `Save to Files`
  - result classification: `Success`
  - evidence screenshots saved under `tmp/share-proof/`, especially `06-after-drag-scroll.png` (pre-share state) and `08-after-scroll-up.png` (share sheet visible)
- DadPad Gate A transform proof succeeded on the static simulator app:
  - setup status after manual in-app key entry: `DadPad is ready.`
  - rough input used: `hi just checking if tomorrow afternoon works for the review i can send the notes after thanks`
  - polished result: `Hi, just checking if tomorrow afternoon works for the review. I can send the notes after. Thanks.`
  - completion status: `Polished.`
  - undo status: `Undo restored the original text.`
  - restored text matched the original rough input
  - evidence screenshots saved under `tmp/share-proof/`, especially `11-pre-transform.png`, `21-after-manual-polish-click.png`, `22-five-seconds-after-click.png`, and `23-after-undo.png`
  - simulator recording saved as `tmp/share-proof/transform-run.mov`
