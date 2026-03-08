# 18 Voice-Preserving Polish

## Objective
Recalibrate DadPad's visible `Polish` action so it keeps the writer's natural voice while fixing wording, grammar, and paragraphing, and only uses bullets when the meaning is naturally list-shaped or the source is already list-like.

## In Scope
- Rewrite the canonical `Polish` prompt contract around voice preservation instead of neutral-professional polish
- Update copied prompt reference docs so they match the shipped DadPad behavior
- Add prompt regression coverage for anti-drift, paragraphing, and restrained bullet usage
- Extend the live mode-eval harness with DadPad-specific voice-preservation fixtures and acceptance checks
- Run the relevant test/eval gates and record the new baseline

## Out of Scope
- New UI controls, new modes, or saved style profiles
- Per-user voice learning, memory, or examples uploaded by the user
- Provider/model changes
- Changes to streaming, placeholder protection, offline gating, or action-dock layout

## Dependencies
- `src/providers/openaiPrompting.ts`
- `src/providers/openai.test.ts`
- `scripts/eval-modes.ts`
- `SOT/PROMPT_PACK.md`
- `SOT/BLUEPRINT.md`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Close out spec `17` in the tracker and open spec `18`.
2. Replace `Polish`'s current neutral-professional/elegant steering with a voice-preserving cleanup contract.
3. Make paragraph cleanup explicit and bullet usage explicitly restrained in both the shipped prompt and the copied prompt reference docs.
4. Add anti-drift calibration lines so `Polish` avoids assistant-like phrases and business-email upgrades.
5. Extend prompt tests and `eval:modes` with DadPad-specific naturalness fixtures, including the Peter-email sample.
6. Run `pnpm test`, `pnpm build`, `pnpm eval:modes`, and `pnpm eval:structure`, then record the new green baseline.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm eval:modes`
- `pnpm eval:structure`

## Exit Criteria
- DadPad `Polish` is documented and implemented as “same person, just cleaner”
- The shipped prompt explicitly preserves natural tone, fixes wording/grammar/paragraphing, and limits bullets to naturally list-shaped content
- Prompt tests prove the old neutral-professional/elegant wording is gone
- `eval:modes` includes DadPad-specific voice-preservation checks and passes
- `pnpm test`, `pnpm build`, `pnpm eval:modes`, and `pnpm eval:structure` are green
