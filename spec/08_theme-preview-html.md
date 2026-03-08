# 08 Theme Preview HTML

## Objective
Create five standalone HTML mockups that let the user compare DadPad color themes visually in a browser before choosing one for the app.

## In Scope
- Add five self-contained HTML files under `design/theme-previews/`
- Keep the current DadPad layout and component structure intact
- Vary only color tokens across the five mockups
- Show both the ready state and the clear-confirmation bottom-sheet state in each file
- Verify the mockups render directly in a browser without build tooling

## Out of Scope
- Any React, Tauri, Rust, or production CSS changes
- Layout, typography, spacing, or component-behavior redesign
- Theme-selection logic or runtime switching inside the app
- Screenshot export or design handoff assets beyond the HTML files

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `design/theme-previews/`

## Stage Plan
1. Capture the current DadPad shell structure and token model from the live app styles.
2. Build one standalone HTML template that mirrors the shell and includes ready-state plus clear-sheet previews.
3. Duplicate it into five theme variants with palette-only changes and cross-links between files.
4. Smoke the files locally in a browser at desktop and iPad-like widths.

## Test Gate
- Open each file in a browser without build tooling
- Verify the five themes render with identical structure and distinct palettes
- Confirm ready-state and clear-sheet previews both remain readable at desktop and iPad-like widths

## Exit Criteria
- Exactly five standalone HTML files exist under `design/theme-previews/`
- Each file opens directly in a browser and renders without external assets or dependencies
- All five files preserve the same DadPad layout while showcasing different elder-friendly color themes
