# Spec `24_restore-single-polish`

## Objective
Remove the dedicated email-polish path and restore DadPad to a single `Polish` action, because the proven standard polish flow already works well for notes, emails, and letters.

## In Scope
- Restore the Warm Sand dock to one primary `Polish` button
- Remove the email-only controller routing and OpenAI rewrite mode
- Remove email-specific formatter/validation/retry modules plus their regressions and eval hooks
- Keep Notes and Gmail actions unchanged
- Update spec/progress tracking for the rollback to a single polish flow

## Out of Scope
- Gmail compose behaviour changes
- Notes shortcut behaviour changes
- New replacement actions in the dock
- Native iOS / Tauri shell changes
- Storage/config schema changes

## Dependencies
- Existing proven `polish` rewrite contract
- Existing DadPad controller and Warm Sand dock layout
- Existing test/build/eval script setup

## Stage Plan
1. Restore the dock and controller to a single `Polish` action
2. Remove the email-only rewrite mode, safeguards, tests, and eval coverage
3. Run local gates and smoke the updated dock in the browser preview

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm exec tsx -e "import('./scripts/eval-modes.ts').then(() => console.log('eval-modes import ok'))"`
- `pnpm exec tsx -e "import('./scripts/eval-structure.ts').then(() => console.log('eval-structure import ok'))"`

## Exit Criteria
- DadPad shows a single `Polish` button instead of separate notes/email polish actions
- The only rewrite path uses the existing proven `polish` mode
- Email-only formatter, validation, retry, and eval plumbing are removed
- Local gates are green, and browser smoke confirms the updated dock order
