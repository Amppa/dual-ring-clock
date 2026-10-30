# DEVELOPMENT.md — Engineering Workflows & Runbook

## 1. Quick Runbook

```bash
# Run every pre-commit check (must pass before commit)
npm test
#   check:i18n  — dictionaries, data-i18n keys, language plumbing
#   check:css   — var() resolution per page, dead selectors, duplicate blocks
#   test:unit   — node:test suite in tests/ (shared utils, catalog, state)

# Or individually
node tools/check-i18n.mjs
node tools/check-css.mjs
npm run test:unit      # unit tests only
npm run test:coverage  # unit tests with the line/branch/function coverage report
npm run bench          # hot path benchmarks with per-call budgets (~2 s)

# Profile the popup: web vitals, long tasks and a DevTools-compatible trace
npm install          # first run only, pulls puppeteer
npm run profile:popup # writes traces/*.trace.json

# Build release zip for Chrome Web Store
node tools/build-zip.mjs
```

### Unit Tests
- Built on the Node.js built-in runner (`node:test` + `node:assert/strict`). No test framework is installed and none may be added — the extension stays zero-dependency at runtime.
- Layout: `tests/helpers/mock-storage.js` (in-memory `localStorage`), `tests/utils.test.js`, `tests/cities.test.js`, `tests/state.test.js`.
- `tests/state.test.js` shares the `State` singleton and the global `localStorage`, so its `beforeEach` re-seeds storage and re-initialises state rather than mutating leftovers.
- Tests must stay deterministic: never depend on the machine time zone or on the current date. Assert zone-relative behaviour (`TimeUtils.hourInZone(...)`) or freeze `Date` with `t.mock.timers`.
- `src/shared/cities.js` carries no `name` field — display names live in `i18nCityNames`, keyed by city id. `tests/cities.test.js` asserts that linkage instead.

### Benchmarks
- `npm run bench` (`tools/bench.mjs`) times the pure hot paths — night-area geometry, map projection, state lookup, escaping — and fails if a median exceeds its per-call budget. Zero dependencies, no browser.
- It guards **algorithmic** regressions only. Each budget sits ~100× above the measured cost, so CPU variance never trips it; a breach means the complexity changed, not that the machine is slow.
- It does **not** cover DOM insertion, style recalculation or paint. Those need `npm run profile:popup`.
- Kept out of `npm test` deliberately: benchmarks are a review signal, not a correctness gate. Run them before touching `src/shared/map-preview.js`, `src/shared/state.js` or the projection math in `src/shared/utils.js`.

### Local Extension Loading
- Chrome: `chrome://extensions/` → Enable **Developer mode** → **Load unpacked** (select root).
- Reload extension after code changes.
- `tools/profile-popup.mjs` resolves the extension ID from `chrome://extensions`, so load the unpacked extension before profiling.

---

## 2. Core Architectural Rules

- **Zero-Build Architecture (native ES modules)**: No bundler, no build step, no transpile step. Each page loads a single `<script type="module">` entrypoint (`src/popup/controller.js`, `src/options/options.js`) and every shared file is wired with native `import` / `export`. Chrome resolves the dependency graph and load order itself, so the old "respect `<script>` order" rule is gone — the module graph must stay acyclic, and a missing or cyclic import now fails loudly at parse time instead of silently yielding `undefined`. The `globalThis.X = X` tails at the bottom of each module are a deliberate escape hatch only: `src/shared/theme.js` still loads as a classic `<script>` in `<head>` to avoid theme flash, and the rest keeps the objects reachable from DevTools.
- **State & Limits**:
  - `CONFIG` (`src/shared/config.js`) holds single source of truth for defaults.
  - City limit is fixed at 10 (`CONFIG.maxCities = 10`), non-FIFO (blocks further additions when full).
  - Synchronous preference cache in `localStorage` prevents theme/language flashes.
- **UI & Design Tokens**:
  - Settings rows strictly follow `.control-group` (`.control-label` 16px / font-weight 500, `.control-desc` 14px).
  - Explicit `<div class="divider"></div>` maintains 12px (`var(--space-md)`) margin above and below.
- **i18n Integrity**:
  - Supported: `zh` (zh-TW), `en` (en-US), `es` (es-ES).
  - HTML `data-i18n*` keys must exist across all 3 languages in `src/shared/i18n.js`.
- **MV3 Security**:
  - No inline HTML handlers (`onclick="..."`). Use `addEventListener`.
  - No unescaped `innerHTML`. Use `EscapeUtils.html` or `textContent`.

---

## 3. Feature Checklist

When adding a new setting or feature:
1. [ ] **Config / State**: Register key & default in `src/shared/config.js`, handle persistence in `state.js`.
2. [ ] **i18n**: Add strings for `zh`, `en`, and `es` in `src/shared/i18n.js`.
3. [ ] **UI**: Add `.control-group` row in `options.html` (and `popup.html` if exposed).
4. [ ] **Styles**: Declare any new `var(--x)` in a stylesheet the page actually loads. `check-css.mjs` resolves references per page, so a token defined only in `popup/settings.css` is invisible to `options.html`.
5. [ ] **Verification**: Run `npm test` (0 failures). New logic in `src/shared/` needs a case in `tests/`.

---

## 4. Known Issues & Tech Debt
- *(None currently)*

---

## 5. Android App (Capacitor)

### Prerequisites
- Android Studio (bundled JBR + SDK Manager)
- `ANDROID_HOME` pointing at the SDK, or `android/local.properties` with `sdk.dir`
- A device with USB debugging, or an emulator

Java is not on PATH on this machine; point Gradle at Android Studio's JBR for the build:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

### Build
```bash
npm run android:sync
cd android
./gradlew.bat assembleDebug   # Windows
./gradlew assembleDebug       # macOS/Linux
```
Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Icons
Regenerate launcher icons from `assets/icon128.png`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-android-icons.ps1
```

### Release
1. Create the keystore and back it up outside the repo:
   ```bash
   mkdir -p android/keystore
   keytool -genkeypair -v -keystore android/keystore/timemapper-release.jks -alias timemapper -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the passwords.
3. Build: `cd android && ./gradlew.bat assembleRelease`
4. Output: `android/app/build/outputs/apk/release/app-release.apk`

### Versioning
Keep `manifest.json`, `package.json`, and `android/app/build.gradle` aligned:
- `versionName`: same as `manifest.json`
- `versionCode`: `major*10000 + minor*100 + patch` (2.5.2 → 20502)

### Verification
Run `npm test` after shared-module changes. Install with `adb install -r <apk>` and walk the acceptance checklist in `docs/superpowers/specs/2026-10-29-android-app-design.md`.
