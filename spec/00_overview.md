# Spec Overview

Use one numbered spec per non-trivial change.

One active spec at a time unless the user says otherwise.

| Spec | Title | Status | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| `01_agents-build-loop` | Strengthen AGENTS with a spec-driven build loop | Done | Codex | None | Bootstrapped workflow docs, spec templates, and progress tracking |
| `02_dadpad-ipad-port` | Port PolishPad into DadPad with iPad-first UI and fresh DadPad storage | Done | Codex | `01_agents-build-loop` | Gate A closed; DadPad-native bundle/app builds, launches, and persists config on simulator |
| `03_ipad-polish-and-device-smoke` | Harden DadPad for iPad viewport fit, legibility, and device smoke | Done | Codex | `02_dadpad-ipad-port` | Senior-friendly shell hardening complete on simulator; physical iPad smoke deferred because no device was attached |
| `04_physical-ipad-smoke` | Recover Xcode device build path and prove DadPad on a connected iPad | In Progress | Codex | `03_ipad-polish-and-device-smoke` | Use Xcode MCP against the active physical-device destination; fix only the minimum local build blockers required for proof |
