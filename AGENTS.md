# AGENTS.md

## Objective
Ship DadPad by adapting the copied PolishPad codebase per `SOT/DADPAD_BRIEF.md` and the active DadPad execution spec.

Repo already live.
- Fresh or empty checkout: bootstrap from `SOT/REPO_SETUP.md`.
- Existing repo: continue from current state; no re-scaffold unless SOT docs require it.

---

## Source of truth (must read first)
For DadPad work, these docs are authoritative:

1. `SOT/DADPAD_BRIEF.md`
2. Active `spec/*.md`
3. `progress.md`
4. `AGENTS.md` (this file, for workflow/safety/test discipline)

Copied PolishPad docs remain implementation reference only unless a DadPad doc explicitly points back to them:

1. `SOT/PRD.md`
2. `SOT/BLUEPRINT.md`
3. `SOT/PROMPT_PACK.md`
4. `SOT/PLACEHOLDERS_AND_VALIDATION.md`
5. `SOT/REPO_SETUP.md`
6. `SOT/PROVIDER_INTEGRATION.md`
7. `SOT/TEST_PLAN.md`

If the DadPad brief, active spec, or progress tracker are missing, restore or recreate them before significant DadPad changes.

For DadPad work, the active spec operationalizes the DadPad brief and may supersede copied PolishPad SOT details where it explicitly says so.

---

## Legacy PolishPad Scope Fence (reference only)
The following copied PolishPad V1 scope is kept as implementation reference. It does not define DadPad product scope.

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
- Encrypted local config exactly as specified in `SOT/BLUEPRINT.md`.

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
- Use `spec/` + `progress.md` for non-trivial work.
- Refuse scope creep; if uncertain, stop and ask.
- When blocked, present options + tradeoffs; do not silently pick a risky path.
- Drive relevant gates from red to green before handoff, unless a real blocker exists.
- Dogfood changed flows before sharing results or asking for review.
- Stop and check in at explicit gates (below).
- Never run create/scaffold commands with `--force` from repo root.
- Never add, delete or alter any files or folder outside of the project root. Ask the user if there is any confusion with this.
- Never automatically commit files to git. The User does this manually.

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

### Xcode via MCP
- Host Xcode MCP is configured for this machine.
- For Xcode/iOS work, prefer the live `xcode` MCP server when the current session actually exposes it.
- Verify live session access before relying on MCP. Do not assume CLI registration alone means the session can use it.
- If MCP startup fails, cancels, or the `xcode` server is unavailable in-session, fall back to `xcodebuild`, `simctl`, or the Xcode UI directly.

---

## Operating mode
Workflow: Discovery -> Spec -> Planning -> Build -> Polish -> Handoff.

### 0) The Napkin
- Start with `docs/napkin/SKILL.md`.
- Use `docs/napkin/napkin.md` for mistakes, corrections, and patterns.
- Napkin is memory, not progress tracking.

### 1) Discovery
- Confirm SOT doc set exists and is internally consistent.
- Confirm current repo state; do not assume an empty repo.
- List prerequisites (Node/Rust/Tauri) and setup gaps.
- Map DadPad work to `SOT/DADPAD_BRIEF.md` and the active DadPad spec. Consult `SOT/BLUEPRINT.md` only as copied implementation reference where still useful.

### 2) Spec setup
- For non-trivial work, choose or create the next numbered `spec/NN_<topic>.md`.
- Update `spec/00_overview.md` and `progress.md` before coding.
- One active spec at a time unless the user says otherwise.

### 3) Planning
- Restate what will be built in V1 (and what will not).
- Lock assumptions, risks, and dependencies in the active spec.
- Confirm default provider/model settings against DadPad authority docs first, then copied PolishPad reference docs only where needed.

### 4) Building
- Implement one bounded stage at a time.
- Run the relevant test gate after each stage.
- Update `progress.md` with status, last green commands, blockers, next step, and dogfood evidence.

### 5) Polish
- Dogfood the changed flow in-app.
- Ensure clean UX states, graceful errors, and no confusing behaviour.
- Verify: Copy disabled while streaming; undo works; failures never destroy user text.

### 6) Handoff
- Ensure docs reflect reality.
- Provide working run/build/test instructions for a fresh machine.
- Summaries must include spec id, commands run, dogfood result, blockers, and remaining risk.

---

## Execution artifacts
- `spec/00_overview.md`: ordered spec index / milestone registry.
- `spec/01_<topic>.md`, `spec/02_<topic>.md`, ...: execution specs for non-trivial work.
- Each numbered spec should include: Objective, In Scope, Out of Scope, Dependencies, Stage Plan, Test Gate, Exit Criteria.
- `progress.md`: live tracker for current spec, stage, status, last green commands, blocker, next step, and dogfood evidence.
- `docs/napkin/napkin.md`: lessons learned only; never use it as a status board.
- If `spec/` or `progress.md` are missing, create them before substantial work.

