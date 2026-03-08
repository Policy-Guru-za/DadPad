# 14 Portrait Only Orientation Lock

## Objective
Lock DadPad to standard upright portrait orientation only on iPad and iPhone so the app never rotates into the unusable landscape layout.

## In Scope
- Remove landscape and upside-down orientation support from the native iOS configuration
- Keep the generated Xcode project source-of-truth files in sync
- Rebuild, verify the built plist, and reinstall/relaunch on the connected iPad
- Update spec/progress tracking and regression notes

## Out of Scope
- Any React or CSS landscape fallback work
- Any controller, editor, or action-bar behavior changes
- Any desktop/macOS window changes

## Dependencies
- `src-tauri/gen/apple/project.yml`
- `src-tauri/gen/apple/dadpad_iOS/Info.plist`
- `progress.md`
- `spec/00_overview.md`

## Stage Plan
1. Record the new spec handoff in `spec/00_overview.md` and `progress.md`.
2. Restrict both iPhone and iPad orientation lists to `UIInterfaceOrientationPortrait` only in the generated Apple sources.
3. Rebuild the iOS app and verify the built `Info.plist` contains only portrait support.
4. Reinstall and relaunch on the connected iPad.

## Test Gate
- `pnpm test`
- `pnpm build`
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject`
- Static `Info.plist` verification in source and built app
- physical iPad install/launch

## Exit Criteria
- `project.yml` contains only `UIInterfaceOrientationPortrait` for both orientation keys
- `dadpad_iOS/Info.plist` contains only `UIInterfaceOrientationPortrait` for both orientation keys
- The built app `Info.plist` also contains only `UIInterfaceOrientationPortrait`
- The refreshed app is installed and launched on the connected iPad for user rotation verification
