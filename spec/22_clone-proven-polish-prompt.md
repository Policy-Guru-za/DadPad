# Spec `22_clone-proven-polish-prompt`

## Objective
Clone the proven `Polish` / `REFINE` prompt contract from `tmp/Prompt-templates` into DadPad so the live DadPad `Polish` button uses the same prompt wording and matching minimal GPT-5 request controls.

## In Scope
- `src/providers/openaiPrompting.ts` `polish` mode rules
- `src/providers/openaiPrompting.ts` GPT-5 request-control parity for `polish`
- Prompt tests and doc mirrors needed to keep shipped behavior aligned
- Spec/progress tracking for this prompt clone

## Out of Scope
- Provider/model swaps
- UI changes
- Storage/config changes
- iPad/native changes
- Broader eval-framework redesign

## Dependencies
- Existing DadPad OpenAI rewrite pipeline
- Source prompt templates under `tmp/Prompt-templates`

## Stage Plan
1. Diff DadPad `polish` prompt against `tmp/Prompt-templates`
2. Port the exact `polish` prompt wording and matching request-control behavior
3. Update tests/docs to match the cloned contract
4. Run local gates and record results

## Test Gate
- `pnpm test`
- `pnpm build`

## Exit Criteria
- DadPad `Polish` prompt matches the proven template wording
- `polish` no longer uses the recent stronger-sendability wording
- Prompt tests and docs reflect the cloned contract
- Local test/build gates are green
