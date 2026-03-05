# Napkin

## Corrections
- 2026-03-05 | self | Ran scaffold with `--force` at repo root and wiped `/SOT` before restoring from git | Never use `--force` scaffold at repo root; scaffold into temp dir or non-empty-safe flow only.
- 2026-03-05 | self | Initial streaming mock ignored `AbortSignal`, causing false cancel behavior during verification | For cancel tests, mock streams must observe `init.signal` and throw `AbortError` on abort.
- 2026-03-05 | self | Vitest mock failed because hoisted module factory referenced a class declared later | Keep mocked classes/functions inside `vi.hoisted` and reference through the hoisted object.
- 2026-03-05 | self | Used `apply_patch` through `exec_command` and triggered tool warning | Use the dedicated `apply_patch` tool directly for patch edits.

## User Preferences
- Strict gates: do not move past Gate A or Gate B without explicit approval.
- M2 scope fixed: OpenAI Responses API only, Polish button only, no token protection/config/encryption yet.
- User is the only one who commits changes; never auto-commit.

## Patterns That Work
- Verify streaming/cancel behavior with Playwright + abort-aware mocked SSE stream before claiming gate completion.
- Keep undo checkpoint in a ref that is written once at transform start and only cleared on undo/error/cancel.

## Patterns That Don't Work
- Mocking SSE without abort support makes cancel tests unreliable.

## Domain Notes
- Current app phase: M4 complete (Direct mode wired via streaming path with shorter output heuristic).
