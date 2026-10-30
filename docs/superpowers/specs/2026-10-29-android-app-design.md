# TimeMapper Android App — Design Spec

- Date: 2026-10-29
- Status: design approved; spec pending user review
- Branch: `feat/android-app`
- Scope: standalone Android app distributed as an APK, feature parity with the Chrome extension

## 1. Goal

Ship a standalone Android app with the same core behaviour as the Chrome extension:

- Select up to 10 cities from a world map (or add a UTC-offset row by tapping empty map space).
- Compare each selected city's 24-hour day on one aligned timeline, with a live "now" line.
- Place and drag up to 4 comparison markers (scrubs); show per-city times and interval lengths.
- Collapsible map with city pins, live time bubbles, night shading and hour lines.
- Full settings screen: city list management (rename, change timezone, reorder, remove), city search via Open-Meteo geocoding, map toggles/calibration, time-period segmentation, now-line reference, language (zh/en/es) and theme (auto/light/dark).

Distribution path: sideloaded release APK first; Google Play publication is a later, separate effort that reuses the same codebase.

## 2. Non-goals

- Cross-device sync (`chrome.storage.sync` has no direct Android equivalent; the app is local-only by decision).
- Export/import of settings.
- Native widgets, notifications, background services.
- A different offline map implementation or a native map SDK.
- Play Store assets, listing copy, and review compliance work (deferred to the Play milestone).
- Any change to extension behaviour on desktop.

## 3. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Wrap the existing web UI in a Capacitor WebView instead of rewriting natively or publishing a PWA/TWA | Lowest cost to feature parity; one implementation of world map, timeline and settings; Capacitor serves assets over `https://localhost`, which keeps ES modules and `fetch` to Open-Meteo working; returns a mature path to a Play-compatible AAB |
| D2 | Local-only storage; no sync, no export | Explicit user decision. `Storage` already falls back to `localStorage` when `chrome.storage` is absent, so the shared data layer needs no changes |
| D3 | New mobile shell under `src/app/` reusing `src/shared/*`; the extension's popup/options remain untouched | Keeps mobile layout decisions out of the extension and avoids duplicating business logic. Only the shell markup and CSS are app-specific |
| D4 | Single-screen layout with a permanent map above a fit-to-width 24-hour timeline, plus a floating bottom navigation (Home/Settings) | Fits the app's purpose ("see everyone's day at a glance") better than horizontal scrolling. A bottom bar keeps settings reachable without a top header |
| D5 | City reordering uses one pointer-drag implementation on the `⋮⋮` handle for mouse and touch, with edge auto-scroll; the temporary move-up/down buttons were removed | HTML5 drag does not fire on touch. A unified pointer implementation avoids two divergent reorder paths and gives direct manipulation on both inputs |
| D6 | Migrate timeline scrub dragging from mouse events to pointer events in the shared module | One code path for mouse and touch; mouse behaviour is preserved. This is the only intentional shared-behaviour change |
| D7 | `applicationId = com.amppa.timemapper` | Stable identity now so a later Play release does not require code changes |
| D8 | `versionName` mirrors `package.json`/`manifest.json`; `versionCode = major*10000 + minor*100 + patch` (2.5.2 → 20502) | Keeps all three artefacts aligned without introducing a version tool |
| D9 | Release APKs are signed with a project keystore created now and backed up; Play may later use Play App Signing | Sideload installs can receive updates only while the signing key stays the same. Switching to Play signing can require a reinstall, which is acceptable |
| D11 | Rotation is allowed; portrait and landscape are both supported by the same layout | Landscape widens every hour cell without a second UI; the acceptance pass covers both orientations |
| D12 | Reuse the existing icon as an Android adaptive icon (foreground from `assets/icon-v1.5sp.png`, circular-masked, white background) and keep the system default splash | Consistent branding with the extension and no new design work. Android 12+ shows the launcher icon as the splash automatically |
| D13 | `minSdk` follows the generated Capacitor template default | Covers the broadest device range the wrapper supports; WebView itself updates through Play, so old devices still get a modern Chromium |
| D15 | Settings runs in an iframe preloaded by the app shell; the bottom navigation lives in the parent document and switches Home/Settings without a page load | Eliminates the bar flash caused by full-page navigation. State is shared through `localStorage`, refreshed with `postMessage`, and hardware back is handled by a pushed history entry |
| D16 | Settings has no live preview; the page is a single centered settings column | The preview duplicated the main screen and crowded the phone layout. Map calibration is now numeric only |
| D17 | City cards expose name and timezone only; longitude/latitude are no longer hand-edited | Coordinates come from the catalog or search results; removing the inputs simplifies the card and avoids invalid coordinates |
| D18 | On the main screen, each timeline row stacks a full-width city/time header above a full-width 24-hour strip; marker lines are masked by the header band | Gives the timeline the full phone width and keeps city/time readable. Markers appear only across the colored strip so labels stay clean |

