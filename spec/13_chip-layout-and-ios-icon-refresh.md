# 13 Chip Layout And iOS Icon Refresh

## Objective
Restore the DadPad readiness chip to a compact inline chip beside the logo across iPad portrait widths, and refresh the bundled iOS app icon using the provided DadPad glyph on a soft ivory tile.

## In Scope
- Fix the responsive hero-header collapse that turns the readiness chip into a full-width banner on iPad portrait
- Keep the chip compact, content-sized, right-aligned, and ellipsized for long error text
- Preserve the current logo, strapline, bottom actions, and controller behavior
- Promote a new opaque square app-icon master under `src-tauri/icons/`
- Regenerate the bundled Tauri/iOS icon outputs and verify the refreshed iOS app icon assets
- Update regression coverage, rerun gates, and rebuild/install/launch on the connected iPad

## Out of Scope
- Any clear-flow, settings, share, or copy behavior changes
- Any redesign of the hero logo or app shell beyond the chip layout fix
- Any change to the chosen soft-ivory icon direction

## Dependencies
- `src/App.css`
- `src/App.m3.test.tsx`
- `src-tauri/icons/`
- `src-tauri/tauri.conf.json`

## Stage Plan
1. Record the new spec handoff in `spec/00_overview.md` and `progress.md`.
2. Adjust the hero responsive CSS so the chip stays inline on iPad portrait widths.
3. Generate a soft-ivory square app-icon master from the supplied DadPad glyph and regenerate the Tauri icon set.
4. Rebuild the iOS bundle and verify the refreshed app icon assets.
5. Run tests, browser smoke, and rebuild/install/launch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- iPad portrait browser smoke
- `pnpm tauri ios build --debug --open`
- physical iPad rebuild/install/launch

## Exit Criteria
- The readiness chip stays a small inline chip beside the logo on iPad portrait widths
- The readiness chip never expands into a full-width banner on iPad portrait
- Long error chip text truncates cleanly inside the compact chip
- The new iPad home-screen icon uses the supplied DadPad glyph on a soft ivory background
- Representative generated iOS icon assets are opaque and refreshed from the new source
