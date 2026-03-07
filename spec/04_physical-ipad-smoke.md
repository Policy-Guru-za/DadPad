# 04 Physical iPad Smoke

## Objective
Recover the Xcode-driven physical-device path and prove DadPad can build and launch on the currently connected iPad.

## In Scope
- Verify Xcode MCP access to the generated Apple project
- Identify and fix the minimum repo-local blocker preventing a device build
- Use the active Xcode destination to build for the connected iPad
- Capture physical-device smoke evidence and remaining risk

## Out of Scope
- New feature work
- Broad Tauri iOS workflow redesign
- App Store signing/distribution hardening beyond what the connected-device smoke needs
- Adding XCTest targets unless separately requested

## Dependencies
- `src-tauri/gen/apple/dadpad.xcodeproj`
- Xcode MCP live session access
- Connected trusted iPad destination
- Existing DadPad simulator proof from spec `03_ipad-polish-and-device-smoke`

## Stage Plan
1. Verify the active Xcode workspace, connected device visibility, and current blocker.
2. Apply the smallest repo-local fix needed for the Xcode device build path.
3. Build and launch DadPad on the connected iPad via the active Xcode destination.
4. Record proof, blocker details, and any residual manual setup still required.

## Test Gate
- `pnpm test`
- `pnpm build`
- Xcode MCP `BuildProject` on the active physical-device destination
- Physical-device launch/smoke via Xcode if the build succeeds

## Exit Criteria
- The physical iPad is visible to the toolchain and usable by Xcode
- DadPad builds for the active device destination without the prior `pnpm` build-phase failure
- DadPad launches on the connected iPad or the remaining blocker is isolated with exact evidence
- `progress.md` reflects commands run, proof result, and remaining risk