## 4. Architecture

### 4.1 Runtime

```
Android Activity (Capacitor)
  └─ WebView  https://localhost
       ├─ src/app/index.html   (mobile shell)
       ├─ src/app/app.css      (mobile-only layout)
       ├─ src/app/app.js       (wiring)
       ├─ src/shared/*         (State, MapPreview, TimelinePreview, I18n, Storage, theme)
       └─ src/options/options.html (settings screen, same WebView navigation)
```

- Capacitor (latest stable at implementation time) generates `android/`. Toolchain prerequisites: Android Studio, Android SDK, JDK as required by that Capacitor version.
- The app never defines `chrome.*`. Shared modules must tolerate its absence; `Storage` already does, and the only hard dependency (`chrome.storage.onChanged`) lives in `src/popup/controller.js`, which the app shell does not load.
- The settings view is an iframe (`src/options/options.html?embedded=1`) preloaded by the shell. The bottom bar stays in the parent document; switching views toggles visibility instead of navigating, so the bar never reloads. The iframe receives a `timemapper:refresh` message when shown and posts keyboard-focus messages back. Android back is handled with a `history.pushState` entry for the settings view.
- A one-minute interval re-renders now-line and times, matching the popup controller.

### 4.2 Build pipeline

- `tools/build-android-web.mjs` copies only `src/` and `assets/` into `android-web/` at the repo root (Capacitor `webDir`), plus a generated root `index.html` that redirects to `./src/app/index.html`. `npx cap sync` then copies `android-web/` into `android/app/src/main/assets/public`. `node_modules/`, `design/`, `tests/`, `tools/` and docs are never packaged.
- npm scripts: `android:web` (staging), `android:sync` (staging + `npx cap sync android`), `android:apk` (assembleRelease).
- Android project and `capacitor.config.*` are committed; generated `www/`, keystore and `keystore.properties` are gitignored.

### 4.3 Shared-module changes

Required:

1. `src/shared/timeline-preview.js`: replace `mousedown`/`mousemove`/`mouseup` with `pointerdown`/`pointermove`/`pointerup`/`pointercancel` + `setPointerCapture`, ignoring non-primary pointers and non-left mouse buttons. CSS sets `touch-action: pan-y` on the hours grid and scrub handles so vertical page scrolling still works while horizontal drags scrub; `pointercancel` ends the drag cleanly.
2. `src/popup/timeline.css`: introduce `--timeline-label-width` (default `120px`) and use it in `.timeline-row` grid columns and `.timeline-track-overlay { left }`.
3. `src/shared/city-preview.js`: render move-up/move-down buttons in each city card, hidden on fine-pointer devices, wired to the existing reorder callback. HTML5 drag stays for desktop.

Optional, only if hour labels prove unreadable on a 360dp screen: wrap the hour text in `<span class="hour-label">` and hide odd hours under a narrow-width media query.

## 5. Mobile layout

- No top header: the map begins directly below the safe area; local time is shown by the timeline's now line and city rows.
- Map panel: permanently visible (no collapse affordance); pins get enlarged touch targets (≥ 44dp effective hit area). Hover-only decorations (timezone hover bands, hover bubbles) are disabled under `@media (pointer: coarse)`.
- Timeline panel: each row stacks a full-width city/time header above a full-width 24-hour strip; hour font and date badge scale down. The now/scrub lines are masked by the header band so they read only across the strip.
- Floating bottom navigation: a centered pill with Home and Settings, visible on the main screen and on the in-app settings page with the current item highlighted; it respects safe areas and hides while a settings field has keyboard focus.
- Settings screen: embeds in the shell with the bottom bar still visible; a single centered settings column with no live preview; city cards expose name and timezone only; period controls remain fully usable; navigation back to the main screen uses the bottom bar (no header back link).
- Rotation is allowed: the same stacked layout serves portrait and landscape; all state is re-read from storage, so orientation changes do not lose selections or scrubs.
- Safe areas: `viewport-fit=cover` with `env(safe-area-inset-*)` padding; status bar colour follows theme tokens.

## 6. Data and network

- Storage keys and JSON shapes are unchanged from the extension (`worldTimeAlignerCities`, `worldTimeAlignerCustomCities`, `worldTimeAlignerTimePeriods`, `worldTimeAlignerLanguage(Pref)`, `worldTimeAlignerNowLineMode`, `theme`, `worldTimeAlignerMapSettings_v4`).
- Data lives in the WebView's `localStorage`. Clearing app data clears settings; accepted under the local-only decision.
- `AndroidManifest.xml` requests only `INTERNET` (Open-Meteo geocoding). No location, contacts, storage or analytics permissions.
- `chrome.storage.sync` mirror logic stays dormant (`hasSync()` is false); no migration code is added.

