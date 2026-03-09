# Progress

## Current Spec
- `22_clone-proven-polish-prompt`

## Current Stage
- Stage 3 — Prompt parity confirmed; local gates green

## Status
- Spec `07_clear-ui-reset-overlay` is complete; the user verified the physical-iPad clear flow and confirmed the implementation is correct.
- Spec `08_theme-preview-html` is complete and the user selected Warm Sand as the production direction.
- Spec `09_warm-sand-bottom-bar-reflow` is complete.
- Spec `10_status-chip-button-harmonization` is complete.
- Spec `11_keyboard-dock-and-surface-cleanup` is complete for the general shell/dock cleanup.
- Spec `12_clear-reset-and-logo-lockup` is complete.
- Spec `13_chip-layout-and-ios-icon-refresh` is complete.
- Spec `14_portrait-only-orientation-lock` is complete; the native iOS sources and built app now advertise only standard upright portrait.
- Spec `15_internet-availability-gate` is complete; the startup/wake connectivity gate, full-app offline overlay, and automatic recovery path are implemented and green.
- Spec `16_single-surface-editor` is complete; the user approved the single-surface writing area.
- Spec `17_action-dock-remap` is complete; the action dock now reads `Polish / Clear / Settings` then `Share / Copy / spacer`, and the user approved the live iPad result.
- Spec `18_voice-preserving-polish` is complete; prompt/docs/tests landed, and only the optional live eval remains blocked by missing local OpenAI config.
- Spec `19_gmail-first-email-action` is complete.
- Spec `20_gmail-wordmark-button-refine` is complete.
- Spec `21_stronger-polish-sendability` is complete.
- Spec `22_clone-proven-polish-prompt` is complete.
- DadPad now keeps generic `Share` for Notes/other targets and adds a separate Gmail icon button that preserves paragraphs through Gmail-first email compose.
- Root diagnosis confirmed: DadPad hands generic share targets plain text unchanged; Gmail flattens paragraphs when it imports generic Web Share text.
- New outcome: DadPad `Polish` now exactly matches the proven prompt templates in `tmp/Prompt-templates`, including the original `REFINE` wording and minimal GPT-5 reasoning controls.

