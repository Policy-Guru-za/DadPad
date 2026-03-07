# 01 Agents Build Loop

## Objective
Strengthen `AGENTS.md` with a spec-driven build loop, persistent progress tracking, explicit test gates, and dogfood requirements.

## In Scope
- Update `AGENTS.md` to use `SOT/` source-of-truth paths
- Add `/spec/` workflow rules
- Add `progress.md` workflow rules
- Add explicit test gate, debug-until-green, dogfood, and tool-equivalent guidance
- Bootstrap the minimal `spec/` and `progress.md` files so the workflow is immediately usable

## Out of Scope
- New scripts or package commands
- Product or runtime behaviour changes
- README, release checklist, or SOT content edits beyond cross-checking

## Dependencies
- Existing repo docs under `SOT/`
- Current commands in `package.json`
- Existing smoke-test guidance in `README.md` and `RELEASE_CHECKLIST.md`

## Stage Plan
1. Rewrite `AGENTS.md` to reflect the current repo and the new loop.
2. Create `spec/00_overview.md` and this spec file.
3. Create `progress.md`.
4. Verify that referenced files, paths, and commands exist.

## Test Gate
- Confirm `AGENTS.md` points at `SOT/*.md`
- Confirm stale empty-repo wording is gone
- Confirm referenced commands exist in the repo today
- Confirm `spec/` and `progress.md` now exist

## Exit Criteria
- `AGENTS.md` contains the new workflow sections
- `spec/00_overview.md` lists this spec
- `progress.md` records completion with green status
