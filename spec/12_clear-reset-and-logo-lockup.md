# 12 Clear Reset And Logo Lockup

## Objective
Stabilize DadPad's post-clear behavior on iPad so confirmed clear returns the UI to a calm fresh-ready state without reopening the keyboard, and replace the text heading with the provided transparent DadPad logo lockup in a way that feels native to the Warm Sand shell.

## In Scope
- Replace the bare editor reset counter with a structured reset request that can dismiss the keyboard on confirmed clear
- Blur the active control, reset editor DOM state, and normalize app/window scroll after clear so the hero remains visible
- Keep the existing clear bottom-sheet UX and ready-state semantics while removing the post-clear autofocus regression
- Promote the transparent DadPad PNG into a tracked production asset and integrate it as the visible hero lockup
- Preserve semantic heading accessibility while using the image for the visible brand treatment
- Update regression coverage, rerun gates, and rebuild/install/launch on the connected iPad

## Out of Scope
- Any broader redesign of the Warm Sand shell
- Copy changes outside the existing heading/logo swap
- Changes to transform, share, settings, or setup behavior beyond the clear-reset stabilization

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `src/dadpad/useDadPadController.ts`
- `src/assets/`

## Stage Plan
1. Record the new spec handoff in `spec/00_overview.md` and `progress.md`.
2. Replace the bare editor reset counter with a reset request that can dismiss the keyboard on confirmed clear.
3. Normalize shell scroll/focus after clear so the hero remains visible on iPad.
4. Promote the DadPad PNG into a tracked asset and replace the visible heading text with the logo lockup.
5. Update tests, run browser smoke, and rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad-width browser smoke
- physical iPad rebuild/install/launch

## Exit Criteria
- Confirmed clear dismisses the keyboard and returns the app to a calm fresh-ready state
- The hero remains visible after clear and the shell no longer looks muddled on iPad
- The editor still resets text, selection, and scroll correctly after clear
- The visible hero heading is the transparent DadPad logo lockup, not a pasted rectangular block
- The heading remains semantically accessible as `DadPad`
