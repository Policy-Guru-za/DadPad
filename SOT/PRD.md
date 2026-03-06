# PRD — PolishPad

**Product type:** macOS desktop utility (Tauri)
**Scope:** V1 — single-window text rewrite tool using frontier LLM via API
**Target user:** Solo knowledge worker who dictates elsewhere and wants Gmail-style rewrite + fast style switches
**Status:** Final — ready to build

---

## Non-goals (V1)

Dictation/audio input, menubar mode, global hotkeys, auto-paste into other apps, "polish selected text" via accessibility, personal voice modelling, offline/local model mode, history panel, saved snippets, analytics, team accounts, sync.

---

## 1) Problem statement

Dictation and fast drafting produces text that is run-on, poorly punctuated, grammatically inconsistent, and often includes homophone or word-choice errors from transcription. The raw output needs restructuring into readable paragraphs before it can be used.

Existing solutions require context switching (web app, email client) or do not provide a simple, repeatable "paste → rewrite → edit → copy" loop with predictable output and low latency.

---

## 2) Product goals

**Primary goal:** Deliver a fast, reliable, Gmail-style rewrite button for any pasted text, with three additional style transforms, in a minimal desktop app that feels instant and trustworthy.

**Secondary goals:**

- Let the user revise after transformation (no forced auto-copy).
- Make transforms predictable and meaning-preserving.
- Provide low latency (perceived and actual) via streaming.
- Make the LLM provider and model configurable.

---

## 3) Success criteria

**Must-hit acceptance criteria:**

- Time to usable output: user can paste text and get a polished rewrite in ≤2.5 seconds median on typical broadband for 150–300 words (perceived speed improved via streaming).
- Trust: URLs, numbers, emails, and other protected tokens are preserved exactly. Goal: ≥99.9% preservation rate when token protection is enabled.
- User loop: paste → polish → edit → copy completes in under 15 seconds for typical email-length input.

**Quality criteria:**

- Polish produces clear sentence boundaries and paragraphs in >90% of cases on dictated text.
- Direct mode meaningfully shortens without removing critical info in >85% of cases.
- No hallucinated facts in >99% of cases (enforced by prompt constraints and guardrails).

---

## 4) Target users and use cases

**Primary user:** Uses macOS daily. Dictates into another tool (macOS dictation, Google Docs, etc.). Wants a reusable rewrite surface that works for any target destination — email, Slack, WhatsApp, docs.

**Core use cases:**

1. Dictation cleanup: paste raw transcript → Polish → edit → copy.
2. Tone shift: paste content → Professional, Casual, or Direct.
3. Iterative refine: Polish → Direct → small manual edits → copy.

---

## 5) Product scope

**In scope (V1):**

- Single window app.
- One text editor area.
- One primary transform button: Polish.
- Three secondary tone transforms: Casual, Professional, Direct. Tone transforms unlock after the current text has been polished once.
- Copy button (manual copy only).
- Undo (one-level minimum per transform).
- Settings: provider (OpenAI / Anthropic), model name (string, shipped default: `gpt-5-nano-2025-08-07`), temperature (default 0.2), streaming on/off (default on), token protection on/off (default on), smart message structuring on/off (default on), structured content protection on/off (default on, sub-toggle of token protection for markdown links and code blocks).
- Output-budget fail-safe: over-provision output tokens up front, and if the provider still stops for length before completing the rewrite, preserve the original text and surface an error instead of committing a clipped result.
- Input size limits: soft warning at ~20,000 characters, hard stop at ~80,000 characters (adjust based on chosen model context limits).
- Status bar with word count, character count, last mode, latency, and warnings.
- Basic error handling and user feedback.

**Out of scope (V1):**

- Dictation/audio input.
- Auto-copy after transform.
- Auto-paste into other apps.
- Hotkeys, menubar, HUD.
- History, saved snippets, analytics.
- Personal voice modelling or training.
- Team accounts or sync.
- macOS Keychain integration (deferred to Phase 1 hardening).

---

## 6) UX / UI requirements

### Window

Single standard window (not always-on-top). Simple layout:

- Toolbar row: standalone Polish button | secondary tone cluster (Casual, Professional, Direct) | actions (Cancel, Undo, Copy, Settings)
- Main area: multiline text editor
- Footer status bar: word count, character count, last transform mode, latency (ms), warnings
- Persistent footer hint: "Transforms apply to the current editor text" (clarifies that modes can be stacked iteratively)

