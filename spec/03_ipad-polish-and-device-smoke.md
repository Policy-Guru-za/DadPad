# 03 iPad Polish And Device Smoke

## Objective
Harden the current DadPad shell for real iPad use by improving viewport fit, action layout, legibility, keyboard safety, and simulator/device smoke coverage without changing the core product model.

## In Scope
- Keep the current DadPad visual direction and controls
- Replace fixed-height shell sizing with viewport-safe flex layout
- Make the action bar iPad-orientation-aware
- Improve touch target sizing, contrast, and status readability
- Add lightweight keyboard-aware layout handling using `visualViewport` when available
- Run portrait, landscape, larger-text, and keyboard-safe simulator smoke checks
- Attempt one minimal physical iPad smoke pass if feasible without external setup churn

## Out Of Scope
- Provider, prompt, share, or storage architecture changes
- New visible controls, menus, or setup complexity
- Native Dynamic Type bridge work
- VoiceOver-specific engineering beyond existing semantic HTML
- Bundle identity changes, signing, App Store hardening, or release distribution work

## Dependencies
- Current DadPad shell in `src/App.tsx` and `src/App.css`
- Existing DadPad controller in `src/dadpad/useDadPadController.ts`
- Static simulator build/install route via `pnpm tauri ios build --debug -t aarch64-sim --ci`

## Stage Plan
1. Activate spec `03` in `spec/00_overview.md` and `progress.md`. Completed at start of work.
2. Refactor the shell to a viewport-safe flex layout with safe-area padding and larger tap targets.
3. Add lightweight keyboard-aware viewport handling and keep the action bar reachable while typing.
4. Add regression coverage for the new shell behavior without changing the runtime interfaces.
5. Rebuild the static simulator app and run portrait, landscape, larger-text, and keyboard-safe smoke checks. Completed.
6. If feasible, run one minimal physical-iPad smoke pass and record any device-only differences. Not feasible in this environment; no attached devices detected via `xcrun devicectl list devices`.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm tauri ios build --debug -t aarch64-sim --ci`
- `xcrun simctl uninstall booted com.ryanlaubscher.dadpad || true`
- `xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/DadPad.app`
- `xcrun simctl launch booted com.ryanlaubscher.dadpad`
- Manual simulator smoke in portrait, landscape, and larger-text modes

## Exit Criteria
- DadPad shell uses a viewport-safe flex layout instead of fixed-height editor sizing
- Action bar uses a 3x2 layout by default and a 6-wide layout on wide landscape iPad screens
- Main controls meet the senior-friendly legibility/tap-target bar
- Software-keyboard use keeps the editor usable and the action bar reachable
- Larger-text simulator smoke shows no clipped headings, status text, setup controls, or action labels
- Relevant tests/builds are green
- `progress.md` records simulator evidence and any physical-iPad findings or blockers. Completed.
