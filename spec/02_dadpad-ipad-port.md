# 02 DadPad iPad Port

## Objective
Port the copied PolishPad codebase into DadPad by reusing the existing transform core, introducing fresh DadPad-scoped storage, and replacing the visible shell with a touch-first iPad UI.

## In Scope
- Add DadPad source-of-truth product brief
- Move storage from `HOME/.polishpad` assumptions to explicit DadPad-scoped app storage
- Keep OpenAI-only core and current transform pipeline
- Simplify visible UI to DadPad controls only
- Add visible status messaging, clear flow, share flow, and minimal API-key setup
- Transition tests from PolishPad UI coupling to DadPad UI coverage
- Initialize and validate Tauri iOS support when toolchain permits

## Out of Scope
- Automatic import of legacy PolishPad config, keys, or settings
- Anthropic or provider switching
- Markdown / preset UI in DadPad V1
- iPhone-specific optimization beyond trivial compatibility
- App Store hardening, notarization, or distribution work
- Full rewrite of copied PolishPad SOT docs

## Dependencies
- Existing provider core in `src/providers/openai.ts`
- Existing placeholder and structuring logic in `src/protect/` and `src/structuring/`
- Rust config bridge in `src-tauri/src/config.rs`
- Tauri iOS tooling, full Xcode, simulator runtime, and Rust iOS targets

## Stage Plan
1. Add DadPad brief/spec/progress docs. Completed.
2. Refactor config storage to fresh DadPad-scoped persistence with no legacy import. Completed.
3. Introduce DadPad UI shell, status line, clear flow, share utility, and minimal setup flow. Completed.
4. Transition tests from PolishPad UI assertions to DadPad coverage. Completed.
5. Initialize Tauri iOS support and prove a static simulator build/install/launch path. Completed.
6. Prove Share on the static simulator app; if simulator evidence is inconclusive, immediately choose physical-iPad proof or the native `share_text` fallback decision. Completed.
7. Complete the first working DadPad transform loop on the static simulator app and record DadPad Gate A evidence. Completed.
8. Perform identity cutover for names/icons/native metadata after the mobile path is proven. Completed.

## Proof Gate Ownership
- DadPad product scope and DadPad proof gates come from `SOT/DADPAD_BRIEF.md` plus this spec.
- `AGENTS.md` still governs repo workflow, safety rules, and gate discipline.
- The approved DadPad migration plan satisfies the up-front decision lock for the storage and share approach.

## Test Gate
- `pnpm test`
- `pnpm build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm tauri ios build --debug -t aarch64-sim --ci`
- `xcrun simctl uninstall booted com.ryanlaubscher.polishpad || true`
- `xcrun simctl uninstall booted com.ryanlaubscher.dadpad || true`
- `xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/DadPad.app`
- `xcrun simctl launch booted com.ryanlaubscher.dadpad`
- `pnpm tauri ios dev` only as a secondary / experimental simulator check or physical-iPad path, not as the default iPad proof route
- Manual dogfood of the changed UI flow

## Exit Criteria
- DadPad brief/spec/progress docs are current
- DadPad uses explicit DadPad-scoped encrypted storage
- DadPad UI exposes only the locked visible controls
- PolishPad UI-coupled tests are replaced or retired
- DadPad-specific tests cover clear/share/status/setup behavior
- Share proof is completed or the fallback path is explicitly locked
- First working DadPad transform loop is proven on iPad
- Native identity is DadPad-native across Tauri config, generated Apple project naming, bundle id, and simulator install target. Completed.
- Fresh DadPad simulator container can save config and keep it across relaunch. Completed.