### Interaction rules

**Transform buttons:**

- Operate on current editor contents.
- Create an undo checkpoint before overwrite.
- Stream output directly into the editor (editor is read-only during streaming).
- Do not copy automatically.
- Re-enable editing on completion.
- Casual, Professional, and Direct remain disabled until a successful Polish pass has completed for the current text session.
- Tone transforms remain unlocked through normal edits and undo, and re-lock only when the editor is cleared or the full editor content is replaced by a fresh paste.

**Copy:**

- Copies current editor content to clipboard.
- Provides visible confirmation (toast or brief status text).
- Disabled while a transform is streaming (prevents accidental copy of partial output).

**Undo:**

- Restores editor to the pre-transform state.
- Available immediately after any transform completes.

### Loading states

- Transform started: disable transform buttons, show spinner in status bar, optionally allow cancel.
- While streaming: show output progressively in editor (read-only).
- On completion: re-enable buttons and editing, show "Done" and latency in status bar.

### Error states

- Network failure: show error banner; keep original text unchanged in editor.
- API auth failure: prompt user to open Settings.
- Input too long: show limit warning and suggest chunking.

### Cancel behaviour

- If user cancels during streaming: revert to pre-transform text (undo checkpoint), clear stream buffer, re-enable editing.

---

## 7) Functional requirements

### FR1 — Text input/output

The editor accepts pasted text and manual edits. Newlines and basic formatting are preserved. Copy copies exactly what is displayed in the editor.

### FR2 — Transform modes

Four modes with shared constraints and mode-specific behaviour.

**Shared constraints (all modes):**

- Preserve meaning, intent, and factual content.
- Preserve exactly (character-for-character): names, numbers, dates, times, currency, percentages, addresses, URLs, emails, phone numbers, reference IDs, quoted text.
- Fix spelling, grammar, punctuation.
- Improve sentence boundaries. When smart message structuring is enabled, improve paragraphing and plain-text layout using compact paragraphs and simple bullets when helpful.
- Remove obvious filler words (e.g., "um", "uh", "like", "you know") and unintentional verbatim repetition.
- Homophone corrections only when highly confident from context; otherwise leave unchanged.

**Mode-specific behaviour:**

- **Polish:** Gmail-style restructure. Clear, elegant, well-structured for general professional communication. Approximate length preserved; may slightly tighten or modestly expand for elegance and clarity.
- **Casual:** Conversational, friendly, relaxed tone with contractions. Clean and readable, not slangy. Approximate length preserved; light tightening allowed.
- **Professional:** Neutral workplace email tone. Clear, calm, well-structured. Not stiff, not verbose. Approximate length preserved; light tightening allowed.
- **Direct:** Concise and action-oriented. Short sentences. Filler and softening language removed. Bullets allowed when they improve clarity. Meaningful shortening permitted, but essential information preserved.

### FR3 — Provider support

