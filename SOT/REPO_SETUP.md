# REPO_SETUP.md

## Requirements
- macOS
- Node.js (LTS)
- Rust toolchain
- Tauri prerequisites for macOS
- pnpm (preferred) or npm

## Install
1. Install dependencies:
   - pnpm install

2. Run dev:
   - pnpm tauri dev

## Tests
- pnpm test

## Build
- pnpm tauri build

## Notes
- No microphone / accessibility permissions should be required for V1.
- If the app asks for elevated permissions, treat as a bug.
- Never run create/scaffold commands with --force from repo root.