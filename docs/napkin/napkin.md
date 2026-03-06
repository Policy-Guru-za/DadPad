# Napkin

## Corrections
- 2026-03-05 | self | Ran scaffold with `--force` at repo root and wiped `/SOT` before restoring from git | Never use `--force` scaffold at repo root; scaffold into temp dir or non-empty-safe flow only.
- 2026-03-05 | self | Initial streaming mock ignored `AbortSignal`, causing false cancel behavior during verification | For cancel tests, mock streams must observe `init.signal` and throw `AbortError` on abort.
- 2026-03-05 | self | Vitest mock failed because hoisted module factory referenced a class declared later | Keep mocked classes/functions inside `vi.hoisted` and reference through the hoisted object.
- 2026-03-05 | self | Used `apply_patch` through `exec_command` and triggered tool warning | Use the dedicated `apply_patch` tool directly for patch edits.
- 2026-03-05 | self | Trimmed `response.output[].content[].text` fragments while assembling non-stream output, collapsing spaces/newlines | Never trim model text fragments during assembly; preserve chunk bytes exactly and add regression test.
- 2026-03-06 | self | Reordered placeholder matchers without tightening `phone`, which caused date-shaped fragments (e.g. `2026-03-05`) to be classified as phones and blocked `id` protection | Keep phone/id before date/time, but constrain phone regex (min digit count and date-shape avoidance) to prevent overlap regressions.
- 2026-03-06 | self | Added a new persisted settings field without accounting for old encrypted configs; serde would have treated missing field as a full config decode failure and reset user settings | Any new field in `src-tauri/src/config.rs` needs an explicit serde default/backward-compat test before shipping.
- 2026-03-06 | self | Ran smart-structuring cleanup after placeholder decode and used punctuation-only truncation checks, which mutated protected code/list content and falsely flagged completed bullet lists | Normalize structured text before placeholder decode, keep list-marker cleanup stricter than decimal/version prefixes, and treat completed list items as natural endings in truncation heuristics.
- 2026-03-06 | self | Root `.gitignore` pattern `Icon?` matched `src-tauri/icons` on this macOS setup, so regenerated bundle icons stayed invisible to git | When touching app icons, explicitly unignore `src-tauri/icons/**` and re-ignore `.DS_Store` so bundle assets are actually reviewable.
- 2026-03-06 | self | Tried to prove full-text keyboard replacement via `fireEvent.beforeInput`, but jsdom/RTL did not expose a reliable textarea `beforeinput` helper and the regression stayed invisible | For textarea whole-selection replacement tests here, drive a `select` event plus `input` change and keep a selection ref in the component instead of relying on `beforeinput` alone.

## User Preferences
- Strict gates: do not move past Gate A or Gate B without explicit approval.
- M2 scope fixed: OpenAI Responses API only, Polish button only, no token protection/config/encryption yet.
- User is the only one who commits changes; never auto-commit.

## Patterns That Work
- Verify streaming/cancel behavior with Playwright + abort-aware mocked SSE stream before claiming gate completion.
- Keep undo checkpoint in a ref that is written once at transform start and only cleared on undo/error/cancel.
- Treat provider `result.outputText` as canonical at completion; streamed deltas are preview-only and can diverge on terminal fallback paths.
- Placeholder tokens must skip literal `__PZPTOK###__` strings already present in source text, and validation must require exactly one occurrence per token.
- OpenAI Responses streams can deliver final text via `response.output_text.done`, `response.content_part.done`, or `response.output_item.done`; do not assume only delta events or a populated `response.completed.response.output`.
- OpenAI Responses streaming needs indexed assembly by `output_index` and `content_index`; a longest-snippet fallback drops multi-part output and can ignore authoritative final `...done` text.
- Live OpenAI repro with saved `gpt-5-nano-2025-08-07` settings: first request is rejected for unsupported `temperature`, retry can return `response.incomplete(max_output_tokens)` after emitting only a reasoning item and zero user-visible text; GPT-5 rewrite requests need minimal reasoning spend and explicit no-text incomplete handling.
- Live OpenAI repro also showed `Mode: POLISH` is ambiguous for `gpt-5-nano`; without an explicit anti-translation instruction the model can translate into Polish instead of polishing the existing language.
- Live mode probes with `gpt-5-nano-2025-08-07`: mode wiring is correct, but weak prompt separation makes Casual/Professional/Direct collapse into near-identical rewrites on some inputs; Professional also tries to invent email scaffolding unless the prompt forbids it.
- For the polish button, the provider prompt should avoid the literal label `Mode: POLISH`; use an unambiguous internal label like `Mode: REFINE` or the model may still translate into Polish even when told not to.
- A live corpus gate (`pnpm eval:modes`) catches prompt collapse that unit tests miss; short and already-clean workplace inputs need explicit lexical preferences and request/follow-up handling or the modes collapse back together.
- Utility scripts that can run from env overrides should treat unreadable `~/.polishpad` config as a warning and fall back to env/defaults instead of aborting.
- Structure evaluation is only trustworthy if it mirrors the app path: placeholder encode -> provider rewrite -> decode/validate -> local whitespace normalization. Raw provider-only checks miss real commit behavior.
- Tauri icon generation is safest via a repo-local temp output first; it emits extra iOS/Android assets by default, so copy only the required `src-tauri/icons` files into the bundle directory.
- For spec-driven visual reskins that remove visible status UI but forbid logic churn, replace the old setter with a typed no-op and update tests to assert on stable UI invariants (editor content, warnings, button state) instead of transient footer copy.

## Patterns That Don't Work
- Mocking SSE without abort support makes cancel tests unreliable.

## Domain Notes
- Current app phase: M4 complete (Direct mode wired via streaming path with shorter output heuristic).
