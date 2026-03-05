# PolishPad

PolishPad is a macOS desktop rewrite utility built with Tauri + React + TypeScript.

Current stage: M1 app shell only.

Implemented in M1:
- Single-window UI shell
- Toolbar with `Polish`, `Casual`, `Professional`, `Direct`, and `Copy`
- Main multiline editor
- Status bar with live word and character counts
- Last-mode + latency/warnings placeholders

Not implemented yet:
- LLM transform pipeline
- Streaming
- Undo/cancel
- Placeholder protection

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

## Build

```bash
pnpm build
pnpm tauri build
```

## Security Notes

- Use `.env.local` with `VITE_OPENAI_API_KEY` for private local development only.
- Do not ship/distribute builds that rely on `VITE_OPENAI_API_KEY` from frontend env injection.