## Last Green Commands
- `pnpm test`
- `pnpm build`
- `diff -u src/providers/openaiPrompting.ts tmp/Prompt-templates/openaiPrompting.ts` (no output; prompt parity confirmed)
- `pnpm exec tsx <<'TS' ... buildInstructions('polish', deriveStructureIntent(lowercaseApology, 'polish')) ... TS` confirming the shipped `Polish` prompt now includes assertive sendability, capitalization repair, ramble compression, and anti-corporate rules together
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4174`
- Playwright check at `1024x1366` confirming the Gmail button remained `313px` wide while the centered wordmark rendered at `131px` width by `32px` height with no cropping
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 /Users/ryanlaubscher/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 /Users/ryanlaubscher/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `pnpm exec tsx <<'TS' ... buildInstructions('polish', deriveStructureIntent(peterEmail, 'polish')) ... TS` confirming `Mode: REFINE`, voice-preserving anti-drift rules, and `Preferred shape for this input: paragraphs`
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke confirming iPad-width order `Polish / Clear / Settings` then `Share / Copy`, with `Copy` directly beneath `Clear`, and narrow-width order `Polish / Clear / Settings / Share / Copy`
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke confirming `.editor-panel` computed to transparent / borderless / no shadow, `.editor` remained the only visible card with border + shadow, the hidden label kept `editor-label sr-only`, keyboard-open still held, clear still reset, offline overlay still appeared, and console errors stayed at zero
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `pnpm test`
- `pnpm build`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright smoke with a stubbed OpenAI probe confirming the offline overlay appears with the exact locked copy, blocks `Polish` + `Settings`, clears automatically after a successful reconnect probe, and logs zero console errors
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `pnpm test`
- `pnpm build`
- `rg -n "UISupportedInterfaceOrientations|Landscape|PortraitUpsideDown" src-tauri/gen/apple/project.yml`
- `/usr/libexec/PlistBuddy -c 'Print :UISupportedInterfaceOrientations' src-tauri/gen/apple/dadpad_iOS/Info.plist`
- `/usr/libexec/PlistBuddy -c 'Print :UISupportedInterfaceOrientations~ipad' src-tauri/gen/apple/dadpad_iOS/Info.plist`
- Swift icon compositor wrote `src-tauri/icons/dadpad-icon-master.png` as a `1024x1024` opaque PNG from `/tmp/DadPad-icon.png`
- `pnpm tauri icon src-tauri/icons/dadpad-icon-master.png -o src-tauri/icons`
- Swift AppIcon sync rewrote `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/*.png` from the opaque master icon
- `sips -g hasAlpha src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon-83.5x83.5@2x.png src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon-60x60@3x.png`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad portrait smoke confirming `.hero-header` stayed two-column (`650.719px 96.0938px`), the ready chip remained inline at `96px` width, and the chip sat above the strapline rather than as a banner
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad portrait missing-key smoke confirming the error chip stayed inline at `279px` width with nowrap + ellipsis styling
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad-width smoke confirming confirmed clear leaves the editor empty, unfocused, scrolled to top, with `.app-main.scrollTop === 0`, `window.scrollY === 0`, and the hero logo visible
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad-width smoke covering ready state plus missing-key state
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad-width clear-flow smoke with stubbed `read_config`
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad-width smoke confirming the hero readiness chip, italic strapline, `Share / spacer / Settings` second row, and aligned `Clear / Copy / Share` buttons
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright iPad-width smoke confirming no action-bar background image, `position: static`, opaque disabled buttons, and the full hero still visible
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright keyboard-open simulation confirming `--viewport-height: 700px`, `--keyboard-inset: 324px`, a fixed hero row, a scrollable `.app-main`, and a docked footer row
- `pnpm preview --host 127.0.0.1 --port 4173` + Playwright ready-state Tauri stub confirming `Ready`, `status-chip-dot ready-dot`, `rgb(70, 239, 112)`, and a luminous halo box-shadow
- `pnpm tauri ios build --debug --open`
- Xcode MCP `BuildProject` on `windowtab1` (`buildResult: The project built successfully.`)
- `/usr/libexec/PlistBuddy -c 'Print :UISupportedInterfaceOrientations' ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app/Info.plist`
- `/usr/libexec/PlistBuddy -c 'Print :UISupportedInterfaceOrientations~ipad' ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app/Info.plist`
- `xcrun devicectl device install app --device 13A95266-ADC7-527A-9F91-4B46F268AE25 ~/Library/Developer/Xcode/DerivedData/dadpad-edodrgvdjgwyriepyaxktomsajmq/Build/Products/debug-iphoneos/DadPad.app`
- `xcrun devicectl device process launch --device 13A95266-ADC7-527A-9F91-4B46F268AE25 --terminate-existing com.ryanlaubscher.dadpad`
- `python3 -m http.server 4300 --bind 127.0.0.1` from `design/` + Playwright smoke of all five `theme-previews/*.html` files at `1440px` and `1024px`

## Blockers
- No hard blocker.
- Existing non-critical carryover: live prompt eval still needs an OpenAI API key in DadPad settings or `OPENAI_API_KEY`; model-backed output samples remain blocked until that exists locally.

## Next Step
- If requested: rebuild/install the updated DadPad app on the connected iPad so the cloned `Polish` prompt is live on-device.

## Dogfood Evidence
- User manually tested the physical-iPad clear flow after spec `07` and confirmed the implementation is correct.
- All five theme preview files were opened through a local static server and browser-smoked in Playwright.
- Smoke confirmed zero console errors, five working theme-nav links, two preview states per file, desktop two-column layout, and iPad-like stacked layout.
- Playwright smoke at `1024x1366` confirmed the new hero copy, no eyebrow, no top status strip, action order `Polish / Clear / Copy / Share / Ready. / Settings`, and correct missing-key error tone in the bottom status tile.
- Playwright smoke at `1024x1366` for spec `10` confirmed the top-right readiness chip, italic strapline, no bottom status tile, a preserved center spacer in row 2, and matching `Clear / Copy / Share` geometry with a distinct Settings treatment.
- Playwright smoke at `1024x1366` for spec `11` confirmed no action-bar background image, `position: static`, opaque disabled buttons, and the full hero text still visible in the default shell.
- Playwright keyboard-open simulation confirmed `keyboard-open`, `--viewport-height: 700px`, a fixed hero row, a scrollable `.app-main`, and an `.action-dock` occupying the final visible shell row.
- Playwright ready-state Tauri stub confirmed `Ready`, `status-chip-dot ready-dot`, `rgb(70, 239, 112)`, and a green halo box-shadow on the chip dot.
- The connected iPad build path is green again: Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `12` smoke confirmed confirmed clear leaves the editor empty, unfocused, and reset at the top while the hero logo remains visible in the iPad-width production bundle.
- The connected iPad build path is green for spec `12`: Xcode MCP build passed again, `devicectl` install passed again, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `13` smoke at `820x1180` confirmed the hero stayed two-column, the ready chip remained inline at `96px` width, and the error chip remained inline at `279px` width with nowrap + ellipsis.
- The generated iOS AppIcon files are now opaque (`hasAlpha: no`) after syncing `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset` from the soft-ivory master icon.
- The connected iPad build path is green for spec `13`: Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `14` static verification confirmed both `src-tauri/gen/apple/project.yml` and `src-tauri/gen/apple/dadpad_iOS/Info.plist` now list only `UIInterfaceOrientationPortrait`.
- New spec `14` build verification confirmed the built `DadPad.app/Info.plist` also lists only `UIInterfaceOrientationPortrait` for both orientation keys.
- The connected iPad build path is green for spec `14`: Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `15` regression coverage now proves startup offline, failed startup probe, delayed reconnect success, visibility/focus rechecks, blocked interaction, preserved draft state, and automatic offline retry recovery.
- New spec `15` browser smoke against the production bundle confirmed the full grey offline overlay with the exact locked copy, blocked actions while offline, automatic recovery after reconnect, and zero console errors.
- The connected iPad build path is green for spec `15`: `pnpm tauri ios build --debug --open` passed, Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `16` regression coverage now proves the editor remains labeled as `Your text`, the label is hidden-only, the placeholder stays intact, and the writing area structure remains stable through clear/offline/keyboard flows.
- New spec `16` browser smoke against the production bundle confirmed `.editor-panel` is transparent, borderless, and shadowless while `.editor` remains the sole visible card with the Warm Sand border/shadow treatment.
- The connected iPad build path is green for spec `16`: `pnpm tauri ios build --debug --open` passed, Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `17` regression coverage now proves the DOM/visible action order is `Polish`, `Clear`, `Settings`, `Share`, `Copy` while preserving the same button roles and handlers.
- New spec `17` browser smoke against the production bundle confirmed iPad-width positions `Polish / Clear / Settings` then `Share / Copy`, with `Copy` directly beneath `Clear`, plus a stable narrow-width order of `Polish / Clear / Settings / Share / Copy`.
- The connected iPad build path is green for spec `17`: `pnpm tauri ios build --debug --open` passed, Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `18` prompt dogfood against the Peter-email sample confirmed the shipped `Polish` prompt now says “Make this sound like the same person, just clearer and cleaner,” forbids assistant-like phrasing, preserves everyday wording, and sets `Preferred shape for this input: paragraphs` instead of `hybrid`.
- New spec `19` diagnosis confirmed DadPad still shares plain text unchanged via `navigator.share({ text })`; Gmail paragraph flattening occurs in Gmail's target handling, not in DadPad's editor or share payload.
- New spec `19` regression coverage now proves the dock renders `Share / Copy / Gmail`, the Gmail button is discoverable by accessible name, generic `Share` still uses `navigator.share`, Gmail compose is attempted before `mailto:`, paragraph breaks are CRLF-preserved in the encoded email body, and clear errors surface if no email compose path is available.
- New spec `19` build/install path is green: `pnpm test` passed, `pnpm build` passed, Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `20` regression coverage now proves the Gmail button still exists by accessible name `Gmail` and renders the tracked `gmail-wordmark` asset instead of the old envelope icon.
- New spec `20` local dogfood confirmed the wordmark stayed centered and uncropped inside the Gmail pill at iPad width, with comfortable side padding and a restrained disabled opacity.
- New spec `20` build/install path is green: `pnpm test` passed, `pnpm build` passed, Xcode MCP build passed, `devicectl` install passed, and `devicectl` launch passed for `com.ryanlaubscher.dadpad`.
- New spec `21` prompt dogfood confirmed the shipped `Polish` instructions no longer say `Prefer minimal rewriting`, now say `Rewrite assertively enough to make the message naturally sendable`, and explicitly add capitalization repair, ramble compression, cleaner everyday phrasing, and stronger restructuring guidance.
- New spec `21` local gates are green: `pnpm test` passed with 117 tests, and `pnpm build` passed.
- New spec `21` live model eval is still externally blocked because `/Users/ryanlaubscher/Library/Application Support/DadPad/` contains `encryption.key` but no `config.enc`, so `pnpm eval:modes` cannot load an API key.
- New spec `22` prompt parity check returned an empty diff between `/src/providers/openaiPrompting.ts` and `/tmp/Prompt-templates/openaiPrompting.ts`, confirming the shipped DadPad `Polish` prompt now matches the proven template exactly.
- New spec `22` local gates are green: `pnpm test` passed with 116 tests, and `pnpm build` passed.
