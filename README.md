# PolishPad

PolishPad is a macOS desktop rewrite utility built with Tauri + React + TypeScript.

Current stage: M9 (release build path documented for OpenAI-only V1).

## Requirements

- macOS
- Node.js LTS
- pnpm
- Rust toolchain (`rustc`, `cargo`)
- Tauri macOS prerequisites

## Run

```bash
pnpm install
pnpm tauri dev
```

Then open `Settings` in the app toolbar and save your OpenAI API key.

## Build

```bash
pnpm build
pnpm tauri build
```

Release artifacts (macOS):
- `.app` bundle: `src-tauri/target/release/bundle/macos/PolishPad.app`
- installer package: `src-tauri/target/release/bundle/dmg/PolishPad_0.1.0_aarch64.dmg` (filename may vary by architecture/version)

Run the built app:
```bash
open src-tauri/target/release/bundle/macos/PolishPad.app
```

Signing/notarization is intentionally not configured in V1.

## Security Notes

- API key is configured in-app via Settings and stored in encrypted local config.
- Encryption key path: `~/.polishpad/encryption.key`.
- Encrypted config path: `~/.polishpad/config.enc`.
