# Progress

## Current Spec
- `03_ipad-polish-and-device-smoke`

## Current Stage
- Stage 6 — Complete

## Status
- Spec `03_ipad-polish-and-device-smoke` is complete. DadPad now has a viewport-safe iPad shell, larger touch targets, orientation-aware actions, and software-keyboard-safe simulator proof.

## Last Green Commands
- `pnpm test`
- `pnpm build`
- `pnpm tauri ios build --debug -t aarch64-sim --ci`
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
- Physical-iPad smoke remains pending because `xcrun devicectl list devices` returned no attached devices in this environment.

## Next Step
- Create the next spec only if you want a new phase beyond the current senior-friendly shell hardening.
- Keep simulator work on the static-assets route, not `tauri ios dev`, unless new evidence proves the simulator dev path is reliable again.
- Run optional physical-iPad smoke later when a device is attached and available.

## Dogfood Evidence
- `pnpm tauri ios build --debug -t aarch64-sim --ci` completes and produces `src-tauri/gen/apple/build/arm64-sim/DadPad.app`.
- Portrait simulator proof: larger 3x2 action grid, visible setup flow, and stronger touch-target sizing in `tmp/ipad-polish/01-portrait.png`.
- Landscape simulator proof: action bar expands to six across without clipping in `tmp/ipad-polish/03-landscape-upright.png`.
- Larger-text simulator smoke: no clipped headings, status text, setup controls, or action labels in `tmp/ipad-polish/04-accessibility-large-upright.png`. The webview still shows limited response to the simulator content-size setting, so the app relies on larger default sizing instead of native Dynamic Type integration.
- Keyboard-safe simulator proof: editor remains usable, action bar stays reachable, and ready-state status remains visible with the software keyboard open in `tmp/ipad-polish/09-keyboard-open-upright.png`.
- After manual key save, DadPad writes `config.enc` and `encryption.key` under `Library/Application Support/DadPad/` inside the simulator app container.
- `xcrun devicectl list devices` returned no attached physical devices, so physical-iPad smoke was not feasible in this pass.
