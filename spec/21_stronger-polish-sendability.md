# 21 Stronger Polish Sendability

## Objective
Refactor DadPad's `Polish` prompt so sloppy real-world drafts come back clearer, better written, and more sendable, while still sounding like the same person on a good day.

## In Scope
- Strengthen `MODE_PROMPT_SPECS.polish`
- Bump GPT-5 reasoning effort for `polish` only
- Tighten prompt tests and mode evals around capitalization, ramble cleanup, and sendability
- Sync prompt mirrors in SOT docs
- Dogfood with ugly DadPad-style sample drafts

## Out of Scope
- Any changes to `casual`, `professional`, or `direct`
- Provider/model changes
- UI, iPad, storage, or architecture work
- `plainText.ts` heuristic rewrites unless the prompt-only pass clearly fails

## Dependencies
- `src/providers/openaiPrompting.ts`
- `src/providers/openai.test.ts`
- `scripts/eval-modes.ts`
- `SOT/PROMPT_PACK.md`
- `SOT/BLUEPRINT.md`

## Stage Plan
1. Replace the “minimal rewriting” `Polish` bias with stronger sendability rules.
2. Raise GPT-5 reasoning effort from `minimal` to `low` for `polish` only.
3. Tighten prompt tests and eval fixtures so sloppy drafts must come back capitalized, better structured, and less rambly without sounding corporate.
4. Run `pnpm test`, `pnpm build`, and dogfood with at least 3 ugly drafts.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm eval:modes` when API access is available

## Exit Criteria
- `Polish` no longer tells the model to rewrite minimally
- Sloppy drafts come back more coherent, capitalized, and sendable
- Output still feels human and meaning-preserving
- Tests and docs match the shipped prompt
