# Release Checklist (V1)

## 1) Repo state
- Ensure working tree is clean: `git status --short --branch`

## 2) Test gates
- Run frontend tests: `pnpm test`
- Run Rust tests: `cd src-tauri && cargo test`

## 3) Build release
- Build release bundle: `pnpm tauri build`
- Confirm artifact exists: `src-tauri/target/release/bundle/macos/PolishPad.app`

## 4) Smoke test
- Launch app bundle (`open src-tauri/target/release/bundle/macos/PolishPad.app`)
- Settings:
  - open Settings panel
  - save OpenAI API key
  - save model / temperature / streaming / token protection changes
  - restart app and confirm settings reload
- Modes:
  - run Polish, Casual, Professional, Direct at least once
- Core UX:
  - copy works
  - cancel restores original during stream
  - undo restores pre-transform text
  - truncation warning appears when applicable and `Retry (more room)` works
  - token protection preserves markdown links/code/URLs/emails
