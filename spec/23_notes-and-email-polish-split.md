# Spec `23_notes-and-email-polish-split`

## Objective
Split the current `Polish` action into `Polish for notes` and `Polish for email`, keeping the existing notes-facing polish behaviour intact while adding a conservative British-style email formatter that only fixes mechanics and structure.

## In Scope
- Bottom action dock label/order update in the Warm Sand UI
- Controller routing for notes polish versus email polish
- A dedicated OpenAI email-formatting mode with strict structure-only instructions
- Post-transform safeguards that reject invented email content and restore the original text
- Regression coverage and eval updates needed for the new email path
- Spec/progress tracking for this work

## Out of Scope
- Gmail compose behaviour changes
- Notes shortcut behaviour changes
- Native iOS / Tauri shell changes
- Storage/config schema changes
- Broader prompt-system redesign outside the new email formatter path

## Dependencies
- Existing DadPad rewrite pipeline in `src/providers/openai.ts`
- Existing notes-facing `polish` prompt contract
- Existing placeholder protection / decode / validation flow

## Stage Plan
1. Remap the dock to `Polish for notes / Clear / Settings` then `Polish for email / Notes / Gmail`
2. Add a dedicated email formatter prompt and controller routing, preserving the current notes polish flow
3. Add structure-only email output validation and buffer email commits until final validation passes
4. Update regressions/evals and run the local gates

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm eval:modes`
- `pnpm eval:structure`

## Exit Criteria
- DadPad renders separate `Polish for notes` and `Polish for email` buttons in the dock
- `Polish for notes` still uses the current proven notes polish behaviour
- `Polish for email` rewrites into conservative British-style email structure without inventing greetings, sign-offs, subject lines, or new content
- Failed email validation restores the original text instead of committing unsafe output
- Local gates are green, or any external blocker is recorded in `progress.md`
