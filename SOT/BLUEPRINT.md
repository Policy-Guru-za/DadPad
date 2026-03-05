# Implementation Blueprint — PolishPad V1

**Framework:** Tauri (Rust shell + TypeScript/React frontend)
**Architecture:** Frontend calls LLM APIs directly. Rust handles windowing only.
**Default provider:** OpenAI (shipped default model: `gpt-5-nano-2025-08-07`)

---

## 1) Technical architecture

### Components

**Tauri frontend (TypeScript/React):**

- Text editor component
- Toolbar (transform buttons + Copy)
- Status bar (word count, char count, mode, latency, warnings)
- Settings UI
- Streaming render logic
- Undo management
- LLM provider clients (OpenAI, Anthropic)
- Token protection (placeholder encode/decode/validate)
- Output validation (truncation detection)

**Tauri backend (Rust — minimal in V1):**

- App windowing and lifecycle
- Tauri bridge with two custom commands: `read_config` and `write_config` for encrypted config
- No other custom commands in V1

### Why frontend-first

For a private utility tool used by one person, calling LLM APIs directly from the frontend is the fastest path to a working product. API keys are stored locally and never leave the machine. The Rust backend adds no security benefit in this context until the app is distributed. Migrate API logic to Rust sidecar in Phase 1 before any distribution.

---

## 2) Data flows

### Transform flow (happy path)

1. User clicks a mode button (e.g., Polish).
2. UI checks input size: if >~80,000 characters, show hard-stop message and abort. If >~20,000 characters, show warning but allow proceed.
3. UI snapshots current editor text into undo buffer.
4. UI sets editor to read-only and shows streaming indicator.
4. Frontend applies placeholder encoding to the text (if token protection enabled).
5. Frontend constructs prompt: system prompt + mode snippet + wrapped user text.
6. Frontend calls provider API with streaming enabled.
7. As chunks arrive: append to stream buffer, render progressively in editor.
8. On stream completion: check finish reason for truncation. Decode placeholders. Validate placeholder restoration.
9. If validation passes: commit final text to editor, re-enable editing, show latency and mode in status bar.
10. If validation fails: revert to undo snapshot, show warning ("Protected tokens could not be restored — original text preserved"), optionally show model output for manual review.
11. User edits as needed.
12. User clicks Copy → clipboard write → brief confirmation in status bar.

### Failure flow

Any failure (network, auth, timeout, parse error) triggers: show error banner, keep original text in editor (undo snapshot is untouched), re-enable editing.

### Cancel flow

User clicks Cancel during streaming: abort the request, revert to undo snapshot, clear stream buffer, re-enable editing, show "Cancelled" in status bar.

---

## 3) Project structure

```
polishpad/
  src-tauri/
    src/
      main.rs              # Tauri app entry, minimal config
      config.rs            # Read/write encrypted local config (API keys, settings)
    tauri.conf.json
    Cargo.toml
  src/
    App.tsx                # Root component
    components/
      Editor.tsx           # Main text editor (textarea or rich text)
      Toolbar.tsx          # Transform buttons + Copy
      StatusBar.tsx        # Word count, char count, mode, latency, warnings
      Settings.tsx         # Provider, model, temperature, toggles
    hooks/
      useTransform.ts      # Transform state machine, streaming, undo
      useSettings.ts       # Settings state and persistence
    llm/
      types.ts             # Shared types (TransformMode, ProviderConfig, etc.)
      openai.ts            # OpenAI streaming client
      anthropic.ts         # Anthropic streaming client
      prompts.ts           # System prompt, mode snippets, user wrapper
    protect/
      placeholders.ts      # Encode, decode, validate protected tokens
    utils/
      text.ts              # Word count, char count, truncation check
      clipboard.ts         # Copy to clipboard
    types.ts               # App-wide types
  package.json
  tsconfig.json
```

All LLM logic lives in `src/llm/`. All token protection lives in `src/protect/`. Provider logic is completely separate from UI components.

