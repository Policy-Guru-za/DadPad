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

## Manual test cases
1. Dictated run-on paragraph -> Polish -> paragraphs + punctuation
2. Markdown link preserved: [x](https://example.com)
3. Inline code preserved: `npm run build`
4. Fenced code preserved
5. URLs/emails/IDs preserved exactly
6. Direct produces shorter output
7. Truncation -> warning + Retry (more room)
8. Copy disabled during streaming