# 15 Internet Availability Gate

## Objective
Add a fast, elegant internet-availability gate so DadPad blocks interaction when OpenAI reachability is unavailable and automatically recovers when connectivity returns.

## In Scope
- Add a view-owned connectivity hook that probes OpenAI reachability
- Check connectivity at startup, on foreground/wake lifecycle events, and on browser online/offline events
- Show a full-app offline overlay with the exact locked message when connectivity is unavailable
- Automatically remove the overlay once connectivity is restored
- Block editor, settings, clear sheet, and action-bar interaction while connectivity is unresolved or offline
- Add regression coverage plus browser smoke for offline and recovery states
- Update spec/progress tracking

## Out of Scope
- Rewriting provider request logic or aborting active transforms on connectivity loss
- Adding a spinner, retry button, or alternate offline workflow
- Any Rust, Tauri plugin, or native iOS changes

## Dependencies
- `src/App.tsx`
- `src/App.css`
- `src/App.m3.test.tsx`
- `src/dadpad/useInternetGate.ts`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Record the new spec handoff in `spec/00_overview.md` and `progress.md`.
2. Add a dedicated internet gate hook with `checking | online | offline`, OpenAI reachability probing, wake/lifecycle listeners, and offline retry polling while visible.
3. Integrate the hook into the app shell so offline overlays the whole UI and checking blocks interaction without visible flicker.
4. Add regression coverage for startup offline, failed probe, recovery, focus/visibility rechecks, and blocked interaction.
5. Run `pnpm test`, `pnpm build`, browser smoke for offline/recovery, then rebuild/install/launch on the connected iPad for user sleep/wake verification.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke for offline and reconnect
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject`
- physical iPad install/launch

## Exit Criteria
- DadPad probes OpenAI reachability on mount and again on focus/pageshow/visibility-visible plus online/offline events
- Offline state renders the exact message `You are not connected to the internet. This app requires internet access.`
- The offline overlay blocks the full UI and disappears automatically only after a successful follow-up probe
- The live UI state remains intact when the overlay clears
- `pnpm test` and `pnpm build` are green, browser smoke is green, and the updated app is rebuilt/installed/launched on the connected iPad
