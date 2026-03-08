# 11 Keyboard Dock And Surface Cleanup

## Objective
Refine the live Warm Sand shell so the full hero stays visible while typing, the bottom actions dock cleanly above the iPad keyboard, the footer surface artifact disappears, and the readiness chip reads clearly on-device.

## In Scope
- Split the shell into a fixed hero, a scrollable content region, and a dedicated bottom action dock
- Remove the footer gradient slab and replace the blanket disabled opacity with opaque per-variant disabled states
- Keep the existing action order and center spacer while making the dock feel stable with the keyboard open
- Brighten the ready chip dot with a chip-specific luminous green treatment
- Update regression coverage, rerun gates, and rebuild/install/launch on the connected iPad

## Out of Scope
- Any controller/state-machine rewrite
- Changes to transform, settings, clear, copy, or share behavior
- Copy changes or layout-order changes beyond the shell split required for keyboard stability

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `src/dadpad/useViewportShell.ts` if extra keyboard metrics are required

## Stage Plan
1. Record spec handoff in `spec/00_overview.md` and `progress.md`.
2. Move the footer actions out of the main scroll surface and dock them as a dedicated shell row.
3. Remove the footer slab and replace global disabled opacity with explicit variant-specific disabled styles.
4. Brighten the ready chip dot and keep the full hero visible during keyboard-open states.
5. Update tests, run browser smoke, and rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad-width browser smoke
- physical iPad rebuild/install/launch

## Exit Criteria
- The footer no longer paints a pale slab behind the left buttons
- The action bar docks directly above the keyboard instead of floating within the scroll surface
- The full hero remains visible while typing
- Disabled buttons stay opaque and legible
- The ready indicator dot reads as clearly bright green on-device
