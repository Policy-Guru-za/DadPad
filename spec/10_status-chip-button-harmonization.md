# 10 Status Chip Button Harmonization

## Objective
Refine the live Warm Sand DadPad shell by moving visible readiness into the hero, removing the bottom status tile, harmonizing the secondary action buttons, and tightening the remaining button hierarchy.

## In Scope
- Add a compact top-right readiness chip with a green `Ready` state and a red error state
- Remove the bottom-row status tile and keep an intentional center spacer in the second action row
- Keep `Polish` unchanged while making `Clear`, `Copy`, and `Share` visually identical
- Give `Settings` / `Close settings` a distinct muted-stone system-button treatment
- Italicize the RCML strapline without changing its wording
- Update regression coverage, rerun gates, and rebuild/install/launch on the connected iPad

## Out of Scope
- Any controller/state-machine rewrite beyond what the view needs for the readiness chip
- Changes to provider/config logic
- Changes to the clear-sheet structure or setup-card flow
- Runtime theme switching or additional palette exploration

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`

## Stage Plan
1. Record spec handoff in `spec/00_overview.md` and `progress.md`.
2. Replace the bottom status tile with a hero readiness chip and an action-bar spacer.
3. Harmonize button styling so `Clear`, `Copy`, and `Share` share one secondary treatment while `Settings` gets its own system treatment.
4. Update tests for the chip, action layout, and strapline styling.
5. Run test/build/browser smoke and rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad-width browser smoke
- physical iPad rebuild/install/launch

## Exit Criteria
- DadPad shows a compact top-right readiness chip instead of a bottom status tile
- `Polish` is visually unchanged
- `Clear`, `Copy`, and `Share` are visually identical in the resting state
- `Settings` uses the new neutral system-button treatment
- The strapline is italicized and the bottom row remains `Share / spacer / Settings`
- Tests/build pass and the connected iPad is running the updated build