### Non-trivial work
Use `spec/` + `progress.md` for:
- New features
- Behaviour changes
- Provider / prompt / structure changes
- Security / config / encryption changes
- UI flow changes spanning multiple files
- Any work expected to exceed ~30 minutes

You may skip `spec/` for tiny copy fixes, typos, comments, or isolated one-line edits with no behavioural risk.

---

## Build loop
For non-trivial work, follow this order:

1. Choose or create the next numbered spec.
2. Update `progress.md`.
3. Implement one bounded stage.
4. Run the relevant test gate.
5. Debug until green.
6. Dogfood the changed flow.
7. Record evidence in `progress.md`.
8. Only then ask for review / approval or advance to the next stage.

Rules:
- No stage is complete while a required gate is red.
- Do not share screenshots, URLs, builds, or “done” claims before dogfooding.
- A real blocker must include: failing command, exact error, current hypothesis, and the missing external input or dependency.

---

## Test gate
Run the smallest relevant gate that proves the changed behaviour.

- Docs / process only: verify referenced files, paths, and commands exist and remove stale instructions.
- Frontend / UI / app logic: `pnpm test` and `pnpm build`
- Rust / native / config / security: `cargo test --manifest-path src-tauri/Cargo.toml`
- Prompt / mode / structure work: add `pnpm eval:modes`, `pnpm eval:structure`, `pnpm eval:agent-prompts` as applicable
- Release / handoff: add `pnpm tauri build` and smoke-test the built app bundle

If a gate fails:
- Keep iterating until it passes, or
- Stop with a real blocker summary

---

## Dogfood / self-test
- Before sharing results or asking for human review, run the changed flow locally in `pnpm tauri dev`, the built app bundle, or the current static iOS simulator route as appropriate.
- Use Playwright when it helps. Otherwise manual end-to-end verification is acceptable.
- If credentials, provider access, or external systems block live verification, use the closest safe fallback and state the gap explicitly.
- Gate A and Gate B summaries must include commands run, dogfood result, and remaining risk.

---

## Explicit check-in gates (must stop and request approval)
For DadPad work, product-specific gate ownership comes from `SOT/DADPAD_BRIEF.md` plus the active DadPad spec. The legacy Gate A / Gate B details below remain workflow reference only where they do not conflict.

### Gate A — First working transform loop
After:
- Tauri app scaffolding exists
- UI renders with editor + buttons
- A single provider call returns a transformed result (even if non-streaming temporarily)
- Relevant test gate is green
- Current build has been dogfooded

Stop and ask for approval to proceed to full streaming + state-machine enforcement.

### Gate B — Before implementing trust-critical mechanisms
Before implementing:
- token protection placeholders
- encryption of config/secrets

Stop and confirm:
- placeholder formats + no-overlap rule
- protected span priorities (markdown links/code first)
- encryption file paths and atomic write approach
- commands run so far, dogfood result, and remaining risk

---

## Engineering conventions
- Frontend: TypeScript + minimal dependencies.
- Backend Rust: keep thin; follow the DadPad brief and the current reuse-heavy architecture. Use `SOT/BLUEPRINT.md` only as copied implementation reference where still applicable.
- No logging of user content by default. If debug logging exists, it must be opt-in.
- Keep modules small; avoid “god files”.
- Prefer exact current repo commands; do not invent scripts that do not exist.

### Streaming rule (non-negotiable)
- Stream output into the editor.
- Editor is disabled while streaming.
- Copy is disabled while streaming.
- Accumulate full streamed output in a buffer.
- Placeholder decode/validate happens only once at completion (never per chunk).

---

## Tool equivalents
- agent-browser => Tauri smoke test / Playwright / manual end-to-end verification
- react-doctor => React best-practice review + test/build gate
- here-now / Vercel => not primary for this desktop repo; use local build artifacts and release bundle verification
- automations / trigger => use only when the user explicitly asks for recurring work

---

## Fresh bootstrap requirements
If the repo is ever re-created from empty, the initial scaffold must include:
- Tauri + TypeScript app
- `src/` frontend and `src-tauri/` backend structure
- DadPad authority docs present under `SOT/`, including `SOT/DADPAD_BRIEF.md`
- Basic lint/format/test setup (lightweight; do not over-engineer)
- A clear `README.md` (one page max) with run/build commands

---

## Definition of done (V1)
V1 is done when:
- DadPad product scope in `SOT/DADPAD_BRIEF.md` is reflected in docs and code.
- Relevant specs are marked done in `spec/00_overview.md`.
- `progress.md` reflects a green final state.
- Relevant DadPad test/build gates are green.
- DadPad uses fresh DadPad-scoped encrypted storage.
- DadPad UI exposes the locked controls for `Polish`, `Undo`, `Cancel`, `Clear`, `Copy`, and `Share`.
- DadPad can run on the current authoritative iPad simulator route; physical iPad smoke if feasible.
- Share is proven via `navigator.share` or an explicit native fallback.
- App runs and builds from a fresh checkout using `SOT/REPO_SETUP.md`.
