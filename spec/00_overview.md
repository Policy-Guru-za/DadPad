# Spec Overview

Use one numbered spec per non-trivial change.

One active spec at a time unless the user says otherwise.

| Spec | Title | Status | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| `01_agents-build-loop` | Strengthen AGENTS with a spec-driven build loop | Done | Codex | None | Bootstrapped workflow docs, spec templates, and progress tracking |
| `02_dadpad-ipad-port` | Port PolishPad into DadPad with iPad-first UI and fresh DadPad storage | Done | Codex | `01_agents-build-loop` | Gate A closed; DadPad-native bundle/app builds, launches, and persists config on simulator |
| `03_ipad-polish-and-device-smoke` | Harden DadPad for iPad viewport fit, legibility, and device smoke | Done | Codex | `02_dadpad-ipad-port` | Senior-friendly shell hardening complete on simulator; physical iPad smoke deferred because no device was attached |
| `04_physical-ipad-smoke` | Recover Xcode device build path and prove DadPad on a connected iPad | Done | Codex | `03_ipad-polish-and-device-smoke` | Build/install path recovered; user manually verified the iPad app and reported only the clear-reset bug remaining |
| `05_clear-fresh-start-reset` | Make Clear restore DadPad to a true fresh-start state | Done | Codex | `04_physical-ipad-smoke` | Browser/sim reset path fixed; physical iPad follow-up found `window.confirm` still blocks entry into the clear path |
| `06_clear-confirmation-surface` | Replace JS confirm with an in-app clear confirmation flow that works on iPad | Superseded | Codex | `05_clear-fresh-start-reset` | Solved the unreliable `window.confirm` path, but the inline confirmation card caused layout scramble on the physical iPad |
| `07_clear-ui-reset-overlay` | Replace the inline clear UI with a stable bottom-sheet reset flow | Done | Codex | `06_clear-confirmation-surface` | User visually verified the physical-iPad build and confirmed the implementation is correct |
| `08_theme-preview-html` | Produce five standalone DadPad theme preview HTML files for palette selection | Done | Codex | `07_clear-ui-reset-overlay` | Five standalone theme previews delivered and browser-smoked at desktop plus iPad-like widths |
| `09_warm-sand-bottom-bar-reflow` | Adopt Warm Sand and remap DadPad into a 3x2 bottom action grid | Done | Codex | `08_theme-preview-html` | Warm Sand production refit landed; user review requested one final harmonization pass for readiness placement and button consistency |
| `10_status-chip-button-harmonization` | Move readiness to the hero and harmonize Warm Sand action styling | Done | Codex | `09_warm-sand-bottom-bar-reflow` | Hero readiness chip and harmonized bottom controls landed; follow-up requested for keyboard docking, footer cleanup, and brighter ready feedback |
| `11_keyboard-dock-and-surface-cleanup` | Dock the action bar above the keyboard and remove footer surface artifacts | Done | Codex | `10_status-chip-button-harmonization` | General dock/keyboard cleanup landed; physical iPad follow-up exposed a separate post-clear refocus regression plus a branded-logo integration request |
| `12_clear-reset-and-logo-lockup` | Stabilize post-clear reset behavior and replace the heading text with the DadPad logo lockup | Done | Codex | `11_keyboard-dock-and-surface-cleanup` | Clear reset and transparent hero logo landed; physical iPad review exposed a responsive-chip regression plus a home-screen icon refresh request |
| `13_chip-layout-and-ios-icon-refresh` | Restore the inline hero chip and refresh the iPad app icon | In Progress | Codex | `12_clear-reset-and-logo-lockup` | Keep the readiness chip compact beside the logo on iPad portrait widths and replace the bundled iOS app icon with the new DadPad mark |
