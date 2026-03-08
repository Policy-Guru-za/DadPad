# 19 Gmail-First Email Action

## Objective
Keep DadPad's existing generic `Share` behavior for Notes and other apps, while adding a separate Gmail-first compose button that preserves paragraph breaks when sending the current draft into Gmail or the default mail app.

## In Scope
- Keep generic `Share` unchanged
- Add a new Gmail icon button in the current bottom-right dock slot
- Build a dedicated Gmail/email compose helper with Gmail-first then `mailto:` fallback
- Preserve paragraph breaks and blank lines in the outgoing email body
- Add regression coverage for the new button, helper behavior, and existing share behavior
- Rebuild/install/launch on the connected iPad

## Out of Scope
- Any prompt/provider changes
- Any Notes or generic share flow changes
- Subject-line generation
- Attachments, HTML email, or rich-text email compose

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/dadpad/useDadPadController.ts`
- `src/utils/share.ts`
- new Gmail/email helper under `src/utils/`
- `src/App.m3.test.tsx`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Close out spec `18` in the tracker and open spec `19`.
2. Add a Gmail icon asset and replace the current dock spacer with an icon-only Gmail button.
3. Keep generic `Share` untouched, but add a dedicated Gmail/email compose helper for the new button.
4. Normalize line endings for email compose, attempt Gmail deep link first, then fall back to `mailto:`.
5. Add tests for button layout, accessible name, Gmail-first open order, preserved paragraph encoding, and error handling.
6. Run `pnpm test`, `pnpm build`, then rebuild/install/launch on the connected iPad for physical Gmail/Share smoke.

## Test Gate
- `pnpm test`
- `pnpm build`
- physical iPad smoke for `Share` and Gmail compose

## Exit Criteria
- `Share` still opens the generic share sheet for Notes and other apps
- A new icon-only Gmail button is visible in the bottom-right dock slot with accessible label `Gmail`
- Gmail button attempts Gmail compose first, then `mailto:`
- Paragraphs remain intact in the outgoing Gmail/default-mail compose body
- `pnpm test` and `pnpm build` are green, and the updated app is rebuilt/installed/launched on the connected iPad
