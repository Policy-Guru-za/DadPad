# 20 Gmail Wordmark Button Refine

## Objective
Replace the current Gmail envelope icon in DadPad's dock with the supplied transparent Gmail wordmark PNG, while keeping the Gmail-first compose behavior unchanged and making the button fit look elegant on iPad.

## In Scope
- Promote the supplied Gmail wordmark PNG into tracked app assets
- Replace the current Gmail button image with the supplied wordmark
- Refine Gmail button sizing, containment, spacing, and disabled opacity
- Keep existing Gmail-first compose behavior and accessibility unchanged
- Run local gates and rebuild/install/launch on the connected iPad

## Out of Scope
- Any changes to generic `Share`
- Any changes to Gmail compose logic
- Any action-dock reordering
- Any prompt/provider changes

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Promote the supplied Gmail wordmark PNG into `src/assets/`.
2. Replace the current Gmail SVG import/render path with the new wordmark asset.
3. Refine the Gmail button fit so the mark stays centered, uncropped, breathable, and legible across enabled/disabled states.
4. Add or tighten regression coverage around the Gmail button render/accessibility contract.
5. Run `pnpm test`, `pnpm build`, then rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- physical iPad visual smoke

## Exit Criteria
- The bottom-right Gmail button shows the supplied full Gmail wordmark, not the old envelope icon
- The wordmark fits elegantly inside the button without crowding or cropping
- The button still exposes accessible name `Gmail` and preserves the same Gmail-first compose behavior
- `pnpm test` and `pnpm build` are green, and the refreshed build is installed/launched on the connected iPad
