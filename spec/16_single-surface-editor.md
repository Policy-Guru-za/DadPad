# 16 Single Surface Editor

## Objective
Simplify DadPad's writing area so the textarea is the only visible card, removing the current double-framed editor treatment while preserving behavior and accessibility.

## In Scope
- Remove the visible outer editor card treatment
- Keep the textarea as the sole visible writing surface
- Hide the `Your text` label visually while preserving it for accessibility and tests
- Preserve clear/reset, keyboard docking, offline overlay, and action-bar behavior
- Add regression coverage plus browser/iPad smoke
- Update spec/progress tracking

## Out of Scope
- Any controller or provider changes
- Any placeholder copy rewrite
- Any broader shell or action-bar redesign

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Record the new spec handoff in `spec/00_overview.md` and `progress.md`.
2. Simplify the editor markup so the wrapper remains layout-only and the visible label becomes hidden-only.
3. Move the full card treatment onto the textarea and remove the outer editor surface styling.
4. Add regression coverage for the hidden label, single-surface editor treatment, and preserved keyboard/clear/offline behavior.
5. Run `pnpm test`, `pnpm build`, iPad-width browser smoke, then rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke for default, keyboard-open, offline, and clear-reset states
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject`
- physical iPad install/launch

## Exit Criteria
- The editor wrapper no longer paints a visible card surface
- The textarea remains labeled as `Your text`, but that label is visually hidden
- The placeholder `Paste or write text here.` remains the visible prompt inside the single card
- Clear/reset, offline overlay, and keyboard-open states still behave correctly
- `pnpm test` and `pnpm build` are green, browser smoke is green, and the updated app is rebuilt/installed/launched on the connected iPad
