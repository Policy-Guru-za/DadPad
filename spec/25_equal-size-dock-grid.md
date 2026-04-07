# Spec `25_equal-size-dock-grid`

## Objective
Reposition the Warm Sand dock so `Notes` sits directly under `Polish`, `Gmail` sits directly under `Clear`, and every visible dock button keeps the same footprint.

## In Scope
- Update the dock grid layout for the primary iPad viewport
- Keep the five visible actions equal-sized across supported responsive breakpoints
- Preserve existing button order, handlers, labels, and styling treatments
- Validate locally, smoke the dock visually, then rebuild/reinstall on the physical iPad

## Out of Scope
- Prompt or controller behaviour changes
- Notes or Gmail action logic changes
- Any new dock actions
- Native shell/config changes unrelated to shipping the refreshed build

## Dependencies
- Existing Warm Sand dock in `src/App.css`
- Existing DadPad action-bar regression coverage
- Existing iOS build/install path

## Stage Plan
1. Update the CSS grid so `Notes` occupies the lower-left cell and `Gmail` the lower-middle cell with equal button sizing
2. Refresh any affected regressions and run local validators
3. Smoke the dock in preview, then create a clean iOS build and reinstall on the connected iPad

## Test Gate
- `pnpm test`
- `pnpm build`
- Browser preview smoke for the dock layout
- Clean iOS rebuild + reinstall on the physical iPad

## Exit Criteria
- On the main iPad layout, `Notes` is directly under `Polish`
- On the main iPad layout, `Gmail` is directly under `Clear`
- Visible dock buttons share the same size
- Local gates pass and the refreshed build is installed/launched on the physical iPad
