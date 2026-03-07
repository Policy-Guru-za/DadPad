# TEST_PLAN.md

> Legacy PolishPad reference only. For DadPad work, product scope and proof gates come from `SOT/DADPAD_BRIEF.md` plus the active execution spec; this file does not define DadPad product scope.

## Unit tests
- placeholder encode/decode/validate
- output budget heuristic by mode
- no-text budget expansion retry
- explicit length-stop fail-safe preserves original text instead of committing partial output
- smart structuring intent derivation (dense prose, multi-item asks, existing bullets, short messages)
- smart structuring whitespace normalization (blank lines, trailing spaces, bullet spacing)
- markdown intent derivation (paragraphs, lists, paths, URLs, code, constraints, attachments, section cues, visible-structure requirement)
- Markdown normalization + scaffold drift guard + insufficient-markdown guard
- settings normalization defaults missing `smartStructuring` to `true`

## Integration tests (mocked)
- streaming success for each mode
- cancel mid-stream (ensures editor restores original)
- protected token mismatch prevents overwrite
- rate limit error surfaces cleanly
- centralized prompt builder emits distinct instructions for each mode
- professional prompt forbids invented email scaffolding
- direct mode uses lower GPT-5 verbosity than the other rewrite modes
- smart structuring toggle passes through to provider requests
- smart structuring commit path preserves single blank lines and normalized bullet spacing
- tone transforms stay locked until the current text has been polished once
- tone transforms stay unlocked through normal edits and undo, and re-lock only on clear/full-content paste replacement
- Markdown stays locked until any successful transform completes for the current text session
- Markdown routes `Universal`, `Codex`, and `Claude` to distinct provider modes and updates footer mode text accordingly
- Markdown undo restores the prior rewritten text exactly
- Markdown uses the Markdown-safe postprocessor, rejects unsupported scaffold drift, and retries/fails safe on prose-only near-no-op output
- no truncation warning or retry button is shown in the UI

## Manual test cases
1. Dictated run-on paragraph -> Polish -> paragraphs + punctuation
2. Markdown link preserved: [x](https://example.com)
3. Inline code preserved: `npm run build`
4. Fenced code preserved
5. URLs/emails/IDs preserved exactly
6. Direct produces shorter output
7. Explicit provider length stop -> original text restored, clear error shown, no retry control
8. Copy disabled during streaming
9. `pnpm eval:modes` -> no identical normalized outputs across modes on corpus
10. `pnpm eval:modes` -> Direct shorter than Polish on >=80% eligible samples
11. `pnpm eval:modes` -> Professional adds no new greeting/sign-off/signature when absent
12. `pnpm eval:modes` -> Polish does not translate English inputs
13. `pnpm eval:structure` -> dense prose expands into multiple paragraphs on >=90% of eligible outputs
14. `pnpm eval:structure` -> multi-item asks become bullets on >=80% of eligible Direct/Professional outputs
15. `pnpm eval:structure` -> short/simple messages are not over-formatted
16. `pnpm eval:structure` -> existing bullets remain bullets and protected tokens remain exact
17. Polish → Markdown (Universal) -> visibly structured raw Markdown, no meta-wrapper, no fixed scaffold headings
18. Polish → Markdown (Codex) -> same task in visibly structured repo-friendly Markdown with grounded headings/bullets, no invented repo scaffolding
19. Polish → Markdown (Claude) -> same task in visibly structured Markdown with clearer requirements/questions separation, no invented scaffold
20. Markdown preserves file paths, URLs, code fences, quoted text, and explicit constraints exactly
21. Markdown rejects unsupported scaffold drift and restores original text
22. Markdown retries once internally when a qualifying prompt comes back as prose-only near-no-op output, then fails safe if still insufficient
23. `pnpm eval:agent-prompts` -> referenced tokens remain exact, unsupported meta-scaffold drift fails, non-trivial prompts produce visible Markdown syntax, presets show at least some bias across corpus
