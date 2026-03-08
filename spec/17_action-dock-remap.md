# 17 Action Dock Remap

## Objective
Move `Settings` into the top-row third slot and move `Copy` into the second-row center slot directly beneath `Clear`, while preserving all current button behavior and styling.

## In Scope
- Remap the visible action-bar layout for iPad/desktop widths
- Keep the current button variants and interactions intact
- Update narrow-width fallback ordering so it stays logical
- Add regression coverage for the new visible order
- Rebuild, verify, and relaunch on the connected iPad
- Update spec/progress tracking

## Out of Scope
- Any controller/state changes
- Any button style redesign
- Any copy, spacing-system, or shell-structure redesign beyond layout remapping

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Close out spec `16` in the tracker and open spec `17`.
2. Reorder the action-bar markup so the accessible/DOM order matches the requested visible order.
3. Update the grid template so iPad/desktop shows `Polish / Clear / Settings` then `Share / Copy / spacer`.
4. Update the 2-column and 1-column fallbacks so they degrade in the order `Polish`, `Clear`, `Settings`, `Share`, `Copy`.
5. Add regression coverage for the new order and existing button behavior.
6. Run `pnpm test`, `pnpm build`, browser smoke, then rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke for iPad-width and narrow-width action ordering
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject`
- physical iPad install/launch

## Exit Criteria
- iPad/desktop action layout is `Polish / Clear / Settings` then `Share / Copy / spacer`
- `Copy` sits directly beneath `Clear`
- `Settings` occupies the old top-row third slot and still toggles `Settings` / `Close settings`
- `pnpm test` and `pnpm build` are green, browser smoke is green, and the updated app is rebuilt/installed/launched on the connected iPad
