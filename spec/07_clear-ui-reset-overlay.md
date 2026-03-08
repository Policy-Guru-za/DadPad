# 07 Clear UI Reset Overlay

## Objective
Replace the inline clear confirmation card with a bottom-sheet overlay that keeps the iPad layout stable and resets DadPad to its normal ready state after confirm.

## In Scope
- Diagnose the current clear-flow layout scramble in an iPad-sized run
- Move clear confirmation out of normal document flow into a bottom-sheet overlay
- Keep clear confirmation separate from the shared status strip
- Reset DadPad to the ready-state baseline on confirm, including editor DOM reset
- Preserve editor text/status/editor position when clear is cancelled
- Update tests and rebuild the iPad app from the revised flow

## Out of Scope
- Broader modal infrastructure for the rest of the app
- Changes to Copy, Share, Undo, or transform semantics outside clear gating
- Reworking setup visibility or first-run onboarding

## Dependencies
- `src/dadpad/useDadPadController.ts`
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`

## Stage Plan
1. Reproduce the current layout scramble locally at iPad width and confirm the in-flow confirmation card is the trigger.
2. Refactor the clear controller path so confirmation is silent and confirmed clear uses one shared ready-state reset helper.
3. Replace the inline card with a fixed bottom-sheet overlay and preserve editor state on cancel.
4. Update regression coverage and rerun `pnpm test` / `pnpm build`.
5. Rebuild/install/launch on the connected iPad for user verification.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad-width local smoke of the clear flow
- Rebuild/install/launch on the connected iPad

## Exit Criteria
- Tapping `Clear` opens a bottom-sheet confirmation without reflowing the status strip, editor, or action bar
- `Keep text` closes the sheet without changing text, status, or editor scroll/caret state
- `Clear now` resets DadPad to its resting ready state with the editor empty, focused, and scrolled to the top
- Tests/build are green and the iPad app is rebuilt from the updated code
