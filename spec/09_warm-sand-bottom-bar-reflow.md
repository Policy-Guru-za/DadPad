# 09 Warm Sand Bottom Bar Reflow

## Objective
Adopt the Warm Sand palette in the production DadPad app and remap the visible controls into the new 3x2 bottom action grid without changing the overall shell structure.

## In Scope
- Apply the Warm Sand color system from the approved preview to the live app
- Remove the hero eyebrow and replace the hero sentence with the new RCML copy
- Move the settings toggle into the bottom action bar and rename it `Settings` / `Close settings`
- Remove the visible top status banner and replace it with a passive bottom-row status tile
- Remove visible `Cancel` and `Undo` controls while leaving their controller logic intact
- Rebalance spacing so the revised shell feels clean on iPad and desktop
- Rebuild and relaunch on the connected iPad after gates pass

## Out of Scope
- Any new menu for hidden actions
- Changes to transform/provider logic
- Changes to setup-card structure or clear-sheet behavior
- New runtime theme switching

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`

## Stage Plan
1. Update docs/progress for the Warm Sand production refit.
2. Refactor the app shell to remove the top status strip, relocate controls, and add the passive status tile.
3. Replace the app palette and spacing with the Warm Sand production theme.
4. Update regression coverage for the new control set and layout copy.
5. Run test/build/browser smoke and rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad-width browser smoke
- physical iPad rebuild/install/launch

## Exit Criteria
- DadPad uses the Warm Sand production palette
- The visible controls render as `Polish / Clear / Copy` then `Share / Status / Settings`
- The top status banner and top-right API key button are gone
- The new hero sentence matches the requested copy exactly and the eyebrow is removed
- Tests/build pass and the connected iPad is running the updated build
