# Napkin

## Corrections
- 2026-03-05 | self | Ran scaffold with `--force` at repo root and wiped `/SOT` before restoring from git | Never use `--force` scaffold at repo root; scaffold into temp dir or non-empty-safe flow only.
- 2026-03-05 | self | Initial streaming mock ignored `AbortSignal`, causing false cancel behavior during verification | For cancel tests, mock streams must observe `init.signal` and throw `AbortError` on abort.

## User Preferences
- Strict gates: do not move past Gate A or Gate B without explicit approval.
- M2 scope fixed: OpenAI Responses API only, Polish button only, no token protection/config/encryption yet.

## Patterns That Work
- Verify streaming/cancel behavior with Playwright + abort-aware mocked SSE stream before claiming gate completion.

## Patterns That Don't Work
- Mocking SSE without abort support makes cancel tests unreliable.

## Domain Notes
- Current app phase: M2 in progress (first functional Polish transform loop only).