---

## 4) Settings and key storage

### Settings fields

- `provider`: `"openai" | "anthropic"` (default: `"openai"`)
- `model`: `string` (default: `"gpt-5-nano-2025-08-07"`; set in provider client code, e.g., `openai.ts` exports `DEFAULT_MODEL`)
- `temperature`: `number` (default: `0.2`)
- `streaming`: `boolean` (default: `true`)
- `token_protection`: `boolean` (default: `true`)
- `protect_structured_content`: `boolean` (default: `true`; sub-toggle of token_protection; controls whether markdown links and code blocks are protected)

### Secrets

- `openai_api_key`: `string` (optional)
- `anthropic_api_key`: `string` (optional)

### Storage (V1)

Encrypted local config file managed by the Rust backend. The Rust side exposes two commands: `read_config` and `write_config`.

**Encryption approach:** On first run, generate a cryptographically random 256-bit key. Store this key in a separate file (`~/.polishpad/encryption.key`) with restricted file permissions set at creation time (not chmod after). Use this key to encrypt/decrypt the config file (AES-256-GCM or equivalent). The config file itself lives at `~/.polishpad/config.enc`. All file writes are atomic: write to a temporary file, then rename to the target path. This prevents partial writes from corrupting config or key files.

Not macOS Keychain (deferred to Phase 1). Not machine-ID derivation (fragile across OS reinstalls and hardware changes).

### Guardrails

- No logging of prompts or outputs.
- No storing user text anywhere.
- DevTools should not dump config by default (disable DevTools in release builds).

---

## 5) Provider integration

### Common strategy

- Single request per button press.
- Streaming enabled by default.
- Request timeout: 30 seconds. UI shows "still working..." after 5 seconds without chunks.
- Model name is always configurable. Ship with a sensible default, allow override.

### OpenAI

- Default model: `gpt-5-nano-2025-08-07` (pinned snapshot). GPT-5 nano is OpenAI's fastest, cheapest GPT-5 variant — $0.05/$0.40 per 1M tokens, 400k context window, 128k max output tokens. Supports both Chat Completions (`/v1/chat/completions`) and Responses (`/v1/responses`) endpoints, plus streaming and structured outputs.
- Endpoint: use the currently recommended API for the chosen model (Chat Completions or Responses API). Implemented behind `openai.ts` so endpoint changes require only a client-level update, not a UI change.
- Build messages array: system message (base prompt + mode snippet) + user message (wrapped text).
- Streaming: consume SSE stream, parse `data:` lines, extract content deltas.
- On final chunk: read `finish_reason`. If `"length"`, flag truncation.
- Cancellation: use `AbortController` on the frontend fetch call.

### Anthropic

- Endpoint: `https://api.anthropic.com/v1/messages`
- Build request: system field (base prompt + mode snippet) + messages array with user content (wrapped text).
- Streaming: consume SSE stream, parse `content_block_delta` events, extract `delta.text`.
- On final message: read `stop_reason`. If `"max_tokens"`, flag truncation.
- Cancellation: use `AbortController` on the frontend fetch call.

---

## 6) Prompt pack

### Base system prompt

```
You are a rewriting engine. Rewrite the user's text according to the requested mode.

Non-negotiable constraints:
- Preserve the original meaning, facts, and intent. Do not invent new information.
- Keep the approximate length unless the mode explicitly asks for brevity. Light tightening is allowed; modest lengthening is allowed if it improves clarity and flow.
- Preserve exactly (character-for-character) any: names, numbers, dates, times, currency amounts, percentages, addresses, URLs, email addresses, phone numbers, order/reference IDs, and quoted text.
- Fix grammar, spelling, punctuation, and paragraphing.
- Break up run-on sentences. Use natural paragraph breaks.
- Remove obvious filler words (e.g., "um", "uh", "like", "you know") and unintentional verbatim repetition.
- Homophones / wrong-word fixes: only change a word if the intended meaning is highly confident from context. If uncertain, leave it unchanged.
- Output only the rewritten text. No preamble, no labels, no explanations.

If the input contains multiple distinct topics, keep them separated with clear paragraphs.
Do not alter any placeholder tokens of the form __PZPTOK###__. Reproduce them exactly as they appear.
```

