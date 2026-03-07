# Progress

## Current Spec
- `04_physical-ipad-smoke`

## Current Stage
- Stage 3 — Physical install / launch blocked on device state

## Status
- Spec `04_physical-ipad-smoke` is in progress.
- Connected device is now visible as `Ryan’s iPad (6)` (`13A95266-ADC7-527A-9F91-4B46F268AE25`), but `xcrun devicectl list devices` reports `connected (no DDI)`.
- Xcode MCP live session access is confirmed for `src-tauri/gen/apple/dadpad.xcodeproj`.
- The repo-local Xcode blocker is fixed: `Build Rust Code` now resolves `pnpm` under Xcode's non-login shell environment.
- Xcode MCP `BuildProject` now succeeds when a companion `pnpm tauri ios build --debug --open` session is running.
- Physical install/launch is still blocked by device state: `xcrun devicectl device install app` fails with `Developer Mode is disabled`.

## Last Green Commands
- `pnpm test`
- `pnpm build`
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The build succeeded`)
- `pnpm tauri ios build --debug -t aarch64-sim --ci`
- `xcrun simctl uninstall booted com.ryanlaubscher.dadpad || true`
- `xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/DadPad.app`
- `xcrun simctl launch booted com.ryanlaubscher.dadpad`

## Blockers
- Active physical-device blocker 1: `xcrun devicectl device info details --device 13A95266-ADC7-527A-9F91-4B46F268AE25` reports `developerModeStatus: disabled`.
- Active physical-device blocker 2: the same device reports `ddiServicesAvailable: false` / `connected (no DDI)`, so host-side install/run services are unavailable until Developer Mode is enabled on-device.
- Tauri-generated Xcode projects on this repo cannot be built via MCP alone; they require a live companion `pnpm tauri ios build --debug --open` session so `tauri ios xcode-script` can fetch its CLI options over localhost.
- Existing simulator proof remains green; this spec is only about recovering the physical-device path.

## Next Step
- Enable Developer Mode on the connected iPad, reconnect it, and re-run the install/launch steps against the already proven Xcode build path.
- After Developer Mode is active, retry:
  - `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
  - `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 com.ryanlaubscher.dadpad`
- If install still fails after Developer Mode, isolate the next blocker as DDI/trust/signing versus app runtime.

## Dogfood Evidence
- `pnpm tauri ios build --debug -t aarch64-sim --ci` completes and produces `src-tauri/gen/apple/build/arm64-sim/DadPad.app`.
- Portrait simulator proof: larger 3x2 action grid, visible setup flow, and stronger touch-target sizing in `tmp/ipad-polish/01-portrait.png`.
- Landscape simulator proof: action bar expands to six across without clipping in `tmp/ipad-polish/03-landscape-upright.png`.
- Larger-text simulator smoke: no clipped headings, status text, setup controls, or action labels in `tmp/ipad-polish/04-accessibility-large-upright.png`. The webview still shows limited response to the simulator content-size setting, so the app relies on larger default sizing instead of native Dynamic Type integration.
- Keyboard-safe simulator proof: editor remains usable, action bar stays reachable, and ready-state status remains visible with the software keyboard open in `tmp/ipad-polish/09-keyboard-open-upright.png`.
- After manual key save, DadPad writes `config.enc` and `encryption.key` under `Library/Application Support/DadPad/` inside the simulator app container.
- `xcrun devicectl list devices` now sees `Ryan’s iPad (6)` as `connected (no DDI)`, so physical-iPad recovery work is now feasible.
- Xcode MCP `GetBuildLog` first isolated the device-build failure to `pnpm: command not found`, then later confirmed `buildResult: The build succeeded` once the companion Tauri session was active.
- The signed device artifact now exists at `~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`.
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app` fails with `The operation failed because Developer Mode is disabled.`
