# PROVIDER_INTEGRATION.md

## Provider abstraction
All provider/API endpoint details must live inside provider clients (e.g. src/providers/openai.ts). UI must not know endpoints.

## OpenAI
- Default model: gpt-5-nano-2025-08-07 (as per PRD/BLUEPRINT)
- Endpoint selection (Responses vs Chat Completions) is owned by openai.ts.
- Streaming is required; stream text deltas into the UI buffer.
- Cancellation via AbortController.
- Errors mapped to user-safe messages (401, 429, timeout, network).

## Anthropic (Phase 0 optional)
If added, must match the same streaming + cancellation + error mapping behaviour.