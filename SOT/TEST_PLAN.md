# TEST_PLAN.md

## Unit tests
- placeholder encode/decode/validate
- truncation heuristic (finish_reason and punctuation end-check)
- retry multiplier/cap logic

## Integration tests (mocked)
- streaming success for each mode
- cancel mid-stream (ensures editor restores original)
- protected token mismatch prevents overwrite
- rate limit error surfaces cleanly
- centralized prompt builder emits distinct instructions for each mode
- professional prompt forbids invented email scaffolding
- direct mode uses lower GPT-5 verbosity than the other rewrite modes

## Manual test cases
1. Dictated run-on paragraph -> Polish -> paragraphs + punctuation
2. Markdown link preserved: [x](https://example.com)
3. Inline code preserved: `npm run build`
4. Fenced code preserved
5. URLs/emails/IDs preserved exactly
6. Direct produces shorter output
7. Truncation -> warning + Retry (more room)
8. Copy disabled during streaming
9. `pnpm eval:modes` -> no identical normalized outputs across modes on corpus
10. `pnpm eval:modes` -> Direct shorter than Polish on >=80% eligible samples
11. `pnpm eval:modes` -> Professional adds no new greeting/sign-off/signature when absent
12. `pnpm eval:modes` -> Polish does not translate English inputs
