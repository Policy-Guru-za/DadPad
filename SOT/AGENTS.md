# AGENTS.md

## Objective
Build V1 of the macOS Tauri app described in `PRD.md` and `BLUEPRINT.md`.

This repo is starting from an empty state. The first job is to scaffold a clean Tauri + TypeScript project and add the required documentation files below.

---

## Source of truth (must read first)
These documents are authoritative and must be followed exactly:

1. `PRD.md`
2. `BLUEPRINT.md`
3. `AGENTS.md` (this file)
4. `PROMPT_PACK.md`
5. `PLACEHOLDERS_AND_VALIDATION.md`
6. `REPO_SETUP.md`
7. `PROVIDER_INTEGRATION.md`
8. `TEST_PLAN.md`

If any of the above are missing, create them immediately (from the latest versions provided by the product owner) before writing significant code.

---

## Hard scope fence (V1)
### Do NOT implement
- Dictation / audio input (no microphone capture).
- Menubar app, global hotkeys, always-on-top HUD, caret-following window.
- Auto-paste, “polish selected text”, accessibility integrations.
- User style learning / “sound like me” personalisation, fine-tuning, embeddings, RAG.
- Telemetry/analytics, accounts, sync, multi-device.
- Background services, daemons, launch agents.

### Implement ONLY
- Single standard window with a multiline text editor.
- Four transform modes: **Polish**, **Casual**, **Professional**, **Direct**.
- **Copy** button (manual copy only; never auto-copy).
- **Streaming into the editor** (editor disabled while streaming).
- **Cancel** + **Undo** (at least one-step) for every transform.
- Token protection placeholders + validation + fail-safe (“do not overwrite on mismatch”).
- Truncation detection + **Retry (more room)**.
- Settings for: provider, model, temperature, streaming on/off, token protection on/off.
- Encrypted local config exactly as specified in `BLUEPRINT.md`.

---

## Agents & permissions
### Codex (primary build agent)
Codex owns:
- Repo scaffolding and implementation
- Tests and refactors
- Docs updates when implementation requires it
- Packaging/build scripts (within V1)

Codex must:
- Build in stages; keep the app runnable after each stage.
- Refuse scope creep; if uncertain, stop and ask.
- When blocked, present options + tradeoffs; do not silently pick a risky path.
- Stop and check in at explicit gates (below).

### Claude (frontend-only assistant)
Claude may be used ONLY for:
- UI components and layout
- UX polish, microcopy, state presentation
- Visual hierarchy and interaction refinements

Claude must NOT be used for (ever):
- Provider integration (OpenAI/Anthropic requests, endpoints, streaming parsers)
- API keys / secrets handling
- Config encryption
- Placeholder/token protection logic
- Any auth/security backend logic

Do not paste API keys to any model or tool.

---

## Operating mode (how we work)
We follow a staged workflow inspired by: Discovery → Planning → Building → Polish → Handoff.

### 1) Discovery (one-time at repo start)
- Confirm the doc set exists and is consistent.
- List prerequisites (Node/Rust/Tauri) and any setup gaps.
- Propose the exact milestone plan mapped to `BLUEPRINT.md`.

### 2) Planning (before major coding)
- Restate what will be built in V1 (and what will not).
- Identify any decisions needed from the product owner.
- Confirm default provider/model settings match docs.

### 3) Building (incremental, verifiable stages)
- Implement milestone-by-milestone.
- After each milestone:
  - summarize changes
  - provide run instructions
  - list tests added and how to run them

### 4) Polish (finish-level quality)
- Ensure clean UX states, graceful errors, and no confusing behaviour.
- Verify: Copy disabled while streaming; undo works; failures never destroy user text.

### 5) Handoff
- Ensure docs reflect reality.
- Provide “how to run/build/test” instructions that work on a fresh machine.

---

## Explicit check-in gates (must stop and request approval)
### Gate A — First working transform loop
After:
- Tauri app scaffolding exists
- UI renders with editor + buttons
- A single provider call returns a transformed result (even if non-streaming temporarily)

Stop and ask for approval to proceed to full streaming + state-machine enforcement.

### Gate B — Before implementing trust-critical mechanisms
Before implementing:
- token protection placeholders
- encryption of config/secrets

Stop and confirm:
- placeholder formats + no-overlap rule
- protected span priorities (markdown links/code first)
- encryption file paths and atomic write approach

---

## Engineering conventions
- Frontend: TypeScript + minimal dependencies.
- Backend Rust: keep thin; follow `BLUEPRINT.md` (avoid big Rust architecture in V1).
- No logging of user content by default. If debug logging exists, it must be opt-in.
- Keep modules small; avoid “god files”.

### Streaming rule (non-negotiable)
- Stream output into the editor.
- Editor is disabled while streaming.
- Copy is disabled while streaming.
- Accumulate full streamed output in a buffer.
- Placeholder decode/validate happens only once at completion (never per chunk).

---

## Repo bootstrapping requirements (empty repo)
Initial scaffold must include:
- Tauri + TypeScript app
- `src/` frontend and `src-tauri/` backend structure
- All docs in “Source of truth” present in repo root
- Basic lint/format/test setup (lightweight; do not over-engineer)
- A clear `README.md` (one page max) with run/build commands

---

## Definition of done (V1)
V1 is done when:
- All milestones in `BLUEPRINT.md` are complete.
- Manual test cases in `TEST_PLAN.md` pass.
- Token protection never overwrites editor on mismatch.
- Truncation warning + “Retry (more room)” works.
- Copy is disabled while streaming.
- App runs and builds from a fresh checkout using `REPO_SETUP.md`.