## 7. Packaging, versioning and signing

- `applicationId`: `com.amppa.timemapper`; `minSdk` as generated by the chosen Capacitor version; `targetSdk` current stable.
- Launcher icon: adaptive icon generated from `assets/icon128.png` on a `#FFFFFF` background (foreground inside the 66dp safe zone); Android 12+ uses it as the system splash. No custom splash screen or copy.
- `versionName` mirrors `2.5.2` at implementation time and is bumped together with the extension; `versionCode` follows D8.
- Create `android/keystore/timemapper-release.jks` once, back it up outside the repo, and add `keystore.properties` (gitignored) pointing at it. Release build outputs `android/app/build/outputs/apk/release/app-release.apk`.
- Play milestone (later): AAB build, Play App Signing, store assets, privacy-policy URL. Existing sideload installs may need uninstalling before installing from Play.

## 8. Testing and acceptance

- `npm test` (i18n check, CSS check, unit tests) must pass after shared-module changes.
- No automated browser/headless verification: per `AGENTS.md`, device verification is manual.
- Performance gate (measured on the target device after the first debug build, before further polish): cold start `TotalTime` ≤ 3000 ms (warm ≤ 2000 ms), janky frames < 10 % after a 5-second scrub drag (`dumpsys gfxinfo`), PSS ≤ 200 MB (`dumpsys meminfo`). If a threshold fails and no small optimization recovers it, stop and decide with the developer whether to pivot to a native rewrite.
- Manual acceptance checklist on a physical Android device (portrait and landscape):
  1. Cold start shows local time and the default four cities.
  2. Pin tap adds/removes a city; empty-map tap adds the correct UTC offset row; 10-city cap holds.
  3. Timeline shows 24 hours with a city/time header above each strip, correct date badges at 00:00 and row start, night shading, now line.
  4. Tap places a scrub; drag moves it smoothly without scrolling the page; `[x]` removes it; four-scrub cap holds; interval labels update.
  5. Map is always visible; hover-only decorations are absent.
  6. Settings: rename city, change timezone, remove, reorder by dragging the `⋮⋮` handle, clear all, search Open-Meteo and add result, edit map calibration (numeric only) and reset, change period count and drag dividers, change now-line reference, switch language and theme.
  7. The bottom bar opens settings in-app without reloading the page (the bar stays mounted); hardware back and the Home item return to the main screen; changes are reflected.
  8. Data survives app restart; survives rotation; the launcher shows the TimeMapper adaptive icon.
  9. Airplane mode: app loads from local data; city search fails with the existing inline error, without breaking the page.

## 9. Milestones

| Milestone | Deliverable | Estimate |
| --- | --- | --- |
| M0 | Capacitor project, staging script, empty shell builds and runs on device | 0.5 day |
| M1 | Main screen parity: map, pins, timeline, now line, scrubs (touch) | 2–3 days |
| M2 | Settings screen usable on phone: single column, city management, touch reorder, search, periods, calibration | 2–3 days |
| M3 | Mobile polish: safe areas, touch targets, i18n/theme, bottom navigation | 1–2 days |
| M4 | Signing, release APK, manual acceptance pass | 1 day |
| M5 (separate) | Play Store publication | not estimated |

## 10. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| WebView startup latency and frame drops make the app feel sluggish | Measure a performance gate on the first debug build (cold start, janky frames, PSS); if it fails, optimize or pivot to a native rewrite with the developer's decision. The per-frame scrub work is already O(lines + pins), not a full re-render |
| Android toolchain not installed on the development machine | M0 starts by verifying Android Studio/SDK/JDK; installation is a human prerequisite, not automated |
| Pointer-event migration breaks desktop scrubbing | Keep the same state machine; test mouse drag manually in the extension; changes are isolated in one function |
| Touch drag fights page scroll | `touch-action: none` on the timeline panel during drag plus pointer capture |
| Hour labels unreadable at 360dp | Start with scaled fonts and an 80px label column; fall back to hiding odd hours via the optional span change |
| WebView localStorage cleared by the OS or the user | Accepted under local-only; documented in the app's settings/help copy if needed |
| Capacitor/Android API churn between versions | Pin the Capacitor version in `package.json`; commit the lockfile and the generated `android/` project |
| Sideload → Play signing mismatch | Create and back up the keystore now; document that a reinstall may be needed at the Play transition |

## 11. References

- Extension layout and controls: `src/popup/popup.html`, `src/popup/timeline.css`, `src/options/options.html`
- Shared behaviour: `src/shared/state.js`, `src/shared/timeline-preview.js`, `src/shared/map-preview.js`, `src/shared/city-preview.js`, `src/shared/storage.js`
- Behavioural contract: `AGENTS.md`
- Storage tiering background: `docs/migration-tiered-storage.md`
