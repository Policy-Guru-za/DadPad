# DadPad Brief

## Objective
Turn the copied PolishPad codebase into DadPad: a clean, minimal, iPad-first text-polishing app for a 75-year-old non-technical user.

## Authority
- For DadPad work, this brief and the active execution spec own product scope, acceptance criteria, and DadPad-specific proof gates.
- `AGENTS.md` still governs repo operational workflow, safety rules, package-manager choice, spec/progress discipline, and test/build expectations.
- Copied PolishPad docs remain implementation reference only until replaced. They do not define DadPad product scope.

## Product Contract
- Platform target: iPad first.
- iPhone: out of scope unless trivial.
- Architecture: keep Tauri 2 + React + TypeScript + thin Rust shell unless a concrete blocker appears.
- Reuse: keep the working transform pipeline, streaming, placeholder protection, cancel, and undo logic wherever possible.
- OpenAI only for V1.

## Core User Flow
1. User pastes or types rough text.
2. User taps one obvious primary button: `Polish`.
3. Output streams into the same editor.
4. User can `Cancel` while streaming.
5. User can `Undo`, `Clear`, `Copy`, or `Share`.

## Visible DadPad UI
- One large editor surface.
- One primary action: `Polish`.
- Visible secondary actions: `Undo`, `Cancel`, `Clear`, `Copy`, `Share`.
- Small setup/settings entry for API key only.
- One visible status line for ready/progress/success/error states.

## Hidden Or Removed From DadPad UI
- Casual / Professional / Direct buttons
- Markdown / preset buttons
- Provider switching
- Model selection
- Temperature control
- Token-protection toggles
- Desktop-oriented stats / footer chrome
- Non-essential branding carried over from PolishPad

## Setup
- DadPad starts clean as a separate product.
- No automatic import of PolishPad config, keys, or settings.
- DadPad storage uses an explicit DadPad namespace in app-scoped storage.
- First-run setup is a minimal visible API-key screen.

## Storage
- Rust remains responsible for encrypted config read/write.
- Store `encryption.key` and `config.enc` under a DadPad-scoped app-support location.
- Do not derive storage paths from the copied PolishPad bundle identifier or `~/.polishpad`.
- Legacy import from `~/.polishpad` is out of scope by default.

## Sharing
- `Share` is first-class and visible.
- First choice: `navigator.share({ text })` through one frontend utility.
- If simulator proof is inconclusive, require physical iPad proof or immediately switch to a thin native `share_text` bridge before the DadPad UI is locked.

## Proof Gates
### DadPad Gate A
- Tauri iOS shell initialized
- DadPad UI renders on simulator
- Single `Polish` transform succeeds
- `Cancel`, `Undo`, `Clear`, `Copy`, and `Share` visible in DadPad UI
- Relevant tests green
- Changed flow dogfooded locally

### DadPad Gate B
- Storage path moved to DadPad-scoped app storage
- Fresh first-run setup confirmed
- No legacy PolishPad config import
- Commands run and current proof status recorded in `progress.md`

## Definition Of Done For This Port
- DadPad product scope is represented in docs and code.
- DadPad uses fresh app-scoped encrypted storage.
- DadPad ships a simplified touch-first UI with the locked visible controls.
- DadPad can run on iPad simulator; physical iPad smoke test if feasible.
- DadPad share path is proven via `navigator.share` or an explicit native bridge.
- Tests/builds for the transitioned app are green.