### Mode snippets

**POLISH:**

```
Mode: POLISH
Rewrite into a clear, elegant, well-structured version suitable for general professional communication.
Actively improve sentence structure and paragraph flow.
It should read like a competent human wrote it carefully, not like a transcript.
Preserve the original level of assertiveness.
Keep approximate length: you may slightly tighten, and you may modestly expand if it makes the writing more elegant or easier to read.
```

**CASUAL:**

```
Mode: CASUAL
Rewrite to sound casual, friendly, and conversational.
Use a relaxed tone and contractions where natural.
Keep it clean and readable (not slangy, not childish).
Keep approximate length; light tightening allowed.
```

**PROFESSIONAL:**

```
Mode: PROFESSIONAL
Rewrite to sound professional, neutral, and polished for a workplace email.
Clear, calm, and well-structured.
Not stiff and not overly verbose.
Keep approximate length; light tightening allowed.
```

**DIRECT:**

```
Mode: DIRECT
Rewrite to be concise and direct.
Prefer short sentences.
Remove filler and softening language that doesn't add meaning.
Make requests and next steps explicit.
Use bullet points when it improves clarity.
Shorten meaningfully, but do not remove essential information.
```

### User message wrapper

```
Rewrite the text below.

[BEGIN TEXT]
{TEXT}
[END TEXT]
```

---

## 7) Token protection (placeholder design)

### What to protect

