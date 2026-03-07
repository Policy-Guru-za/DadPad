# DadPad

DadPad is an iPad-first text-polishing app built by adapting the existing PolishPad Tauri + React + TypeScript codebase.

Current repo stage: DadPad port in progress; static iPad simulator route proven; Share proof + first iPad transform loop next.

Notes:
- Visible app UI is DadPad.
- Native bundle identifiers / product metadata still carry copied PolishPad values until a later identity cutover.
- Primary iPad simulator workflow is a static simulator build/install/launch path.
- `pnpm tauri ios dev` is secondary / experimental on simulator and may still be useful for physical-iPad work.

## Requirements

- macOS for current desktop dev flow
- Node.js LTS
- pnpm
- Rust toolchain (`rustc`, `cargo`)
- Tauri prerequisites

## Run

```bash
pnpm install
pnpm tauri dev
```

Then use the `API key` button / setup card to save your OpenAI API key.

Current DadPad UI:
- one large editor
- `Polish`, `Undo`, `Cancel`, `Clear`, `Copy`, `Share`
- minimal API-key setup

## iPad Simulator (Primary)

```bash
pnpm tauri ios build --debug -t aarch64-sim --ci
xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/PolishPad.app
xcrun simctl launch booted com.ryanlaubscher.polishpad
```

This is the current primary iPad simulator route.

## iPad Live Dev (Secondary / Experimental on Simulator)

```bash
pnpm tauri ios dev 'iPad Pro 13-inch (M5)'
```

Use this mainly for physical-iPad work or when Tauri's simulator dev path is behaving. The static simulator route above is the authoritative dogfood path for now.

## Build

```bash
pnpm build
pnpm tauri build
```

Release artifacts (current desktop identity):
- `.app` bundle: `src-tauri/target/release/bundle/macos/PolishPad.app`
- installer package: `src-tauri/target/release/bundle/dmg/PolishPad_0.1.0_aarch64.dmg` (filename may vary by architecture/version)

Run the built app:
```bash
open src-tauri/target/release/bundle/macos/PolishPad.app
```

Signing/notarization is intentionally not configured in V1.

## Security Notes

- API key is configured in-app via Settings and stored in encrypted local config.
- DadPad now uses fresh DadPad-scoped encrypted app storage, not `~/.polishpad`.
- No automatic import of legacy PolishPad config, keys, or settings.
