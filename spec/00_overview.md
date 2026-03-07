# Spec Overview

Use one numbered spec per non-trivial change.

One active spec at a time unless the user says otherwise.

| Spec | Title | Status | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| `01_agents-build-loop` | Strengthen AGENTS with a spec-driven build loop | Done | Codex | None | Bootstrapped workflow docs, spec templates, and progress tracking |
| `02_dadpad-ipad-port` | Port PolishPad into DadPad with iPad-first UI and fresh DadPad storage | Done | Codex | `01_agents-build-loop` | Gate A closed; DadPad-native bundle/app builds, launches, and persists config on simulator |
| `03_ipad-polish-and-device-smoke` | Harden DadPad for iPad viewport fit, legibility, and device smoke | Done | Codex | `02_dadpad-ipad-port` | Senior-friendly shell hardening complete on simulator; physical iPad smoke deferred because no device was attached |
| `04_physical-ipad-smoke` | Recover Xcode device build path and prove DadPad on a connected iPad | Done | Codex | `03_ipad-polish-and-device-smoke` | Build/install path recovered; user manually verified the iPad app and reported only the clear-reset bug remaining |
| `05_clear-fresh-start-reset` | Make Clear restore DadPad to a true fresh-start state | Done | Codex | `04_physical-ipad-smoke` | `Clear` now returns to resting status after a brief confirmation state and resets native textarea state for a fresh start |
