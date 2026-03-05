# PolishPad

PolishPad is a macOS desktop rewrite utility built with Tauri + React + TypeScript.

Current stage: M8 (OpenAI-only V1 pipeline with local encrypted settings).

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

## Security Notes

- API key is configured in-app via Settings and stored in encrypted local config.
- Encryption key path: `~/.polishpad/encryption.key`.
- Encrypted config path: `~/.polishpad/config.enc`.
