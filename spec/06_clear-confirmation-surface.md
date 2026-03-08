# 06 Clear Confirmation Surface

## Objective
Replace the `window.confirm`-based clear gate with an in-app confirmation flow that works reliably on the physical iPad build.

## In Scope
- Remove JS confirm from the clear flow
- Add an in-app confirmation surface for `Clear`
- Keep the confirmed clear reset behavior from spec `05`
- Add regression coverage for the new confirm surface and iPad-safe flow

## Out of Scope
- Broader modal/dialog infrastructure
- Other destructive actions
- Further editor reset changes outside the clear entry path

## Dependencies
- `src/dadpad/useDadPadController.ts`
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`

## Stage Plan
1. Replace `window.confirm` with controller-managed clear confirmation state.
2. Render an in-app confirmation surface and lock conflicting actions while it is open.
3. Update tests for the new flow and rerun gates.
4. Rebuild/install on iPad for user verification.

## Test Gate
- `pnpm test`
- `pnpm build`
- Rebuild/install on the connected iPad

## Exit Criteria
- Tapping `Clear` no longer immediately yields `Clear cancelled.` on iPad
- User can explicitly choose `Keep text` or `Clear now`
- Confirmed clear still performs the full fresh-start reset from spec `05`
- Tests/build are green and the iPad app is rebuilt from the updated code