Support OpenAI and Anthropic via HTTP API. Model name is configurable (no hard-coded model dependency). Default provider: OpenAI. Shipped default model: `gpt-5-nano-2025-08-07` (pinned snapshot of GPT-5 nano — OpenAI's fastest, cheapest GPT-5 variant; $0.05/$0.40 per 1M tokens input/output; 400k context window; 128k max output tokens). The default is set in the provider client code (e.g., `openai.ts`) so it can be updated in one place without changing spec or UI. Provider endpoint is abstracted behind the provider client module so that API changes (e.g., OpenAI migrating models between Chat Completions and Responses APIs) require only a client-level change, not a UI change. All requests are cancellable via `AbortController` on the frontend fetch call.

### FR4 — Low latency

Streaming supported and enabled by default. Minimal prompt overhead. Single request per transform (no multi-pass chains).

### FR5 — Token protection

Optional but enabled by default. Detect protected spans and replace with placeholders before sending to the model. Restore original values after response. Validate that all placeholders are present in the output and restored correctly. If validation fails: do not overwrite editor, show a warning, optionally show model output for manual comparison.

**Protected span categories:** URLs, email addresses, phone-like patterns, long numbers/IDs (≥6 digits or alphanumeric), currency patterns, date/time patterns. Additionally, when structured content protection is enabled (sub-toggle, default on): markdown links (`[text](url)` as a single span), inline code (backtick-delimited), and fenced code blocks.

**Placeholder validation:** accept placeholders surrounded by punctuation or whitespace, but reject any token where the numeric ID or body has been altered by the model. The system prompt includes a one-line instruction telling the model not to alter placeholder tokens.

### FR6 — Undo

Provide at least one-step undo for each transform overwrite. The user can recover pre-transform text instantly.

### FR7 — Output completion fail-safe

Provision a generous `max_output_tokens` budget up front so normal rewrites do not clip. If the provider explicitly reports a length stop before completing the rewrite, treat the transform as failed, restore the original text, and show a clear error message. Do not commit partial/clipped output and do not expose a truncation-specific retry control in the UI.

### FR8 — Status instrumentation

Display in the status bar at all times: word count, character count. After a transform: last mode used, latency in milliseconds, and any real warnings/errors (for example token mismatch or provider failure).

### FR9 — Input size limits

Warn the user when input exceeds ~20,000 characters. Hard-stop transforms at ~80,000 characters with a message suggesting chunking. Exact thresholds should be adjusted based on the chosen model's context window limits.

---

## 8) Non-functional requirements

### NFR1 — Performance

Median transform response ≤2.5s for typical email-length content (150–300 words), assuming normal internet and a fast model. UI remains responsive during requests.

### NFR2 — Reliability

On failure, do not destroy the user's text. All transforms are near-deterministic (temperature 0.2).

### NFR3 — Security

API keys stored in encrypted local config file. Encryption uses a random key generated on first run and stored in a separate file with restricted permissions (`0600`). No logging of user text by default. No telemetry in V1. macOS Keychain integration deferred to Phase 1 hardening before any distribution.

### NFR4 — Compatibility

macOS 13+ recommended (based on Tauri support). Apple Silicon and Intel supported.

---

## 9) API and prompt spec

### Architecture

Frontend (TypeScript) calls LLM provider APIs directly. No Rust backend proxy in V1. Rust layer handles windowing and the Tauri bridge only.

### Prompt structure

Each transform request sends: a base system prompt (shared constraints), a mode instruction snippet (per button), and user content wrapped in delimiters. Exact prompt text is specified in the Implementation Blueprint.

### Model parameters

- Temperature: 0.2 (default).
- Streaming: on by default.
- Max output tokens: dynamic based on input size (see Blueprint for heuristic).
- Frequency/presence penalties: 0 (default).

---

## 10) Risks and mitigations

**Risk 1 — "It changed my meaning":** Strong constraints in system prompt. Low temperature. Placeholder protection for sensitive spans. Undo available. No auto-copy forces user review.

**Risk 2 — URLs/numbers altered:** Placeholder token protection enabled by default. Post-check validation with fail-safe (don't overwrite on mismatch).

**Risk 3 — Latency feels slow:** Streaming output. Fast model default (GPT-5 nano — OpenAI's fastest GPT-5 tier). Minimal prompts. No retry chains.

**Risk 4 — "Direct" mode becomes rude:** Defined as concise/action-oriented, not aggressive. Prompt explicitly avoids insulting or harsh language.

**Risk 5 — Partial output from provider length stops:** Over-provision output budgets up front. If the provider still ends for length, fail safe by restoring the original text instead of committing clipped output.

---

## 11) Milestones (V1)

1. **M1** — App shell: Tauri window + editor + toolbar + status bar (word/char counts).
2. **M2** — Transform pipeline: Polish mode, streaming, direct API call from frontend (OpenAI).
3. **M3** — Safety: Undo checkpoint before transform + Cancel during stream.
4. **M4** — Direct mode: Second transform with distinct behaviour.
5. **M5** — Token protection: Encode/decode/validate + fail-safe.
6. **M6** — Truncation warning: Finish reason check + punctuation heuristic.
7. **M7** — Remaining modes: Casual + Professional.
8. **M8** — Settings + encrypted key storage + provider switching (add Anthropic).
9. **M9** — Packaging: Signed and notarised macOS build.

---

## 12) Phase 1 extensions (explicitly not in V1)

- Global hotkey to show/hide.
- Menubar resident mode.
- "Polish selected text" via accessibility.
- History panel.
- macOS Keychain for API key storage.
- Prompt customisation UI.
- Multi-lingual support.
- Auto-copy and auto-paste options.
- Rust backend proxy (migrate API calls from frontend to Rust sidecar before distribution).
