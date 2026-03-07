# 05 Clear Fresh-Start Reset

## Objective
Make `Clear` return DadPad to the same practical fresh-start state as a ready first launch, including status reset and native textarea reset behavior on iPad.

## In Scope
- Centralize the controller's resting status logic
- Replace `Clear`'s one-off success state with a transient clear message followed by resting status
- Reset textarea DOM state on confirmed clear so caret, selection, and scroll return to the top
- Add regression tests for status reset, DOM reset, and delayed-status safety

## Out of Scope
- Broader editor behavior changes outside confirmed clear
- Copy, Share, Cancel, Undo, or provider-flow behavior changes beyond protecting them from delayed clear reset
- New iPad shell or layout work

## Dependencies
- `src/dadpad/useDadPadController.ts`
- `src/App.tsx`
- `src/App.m3.test.tsx`
- Existing DadPad iPad shell proven in spec `04_physical-ipad-smoke`

## Stage Plan
1. Update spec/progress tracking for the clear-reset bug.
2. Refactor controller state so resting status is derived in one place and clear reset cannot clobber later states.
3. Wire the app view to remount/refocus/reset the textarea on confirmed clear.
4. Add regression coverage, run gates, and dogfood the clear flow locally.

## Test Gate
- `pnpm test`
- `pnpm build`
- Local dogfood of the clear flow after a long-text entry/reset path

## Exit Criteria
- Confirmed clear empties the editor and returns status to the same resting state DadPad should show when idle
- The textarea is reset to a new-start DOM state after confirmed clear
- Delayed clear status reset cannot overwrite a newer status
- Tests/build are green and `progress.md` records proof
