# PLACEHOLDERS_AND_VALIDATION.md

## Goal
Prevent trust-killing mutations (URLs, IDs, code, markdown structure) by protecting spans via placeholders.

## Placeholder format
__PZPTOK001__, __PZPTOK002__, ...

## Matching priority (structured first)
1. Markdown links: [text](url) as a single span
2. Fenced code blocks: ``` ... ``` as a single span
3. Inline code: `...` as a single span
4. URLs
5. Emails
6. Phone-like patterns
7. Long numeric/alphanumeric IDs
8. Currency amounts, dates/times (as needed)

## No-overlap rule
Once a span is protected, it must not be matched again. Subsequent matching operates on the remaining unprotected ranges only.

## Encode
- Scan text in priority order.
- Replace each matched span with next placeholder token.
- Store mapping token -> original span.

## Decode
- After model completion, replace placeholders with original spans.
- Decode/validate only once after streaming completes (do not decode per chunk).

## Validation
- Accept placeholders adjacent to punctuation/whitespace.
- Reject any altered placeholder body or numeric ID changes.
- If any placeholder is missing or corrupted:
  - do not overwrite editor
  - show warning: Protected content mismatch

## Examples
- Provide 3–5 examples of protected markdown/code/url/id cases.