- URLs: `https?://\S+`
- Email addresses: standard email pattern
- Phone-like patterns: sequences with digits, dashes, parens, plus signs
- Long numbers/IDs: ≥6 digit sequences, alphanumeric IDs with mixed letters and numbers
- Currency patterns: R, $, £, €, ¥ followed by number patterns
- Date/time patterns: common date formats (DD/MM/YYYY, YYYY-MM-DD, etc.), time patterns (HH:MM)
- Markdown links: `[text](url)` — protect the entire construct as a single span to avoid bracket/paren breakage (only when `protect_structured_content` is enabled)
- Inline code: backtick-delimited segments (`` `...` ``) — preserve verbatim (only when `protect_structured_content` is enabled)
- Fenced code blocks: triple-backtick blocks (``` ``` ```) — preserve verbatim (only when `protect_structured_content` is enabled)

**Priority order:** Match markdown links and code blocks first (they may contain URLs or other patterns that would otherwise match individually). Once a span is protected, it is removed from subsequent matching — no overlapping replacements.

### Encode

Scan input text with regex matchers for each category in priority order. After each match, mark the matched character range as consumed so no subsequent pattern can match within it. Replace each match with a numbered placeholder token: `__PZPTOK001__`, `__PZPTOK002__`, etc. Store the ordered mapping: `{ "001": "https://example.com", "002": "ryan@email.com", ... }`.

The placeholder format is designed to be unlikely to appear in natural text and easy for the model to leave untouched. The system prompt includes a one-line instruction to not alter placeholders of this form.

### Decode

After receiving model output, replace each placeholder with the original value from the mapping.

### Validate

Confirm every placeholder from the mapping appears in the model output. During validation, apply a normalisation step: accept placeholders that are surrounded by punctuation or whitespace (the model may add a period or comma after a placeholder), but reject any token where the numeric ID or the `__PZPTOK` body has been altered (e.g., spaces inserted, underscores changed, ID number modified).

If any placeholder is missing or altered after normalisation:

- Set error state: `PROTECTED_TOKEN_MISMATCH`.
- Do not overwrite the editor. Revert to undo snapshot.
- Show warning in status bar: "Protected content could not be restored — original text preserved."
- Optionally: show model output in a temporary modal for manual inspection (V1 can simply warn and revert).

---

## 8) Streaming strategy

**Committed approach:** Stream directly into the editor (Option B). Editor is read-only during streaming.

### Implementation

Maintain two buffers:

- `undoSnapshot`: the editor text captured before the transform started. Immutable until the next transform.
- `streamBuffer`: accumulates incoming chunks. Rendered progressively into the editor.

On stream start: capture `undoSnapshot`, clear editor, set editor to read-only, begin rendering chunks as they arrive.

On stream complete: run placeholder decode and validation **only once on the fully accumulated `streamBuffer`** — never decode per-chunk (partial placeholder tokens may span chunk boundaries, causing false validation failures). If valid, commit `streamBuffer` as the new editor content and re-enable editing. If invalid, revert to `undoSnapshot`.

On cancel: abort request, revert to `undoSnapshot`, clear `streamBuffer`, re-enable editing.

---

## 9) Output length controls

### Dynamic max tokens heuristic

Estimate input tokens roughly: `inputTokens ≈ characterCount / 4`.

- Polish, Casual, Professional: `maxOutputTokens = Math.round(inputTokens * 1.3) + 128`
- Direct: `maxOutputTokens = Math.round(inputTokens * 0.8) + 96`

### Truncation post-check

After receiving the complete response:

1. Check provider finish reason. If `finish_reason === "length"` (OpenAI) or `stop_reason === "max_tokens"` (Anthropic): flag as likely truncated.
2. If finish reason is normal but the output does not end with a natural sentence terminator (`.`, `?`, `!`, `…`, or a closing quote/paren immediately after one of these): flag as possibly truncated.
3. On flag: show warning in status bar with a one-click "Retry (more room)" action. The retry reruns the same mode with `maxOutputTokens * 1.5` (capped at 8192). Do not suppress the output — let the user decide whether to retry or use it as-is.

---

## 10) UI state machine

### States

- `Idle` — editor editable, transform buttons enabled, copy enabled.
- `Transforming(mode)` — editor read-only showing streamed output, transform buttons disabled, copy disabled (prevents accidental copy of partial output), cancel enabled.
- `Error(message)` — error banner visible, editor editable (contains original text), transform buttons enabled, copy enabled.
- `Done(latencyMs, mode, warnings?)` — editor editable with transformed text, transform buttons enabled, copy enabled, status bar shows mode + latency + any warnings.

### Transitions

- `Idle` → `Transforming(mode)` — on transform button click.
- `Transforming` → `Done` — on successful stream completion.
- `Transforming` → `Error` — on failure.
- `Transforming` → `Idle` — on cancel (reverts to original).
- `Error` → `Idle` — on next user action (dismiss banner).
- `Done` → `Transforming(mode)` — on another transform button click.
- Any state → `Idle` — on undo (restores pre-transform text).

---

## 11) Testing plan

### Unit tests (TypeScript)

- Placeholder encode/decode/validate: round-trip for URLs, emails, numbers, currency, dates, markdown links, inline code, fenced code blocks, and mixed content.
- Placeholder normalisation: verify acceptance of placeholders with adjacent punctuation, rejection of placeholders with altered IDs or body.
- Prompt assembly: correct system prompt (including placeholder instruction) + mode snippet + user wrapper for each mode.
- Truncation detection: finish reason parsing, punctuation heuristic.
- Output length heuristic: correct max tokens calculation for each mode, including retry multiplier.
- Text utilities: word count, char count.

### Integration tests

- Transform call returns output for sample inputs across all four modes (use recorded API response mocks).
- Protected tokens preserved through full encode → LLM → decode pipeline (mocked).
- Failure modes: 401 (auth), timeout, network down — verify editor text is preserved and error is shown.
- Cancel during stream: verify revert to original text.

### Manual test suite

- Dictated run-on paragraph → Polish → verify paragraphs and punctuation.
- Homophone cases ("there/their/they're", "your/you're") → verify only confident corrections.
- Text with URLs, email addresses, phone numbers, reference IDs → verify untouched after transform.
- Text with markdown links (`[text](url)`) → verify entire construct preserved.
- Text with inline code and fenced code blocks → verify preserved verbatim.
- Long email with action items → Direct → verify meaningful shortening with bullets.
- Same input → Casual vs Professional → verify distinct tone.
- Very long input (1000+ words) → verify truncation warning shown if needed, and "Retry (more room)" works.
- Empty input → verify graceful handling (no API call, show message).

---

## 12) Packaging and distribution (macOS)

- Build signed and notarised app via Tauri's macOS build pipeline.
- Distribute as `.dmg` or `.zip`.
- Permissions are minimal: no accessibility, no microphone, no network entitlement issues (standard HTTPS).
- Disable DevTools in release builds.

---

## 13) Build sequence

### Step 1 — App shell + editor + toolbar + status bar

Tauri window with a textarea editor, four transform buttons (Polish, Casual, Professional, Direct), a Copy button, and a status bar showing word count and character count. Buttons are wired but non-functional. Copy works immediately (copies editor contents to clipboard with brief confirmation).

**Deliverable:** Running Tauri app with editable text area, working copy, live word/char counts.

### Step 2 — Transform pipeline (Polish, streaming, OpenAI)

Implement `src/llm/openai.ts` with streaming client. Implement `src/llm/prompts.ts` with base system prompt and Polish mode snippet. Wire the Polish button: on click, call OpenAI with streaming, render chunks into editor (read-only during stream). Show latency on completion.

**Deliverable:** Polish button works end-to-end with streaming output.

### Step 3 — Undo + Cancel

Implement undo snapshot: capture editor text before each transform. Wire Undo button (or keyboard shortcut). Implement Cancel: abort in-flight request, revert to snapshot. Verify that on any failure, original text is preserved.

**Deliverable:** User can always recover pre-transform text. Cancel works during streaming.

### Step 4 — Direct mode

Add Direct mode snippet to `prompts.ts`. Wire the Direct button with the same pipeline. Verify distinct behaviour (shorter output, bullets where appropriate). Adjust max output tokens heuristic for Direct.

**Deliverable:** Two working modes with distinct output characteristics.

### Step 5 — Token protection

Implement `src/protect/placeholders.ts`: encode, decode, validate. Integrate into the transform pipeline (encode before prompt assembly, decode after stream completion). Implement validation fail-safe (revert on mismatch, show warning).

**Deliverable:** URLs, emails, numbers survive transforms. Mismatch triggers visible warning and revert.

### Step 6 — Truncation warning

Read finish reason from OpenAI stream. Implement punctuation heuristic as fallback. Show warning in status bar on detection.

**Deliverable:** User is warned if output appears truncated.

### Step 7 — Casual + Professional modes

Add remaining mode snippets. Wire buttons. Test distinct tone output for each.

**Deliverable:** All four modes functional.

### Step 8 — Settings + encrypted config + Anthropic provider

Build Settings UI: provider selector, model name input, temperature slider, streaming toggle, token protection toggle. Implement Rust-side encrypted config read/write for API keys. Implement `src/llm/anthropic.ts` streaming client. Wire provider switching.

**Deliverable:** User can configure provider, model, and preferences. Both OpenAI and Anthropic work.

### Step 9 — Packaging

Signed and notarised macOS build. `.dmg` distribution. DevTools disabled. Final manual test pass on the full test suite.

**Deliverable:** Installable macOS app.

---

## 14) Phase 1 extensions (not in V1)

- Global hotkey to show/hide window.
- Menubar resident mode.
- "Polish selected text" via macOS accessibility.
- History panel (last 20 transforms).
- macOS Keychain for API key storage (replace encrypted config).
- Rust backend proxy / sidecar (migrate API calls out of frontend before distribution).
- Prompt customisation UI.
- Multi-lingual support.
- Second provider as default (add more providers beyond OpenAI/Anthropic).
