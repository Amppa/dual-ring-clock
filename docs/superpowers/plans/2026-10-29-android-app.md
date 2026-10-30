# TimeMapper Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a sideloadable Android APK whose main screen and settings match the TimeMapper Chrome extension, by wrapping the existing web UI in Capacitor and adding a mobile shell plus touch support.

**Architecture:** Capacitor serves a staged copy of `src/` and `assets/` inside an Android WebView. A new `src/app/` shell reuses every shared module, while the extension's popup and options stay in place. Settings are local-only via the existing `localStorage` fallback.

**Tech Stack:** Vanilla ES modules, CSS, Node 24 build script, Capacitor (latest stable), Android Gradle project.

**Spec:** `docs/superpowers/specs/2026-10-29-android-app-design.md`

## Global Constraints

- Work on branch `feat/android-app` in the git worktree at `../time-mapper-android` (sibling of this repo); never commit directly to `master` and never merge without the developer's instruction (`AGENTS.md` §2).
- Commit in stages: every task checkpoint and every independently verified logical unit gets its own commit. Never bundle multiple tasks, unrelated fixes, or refactors into one commit; each commit must be independently revertable. Commits and code comments are English, imperative mood.
- `npm test` must pass before every commit that touches `src/`, `tools/`, or `package.json`. Documentation-only commits skip it.
- No automated browser/headless/device verification. Human verification only (`AGENTS.md` §4).
- `applicationId` is `com.amppa.timemapper`; `versionName` is `2.5.2`; `versionCode` follows `major*10000 + minor*100 + patch` → `20502`.
- Android manifest requests only `android.permission.INTERNET`.
- Storage is local-only (no sync, no export). Do not add chrome storage or Drive code.
- Do not alter extension visuals. The only permitted shared changes are: guarded chrome listener, pointer-based scrub, hour label wrapped in a span, hidden touch-only controls, and CSS variables with unchanged desktop defaults.
- Capacitor release/build versions are whatever `npm view @capacitor/core version` reports at install time; pin them in `package.json`.

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/app/index.html` | Mobile main-screen markup (map, timeline, floating bottom navigation) |
| `src/app/app.css` | Mobile layout, safe areas, touch targets, hour-label thinning |
| `src/app/app.js` | State init, renderer wiring, minute tick |
| `src/shared/bottom-bar.css` | Shared floating Home/Settings navigation for the app shell |
| `src/options/options.html` | Add app back link and preview toggle (hidden outside touch devices) |
| `src/options/options.js` | Guard chrome listener, wire back link and preview toggle |
| `src/options/options.css` | Touch-only layout for the settings page |
| `src/options/options-cities.css` | Pointer-drag handle layout and city card styles |
| `src/shared/timeline-preview.js` | Pointer-event scrub; hour label span |
| `src/shared/city-preview.js` | Move-up/down reorder buttons and `moveCity` |
| `src/popup/timeline.css` | Label-width variable, touch-action rules |
| `tools/build-android-web.mjs` | Stage `src/` + `assets/` into `android-web/` with a root redirect |
| `capacitor.config.json` | App ID, name, webDir, https scheme |
| `android/` | Capacitor-generated Gradle project, committed |
| `android/keystore.properties` | Signing credentials (gitignored, never committed) |
| `DEVELOPMENT.md` | Build/run/sign/version instructions |

---

### Task 1: Guard the extension-only storage listener

The options page calls `chrome.storage.onChanged` unconditionally at `src/options/options.js:533`; in a plain WebView `chrome` is undefined and the page throws before rendering. This must land before the app can load settings.

**Files:**
- Modify: `src/options/options.js:532-544`

**Interfaces:**
- Consumes: nothing.
- Produces: options page boots without chrome APIs; extension listener behaviour unchanged.

- [ ] **Step 1: Wrap the listener in a capability guard**

Replace the block

```js
  const syncedKeys = new Set(Object.values(CONFIG.syncKeys));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (CityPreview.isReordering) return;
    if (!Object.keys(changes).some((key) => syncedKeys.has(key))) return;
    State.init().then(() => {
      applyLanguage();
      renderMapControls();
      renderPeriodControls();
      renderThemeSegment();
      renderPreviews();
    });
  });
```

with

```js
  const syncedKeys = new Set(Object.values(CONFIG.syncKeys));
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (CityPreview.isReordering) return;
      if (!Object.keys(changes).some((key) => syncedKeys.has(key))) return;
      State.init().then(() => {
        applyLanguage();
        renderMapControls();
        renderPeriodControls();
        renderThemeSegment();
        renderPreviews();
      });
    });
  }
```

- [ ] **Step 2: Run the regression gate**

Run: `npm test`
Expected: i18n check, CSS check and all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/options/options.js
git commit -m "fix(options): guard chrome storage listener for non-extension hosts"
```

---

### Task 2: Scrub dragging via pointer events

Current dragging listens to `mousedown` / `mousemove` / `mouseup` (`src/shared/timeline-preview.js:324,399,432`), which never fires for touch. Pointer events cover both mouse and touch with one state machine.

**Files:**
- Modify: `src/shared/timeline-preview.js:324-447`
- Modify: `src/popup/timeline.css` (append after the `.hours` rule)

**Interfaces:**
- Consumes: existing `State.scrubs`, `State.activeScrubId`, `api.renderScrubLine`, `api.renderNightArea`, `this.renderIntervals`.
- Produces: `TimelinePreview.wireScrub(refs, api)` unchanged in signature; drag works with mouse, pen and finger.

- [ ] **Step 1: Switch the drag start to `pointerdown`**

In `wireScrub`, change the local state declarations from

```js
    let isDragging = false;
    let activeDragScrubId = null;
    let cachedOverlayRect = null;
```

to

```js
    let isDragging = false;
    let activeDragScrubId = null;
    let activePointerId = null;
    let cachedOverlayRect = null;
```

Replace the listener header

```js
    refs.timelinePanel.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Left click only
      if (e.target.closest(".scrub-reset-btn")) return; // Let close button handler work
```

with

```js
    refs.timelinePanel.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".scrub-reset-btn")) return; // Let close button handler work
```

After `isDragging = true;` add one line:

```js
        activePointerId = e.pointerId;
```

Replace the trailing `e.preventDefault();` of that block with

```js
        e.preventDefault();
        refs.timelinePanel.setPointerCapture?.(e.pointerId);
```

- [ ] **Step 2: Replace the document mouse listeners**

Replace the `document.addEventListener("mousemove", ...)` body's guard

```js
      if (!isDragging || !activeDragScrubId) return;
```

with

```js
      if (!isDragging || !activeDragScrubId || e.pointerId !== activePointerId) return;
```

and rename the event from `"mousemove"` to `"pointermove"`.

Replace the entire `document.addEventListener("mouseup", ...)` block with

```js
    const stopDragging = (e) => {
      if (e.pointerId !== activePointerId) return;
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      pendingClientX = null;
      if (isDragging) {
        isDragging = false;
        activeDragScrubId = null;
        cachedOverlayRect = null;
        if (refs.scrubLinesContainer) {
          refs.scrubLinesContainer.querySelectorAll(".scrub-line-group, .scrub-line, .scrub-handle, .scrub-knob-top, .scrub-knob-bottom").forEach((el) => {
            el.classList.remove("is-dragging");
          });
        }
      }
      if (refs.timelinePanel.hasPointerCapture?.(e.pointerId)) {
        refs.timelinePanel.releasePointerCapture(e.pointerId);
      }
      activePointerId = null;
    };

    document.addEventListener("pointerup", stopDragging);
    document.addEventListener("pointercancel", stopDragging);
```

- [ ] **Step 3: Allow vertical scrolling while scrubbing horizontally**

Append to `src/popup/timeline.css`:

```css
/* Horizontal scrubbing must not block vertical page scrolling on touch. */
.hours,
.scrub-handle,
.scrub-knob-top,
.scrub-knob-bottom {
  touch-action: pan-y;
}
```

- [ ] **Step 4: Run the regression gate**

Run: `npm test`
Expected: all checks pass (no unit test covers DOM drag; this is the regression gate).

- [ ] **Step 5: Manual mouse check**

Load the unpacked extension, open the popup, and confirm: click places a scrub, drag moves it smoothly, four-scrub cap holds, `[x]` still removes, interval labels update.

- [ ] **Step 6: Commit**

```bash
git add src/shared/timeline-preview.js src/popup/timeline.css
git commit -m "refactor(timeline): drag scrub lines with pointer events"
```

---

### Task 3: Label-width token and hour label span

The timeline hardcodes a 120px city-label column (`src/popup/timeline.css:24,108`). Mobile needs a smaller value without changing desktop.

**Files:**
- Modify: `src/popup/timeline.css:22-28` and `src/popup/timeline.css:103-108`
- Modify: `src/shared/timeline-preview.js:111-118`

**Interfaces:**
- Consumes: existing render loop.
- Produces: `--timeline-label-width` CSS variable (default `120px`); `.hour-cell > .hour-label` span for responsive thinning.

- [ ] **Step 1: Parameterise the label width**

Change

```css
.timeline-row {
  display: grid;
  grid-template-columns: 120px 1fr;
```

to

```css
.timeline-row {
  display: grid;
  grid-template-columns: var(--timeline-label-width, 120px) 1fr;
```

Change

```css
  left: 120px;
```

to

```css
  left: var(--timeline-label-width, 120px);
```

- [ ] **Step 2: Wrap the hour text in a span**

In `renderRows`, replace

```js
        const hourStr = String(cityHour).padStart(2, "0");
        cell.textContent = hourStr;
        cell.title = `${cityName} ${hourStr}:00`;
```

with

```js
        const hourStr = String(cityHour).padStart(2, "0");
        const hourLabel = document.createElement("span");
        hourLabel.className = "hour-label";
        hourLabel.textContent = hourStr;
        cell.append(hourLabel);
        cell.title = `${cityName} ${hourStr}:00`;
```

- [ ] **Step 3: Run the regression gate**

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 4: Manual popup check**

Open the extension popup and confirm hour numbers and date badges render exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/popup/timeline.css src/shared/timeline-preview.js
git commit -m "refactor(timeline): expose label width token and hour label span"
```

---

### Task 4: Touch reorder buttons for the city list

> **Superseded during Android acceptance:** the move-up/down buttons were replaced by a unified pointer drag on the `⋮⋮` handle (spec D5). The steps below are retained as the historical first pass; the final code lives in `city-preview.js` (`beginPointerDrag`, `reorderIds`).

HTML5 drag (`src/shared/city-preview.js:133`) does not fire on touch. Add move-up/down buttons that edit `State.selectedIds`, hidden on fine-pointer devices so desktop keeps drag.

**Files:**
- Modify: `src/shared/city-preview.js:54-90`, after the `renderCurrentCitiesList` closing brace
- Modify: `src/options/options-cities.css` (append at end)

**Interfaces:**
- Consumes: `State.selectedIds`, `State.saveSelection()`, any `onReorder` callback passed by options.
- Produces: `CityPreview.moveCity(id, delta, refs, onReorder)`; new DOM `.city-order-buttons`, `.move-city-up`, `.move-city-down`.

- [ ] **Step 1: Add the buttons to the card markup**

Inside the `card.innerHTML` template, after the remove button line, add:

```html
        <div class="city-order-buttons">
          <button type="button" class="move-city-btn move-city-up" aria-label="Move up">↑</button>
          <button type="button" class="move-city-btn move-city-down" aria-label="Move down">↓</button>
        </div>
```

- [ ] **Step 2: Wire the buttons**

Change `State.selectedIds.forEach((id) => {` to `State.selectedIds.forEach((id, index) => {`.

After the `const dragHandle = card.querySelector(".drag-handle");` line, add:

```js
      const moveUpBtn = card.querySelector(".move-city-up");
      const moveDownBtn = card.querySelector(".move-city-down");
      moveUpBtn.disabled = index === 0;
      moveDownBtn.disabled = index === State.selectedIds.length - 1;
      moveUpBtn.addEventListener("click", () => CityPreview.moveCity(id, -1, refs, onReorder));
      moveDownBtn.addEventListener("click", () => CityPreview.moveCity(id, 1, refs, onReorder));
```

- [ ] **Step 3: Add the move helper**

Immediately after the closing brace of `renderCurrentCitiesList`, add:

```js
  moveCity(id, delta, refs, onReorder) {
    const from = State.selectedIds.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= State.selectedIds.length) return;

    const list = [...State.selectedIds];
    list.splice(from, 1);
    list.splice(to, 0, id);
    State.selectedIds = list;
    State.saveSelection();

    CityPreview.renderCurrentCitiesList(refs, onReorder);
    if (typeof onReorder === "function") onReorder();
  },
```

- [ ] **Step 4: Add touch-only styles**

Append to `src/options/options-cities.css`:

```css
/* Touch reorder: desktop keeps HTML5 drag, coarse pointers get explicit buttons. */
.city-order-buttons {
  display: none;
}

@media (pointer: coarse) {
  .drag-handle {
    display: none;
  }

  .current-city-card {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    grid-template-areas:
      "name zone remove"
      "lng lat order";
    row-gap: 6px;
  }

  .current-city-card .city-name-input { grid-area: name; }
  .current-city-card .city-zone-select { grid-area: zone; min-width: 0; }
  .current-city-card .city-lng-input { grid-area: lng; }
  .current-city-card .city-lat-input { grid-area: lat; }
  .current-city-card .remove-city-card-btn { grid-area: remove; }
  .city-order-buttons { grid-area: order; display: flex; gap: 4px; justify-content: flex-end; }

  .move-city-btn {
    width: 44px;
    height: 44px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 16px;
  }

  .move-city-btn:disabled {
    opacity: 0.35;
  }
}
```

- [ ] **Step 5: Run the regression gate**

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 6: Manual desktop check**

Open settings in Chrome: drag handles still reorder; the new buttons are not visible; first card's up button is disabled in the DOM (verify in DevTools).

- [ ] **Step 7: Commit**

```bash
git add src/shared/city-preview.js src/options/options-cities.css
git commit -m "feat(options): add touch reorder buttons to city cards"
```

---

### Task 5: Mobile app shell

> **Superseded during Android acceptance:** the top header and map-collapse toggle were removed; the main screen now starts with the map and uses a floating Home/Settings bottom bar (spec D4). Each timeline row also stacks a full-width city/time header above the 24-hour strip (spec D18). The steps below are retained as the historical first pass.

Create the main-screen shell that reuses `Renderer`, `MapPreview`, `TimelinePreview`, `State` and `Storage`. It runs in both a desktop browser and the Android WebView, so it can be developed without a device.

**Files:**
- Create: `src/app/index.html`
- Create: `src/app/app.css`
- Create: `src/app/app.js`

**Interfaces:**
- Consumes: `State.init()`, `Renderer.render()`, `Renderer.renderScrubLine()`, `Renderer.renderNightArea(offsetHours)`, `TimelinePreview.wireScrub(refs, api)`, `TimelinePreview.collectRefs(document)`, `MapPreview.wireMapClick(refs, onCityAdded)`, `MapPreview.collectRefs(document)`, `I18nUtils.applyAttributes()`.
- Produces: mounted DOM IDs used by the shared modules; `location.href` navigation to `../options/options.html?from=app`; no chrome APIs.

- [ ] **Step 1: Create the shell markup**

Create `src/app/index.html`:

```html
<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>TimeMapper</title>
  <link rel="stylesheet" href="../shared/tokens.css">
  <link rel="stylesheet" href="../shared/map-tokens.css">
  <link rel="stylesheet" href="../popup/settings.css">
  <link rel="stylesheet" href="../popup/map.css">
  <link rel="stylesheet" href="../popup/timeline.css">
  <link rel="stylesheet" href="app.css">
  <script src="../shared/theme.js"></script>
</head>

<body>
  <main class="app app-mobile">
    <header class="topbar">
      <div class="topbar-left">
        <h1 id="nowText" data-i18n="nowTextLoading">Loading current time...</h1>
      </div>
      <div class="topbar-center">
        <span class="topbar-brand">TimeMapper</span>
      </div>
      <div class="topbar-right">
        <button id="mapToggle" class="map-toggle" type="button" aria-label="Toggle map" aria-expanded="true">▾</button>
        <button id="topbarOptionsButton" class="settings-button" type="button" title="Settings" aria-label="Settings"
          data-i18n-title="mapSettings" data-i18n-aria-label="mapSettings">
          <span class="settings-icon" aria-hidden="true">⚙️</span>
        </button>
      </div>
    </header>

    <section class="map-panel">
      <div class="map-content">
        <div class="map-shell">
          <img class="world-map" src="../../assets/world-map.jpg" fetchpriority="high" decoding="async" alt="World Map">
          <div class="hour-lines" aria-hidden="true"></div>
          <svg id="nightAreaOverlay" class="night-area-overlay" viewBox="0 0 100 100" preserveAspectRatio="none"
            aria-hidden="true">
            <path id="nightPath" d=""></path>
            <path id="nightPathRef" d=""></path>
          </svg>
          <div id="timezoneHoverBands" class="timezone-hover-bands"></div>
          <div id="cityLayer" class="city-layer" aria-label="City Pins"></div>
          <div id="mapTimeLabelLayer" class="map-time-label-layer" aria-hidden="true"></div>
        </div>
        <div id="mapTimeline" class="map-timeline" aria-hidden="true"></div>
      </div>
    </section>

    <section class="timeline-panel" aria-label="Timeline">
      <div id="timelineRows" class="timeline-rows"></div>
      <div id="timelineTrackOverlay" class="timeline-track-overlay">
        <div id="timelineIntervalsContainer" class="timeline-intervals-container" aria-hidden="true"></div>
        <div id="nowLine" class="timeline-vline now-line" aria-hidden="true"></div>
        <div id="scrubLinesContainer"></div>
      </div>
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>

</html>
```

- [ ] **Step 2: Create the mobile stylesheet**

Create `src/app/app.css`:

```css
:root {
  --timeline-label-width: 76px;
  --timeline-cell-font-size: 9px;
}

html,
body {
  height: 100%;
}

body {
  width: auto;
  min-height: 100dvh;
  margin: 0;
  padding:
    calc(env(safe-area-inset-top, 0px) + 6px)
    calc(env(safe-area-inset-right, 0px) + 8px)
    calc(env(safe-area-inset-bottom, 0px) + 10px)
    calc(env(safe-area-inset-left, 0px) + 8px);
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.app.app-mobile {
  width: 100%;
  padding: 0;
}

.app-mobile .topbar {
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
}

.app-mobile .topbar-brand {
  font-size: 18px;
}

.app-mobile .topbar-right {
  gap: 6px;
}

.app-mobile #nowText {
  font-size: 20px;
}

.app-mobile .now-date {
  font-size: 11px;
}

.map-toggle {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
}

.app-mobile.map-collapsed .map-panel {
  display: none;
}

.app-mobile .map-content {
  padding: 6px;
}

.app-mobile .map-timeline {
  height: 20px;
}

.app-mobile .timeline-panel {
  margin: 10px 0 0;
}

.app-mobile .timeline-rows {
  max-height: none;
}

.app-mobile .timeline-row {
  grid-template-columns: var(--timeline-label-width) minmax(0, 1fr);
  min-height: 48px;
}

.app-mobile .city-label {
  padding: 6px 4px 6px 8px;
}

.app-mobile .city-name {
  font-size: 12px;
}

.app-mobile .city-time {
  font-size: 9px;
}

.app-mobile .hour-cell:nth-child(odd) .hour-label {
  visibility: hidden;
}

.app-mobile .date-badge {
  top: 2px;
  font-size: 8px;
}

@media (pointer: coarse) {
  .app-mobile .timezone-hover-bands {
    display: none;
  }

  .app-mobile .city-pin {
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    border-width: 2px;
  }

  .app-mobile .scrub-handle {
    width: 44px;
  }

  .app-mobile .scrub-reset-btn {
    width: 20px;
    height: 20px;
  }
}
```

- [ ] **Step 3: Create the wiring script**

Create `src/app/app.js`:

```js
import { State } from "../shared/state.js";
import { Renderer } from "../popup/renderer.js";
import { I18nUtils } from "../shared/utils.js";
import { TimelinePreview } from "../shared/timeline-preview.js";
import { MapPreview } from "../shared/map-preview.js";

const appEl = document.querySelector(".app");
const mapToggle = document.getElementById("mapToggle");
const settingsButton = document.getElementById("topbarOptionsButton");

function setMapCollapsed(collapsed) {
  appEl.classList.toggle("map-collapsed", collapsed);
  mapToggle.setAttribute("aria-expanded", String(!collapsed));
  mapToggle.textContent = collapsed ? "▸" : "▾";
}

async function repaint() {
  await State.init();
  I18nUtils.applyAttributes();
  Renderer.render();
}

async function init() {
  await repaint();

  TimelinePreview.wireScrub(TimelinePreview.collectRefs(document), {
    renderScrubLine: () => Renderer.renderScrubLine(),
    renderNightArea: (offsetHours) => Renderer.renderNightArea(offsetHours)
  });
  MapPreview.wireMapClick(MapPreview.collectRefs(document), () => Renderer.render());

  settingsButton?.addEventListener("click", () => {
    location.href = "../options/options.html?from=app";
  });

  mapToggle?.addEventListener("click", () => {
    setMapCollapsed(!appEl.classList.contains("map-collapsed"));
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) repaint();
  });

  setInterval(() => Renderer.render(), 60 * 1000);
}

init();
```

- [ ] **Step 4: Serve and compare in a desktop browser**

From the repo root run `npx http-server -p 8080` (or any static server) and open `http://localhost:8080/src/app/index.html`.
Expected: the same four default cities, map, now line and timeline as the popup; no console errors about `chrome`; the gear navigates to the options page; `?from=app` is present in the URL.

- [ ] **Step 5: Run the regression gate**

Run: `npm test`
Expected: all checks pass (new files add no linted i18n keys).

- [ ] **Step 6: Commit**

```bash
git add src/app/index.html src/app/app.css src/app/app.js
git commit -m "feat(app): add mobile shell reusing shared preview modules"
```

---

### Task 6: Mobile settings adjustments

> **Superseded during Android acceptance:** settings now runs in an iframe preloaded by the shell, so the bottom bar stays mounted and switching does not reload the page. The header back link and the live preview panel were removed, and city cards no longer expose longitude/latitude inputs (spec D15–D17).

The options page already collapses to one column below 1180px, but it needs an in-app back affordance, a preview toggle on touch, and touch-sized spacing.

**Files:**
- Modify: `src/options/options.html` (brand block and header-actions)
- Modify: `src/options/options.js` (after the DOM element declarations near line 34)
- Modify: `src/options/options.css` (append at end)
- Modify: `src/options/options.js:532` already guarded in Task 1

**Interfaces:**
- Consumes: `location.search`, `history.back()`, `.main-layout`, `#cardPreview`.
- Produces: `#appBackButton` (visible only with `?from=app`), `#previewToggle`, `.main-layout.preview-collapsed`.

- [ ] **Step 1: Add the back link and preview toggle markup**

Inside `.brand`, before the logo `<img>`:

```html
        <a id="appBackButton" class="app-back" href="../app/index.html" aria-label="Back" hidden>←</a>
```

Inside `.header-actions`, before the language label:

```html
        <button id="previewToggle" class="preview-toggle" type="button" aria-expanded="true"
          aria-controls="cardPreview" data-i18n="previewCardTitle">預覽</button>
```

- [ ] **Step 2: Wire both controls**

After the `const themeSelect = document.getElementById("themeSelect");` line, add:

```js
  const appBackButton = document.getElementById("appBackButton");
  const previewToggle = document.getElementById("previewToggle");
  const mainLayout = document.querySelector(".main-layout");

  if (appBackButton && new URLSearchParams(location.search).get("from") === "app") {
    appBackButton.hidden = false;
    appBackButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (history.length > 1) history.back();
      else location.href = "../app/index.html";
    });
  }

  if (previewToggle && mainLayout) {
    previewToggle.addEventListener("click", () => {
      const collapsed = mainLayout.classList.toggle("preview-collapsed");
      previewToggle.setAttribute("aria-expanded", String(!collapsed));
    });
  }
```

- [ ] **Step 3: Add the touch-only styles**

Append to `src/options/options.css`:

```css
/* App-only affordances: hidden on desktop, shown for coarse pointers. */
.app-back {
  display: none;
}

.app-back:not([hidden]) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--divider);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 18px;
}

.preview-toggle {
  display: none;
}

@media (pointer: coarse) {
  body {
    padding: 12px 10px calc(env(safe-area-inset-bottom, 0px) + 16px);
  }

  .header {
    flex-wrap: wrap;
    gap: 10px;
  }

  .preview-toggle {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-primary);
  }

  .main-layout.preview-collapsed .preview-column {
    display: none;
  }
}
```

- [ ] **Step 4: Run the regression gate**

Run: `npm test`
Expected: all checks pass, including the i18n key check (`previewCardTitle` already exists).

- [ ] **Step 5: Manual desktop check**

Open options without `?from=app`: no back link, no preview toggle, layout unchanged. Open `src/options/options.html?from=app` through the local server: back link appears; clicking it returns to the shell.

- [ ] **Step 6: Commit**

```bash
git add src/options/options.html src/options/options.js src/options/options.css
git commit -m "feat(options): add app back link and touch preview toggle"
```

---

### Task 7: Stage web assets for Android

Capacitor copies a single `webDir`; the repo root contains files that must not ship. Stage only `src/` and `assets/` and add a root redirect to the app shell.

**Files:**
- Create: `tools/build-android-web.mjs`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `src/`, `assets/`.
- Produces: `android-web/index.html`, `android-web/src/**`, `android-web/assets/**`.

- [ ] **Step 1: Create the staging script**

Create `tools/build-android-web.mjs`:

```js
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "android-web");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, "src"), path.join(out, "src"), { recursive: true });
await cp(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });
await writeFile(
  path.join(out, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>TimeMapper</title><script>location.replace("./src/app/index.html");</script>\n'
);

console.log(`[android] staged web assets at ${out}`);
```

- [ ] **Step 2: Add npm scripts**

In `package.json`, add to `"scripts"`:

```json
    "android:web": "node tools/build-android-web.mjs",
    "android:sync": "npm run android:web && npx cap sync android"
```

- [ ] **Step 3: Ignore generated output**

Append to `.gitignore`:

```
android-web/
android/keystore/
android/keystore.properties
```

- [ ] **Step 4: Verify the staging output**

Run: `npm run android:web`
Then: `ls android-web/index.html android-web/src/app/index.html android-web/assets/world-map.jpg`
Expected: all three paths exist; `android-web/node_modules` does not exist.

- [ ] **Step 5: Commit**

```bash
git add tools/build-android-web.mjs package.json .gitignore
git commit -m "build(android): stage only web sources for Capacitor"
```

---

### Task 8: Capacitor Android project

Generate the Android project, pin versions, and set identity/version fields.

**Files:**
- Modify: `package.json`, `package-lock.json` (ignored by git but keep local install consistent)
- Create: `capacitor.config.json`
- Create: `android/` (generated, committed)
- Modify: `android/app/build.gradle`
- Verify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `android-web/` from Task 7, `applicationId`/version constants.
- Produces: `android/app/build/outputs/apk/debug/app-debug.apk`.

- [ ] **Step 1: Verify the Android toolchain (human prerequisite)**

Run:
```bash
java -version
echo "$ANDROID_HOME"
```
Expected: a JDK version accepted by the Capacitor release you install, and a valid Android SDK path. If either is missing, stop and ask the developer to install Android Studio + SDK before continuing.

- [ ] **Step 2: Install Capacitor**

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
```

- [ ] **Step 3: Initialise the project**

```bash
npm run android:web
npx cap init "TimeMapper" "com.amppa.timemapper" --web-dir android-web
```
If the CLI asks for a config format, choose JSON. Then ensure `capacitor.config.json` contains exactly:

```json
{
  "appId": "com.amppa.timemapper",
  "appName": "TimeMapper",
  "webDir": "android-web",
  "server": {
    "androidScheme": "https"
  }
}
```

- [ ] **Step 4: Generate and sync the Android project**

```bash
npx cap add android
npx cap sync android
```
Expected: `android/app/src/main/assets/public/index.html` exists.

- [ ] **Step 5: Set version fields**

In `android/app/build.gradle`, inside `defaultConfig`, set:

```gradle
versionCode 20502
versionName "2.5.2"
```

Keep the generated `applicationId`, `minSdkVersion`, and `targetSdkVersion` values.

- [ ] **Step 6: Verify permissions**

Open `android/app/src/main/AndroidManifest.xml` and confirm it contains only:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```
Remove any other `<uses-permission>` entries the template added. Also confirm the `<activity>` has no `android:screenOrientation` attribute, so rotation stays enabled.

- [ ] **Step 6b: Generate the adaptive launcher icon**

In Android Studio, right-click `android/app/src/main/res` → **New → Image Asset**:

- Asset type: **Launcher Icons (Adaptive and Legacy)**
- Name: `ic_launcher`
- Foreground layer: `assets/icon128.png` from the repo, scaled so the globe sits inside the 66dp safe zone
- Background layer: Color `#FFFFFF`

Expected: `mipmap-anydpi-v26/ic_launcher.xml` (and `ic_launcher_round.xml`) exist, and the legacy mipmap PNGs are replaced. Leave the generated launch/splash theme untouched; Android 12+ shows the launcher icon automatically.

- [ ] **Step 7: Build and install the debug APK**

On Windows:
```bash
cd android && ./gradlew.bat assembleDebug
```
On macOS/Linux:
```bash
cd android && ./gradlew assembleDebug
```
Then:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Expected: app launches to the main screen with default cities and no network errors.

- [ ] **Step 8: Manual device checks and the performance gate**

Confirm on the device: main screen renders; tapping a pin toggles it; tapping empty map adds a UTC row; dragging a scrub works; the bottom bar opens settings; the Home item returns; hardware back from settings returns to the main screen (Capacitor's default history behaviour). If hardware back exits the app instead, record it as a defect and rely on the Home item for this milestone.

Measure the WebView against the spec's performance gate before any further polish:

```bash
adb shell am start -W -n com.amppa.timemapper/.MainActivity
adb shell dumpsys gfxinfo com.amppa.timemapper reset
# drag a scrub line for ~5 seconds on the device
adb shell dumpsys gfxinfo com.amppa.timemapper | grep -A 6 "Janky frames"
adb shell dumpsys meminfo com.amppa.timemapper | grep TOTAL
```

Expected: `TotalTime` ≤ 3000 ms cold / ≤ 2000 ms warm; janky frames < 10 % after a 5-second scrub drag; PSS ≤ 200 MB. Record the numbers in the task report. If a threshold fails, stop and raise the go/no-go decision with the developer before continuing; do not silently proceed.

- [ ] **Step 9: Commit**

```bash
git add package.json capacitor.config.json android/
git commit -m "feat(android): add Capacitor project and app identity"
```

---

### Task 9: Release signing and build documentation

**Files:**
- Modify: `android/app/build.gradle`
- Create locally (never commit): `android/keystore/timemapper-release.jks`, `android/keystore.properties`
- Create: `android/keystore.properties.example`
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: applicationId and version fields from Task 8.
- Produces: signed `android/app/build/outputs/apk/release/app-release.apk`; reproducible build/sign instructions.

- [ ] **Step 1: Create the keystore (human-run, password chosen by the developer)**

```bash
mkdir -p android/keystore
keytool -genkeypair -v -keystore android/keystore/timemapper-release.jks -alias timemapper -keyalg RSA -keysize 2048 -validity 10000
```
Back the `.jks` file up outside the repository. It cannot be regenerated without breaking update compatibility.

- [ ] **Step 2: Add the signing config**

Create `android/keystore.properties` (gitignored):

```properties
storeFile=../keystore/timemapper-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=timemapper
keyPassword=YOUR_KEY_PASSWORD
```

At the top of `android/app/build.gradle`, after the existing `apply plugin` lines, add:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android { ... }`, before `buildTypes`, add:

```gradle
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
```

Inside `buildTypes { release { ... } }`, add:

```gradle
            signingConfig signingConfigs.release
```

- [ ] **Step 3: Commit-safe example file**

Create `android/keystore.properties.example`:

```properties
storeFile=../keystore/timemapper-release.jks
storePassword=CHANGE_ME
keyAlias=timemapper
keyPassword=CHANGE_ME
```

- [ ] **Step 4: Document the Android workflow**

Append to `DEVELOPMENT.md`:

```markdown
## Android App (Capacitor)

### Prerequisites
- Android Studio with a current Android SDK
- JDK version required by the installed Capacitor release
- `ANDROID_HOME` pointing at the SDK

### Build
```bash
npm run android:sync        # stage web assets + copy into android/
cd android && ./gradlew.bat assembleDebug   # Windows
cd android && ./gradlew assembleDebug       # macOS/Linux
```
Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release
1. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the passwords.
2. Keep `android/keystore/timemapper-release.jks` backed up outside the repository.
3. Build: `cd android && ./gradlew.bat assembleRelease`
4. Output: `android/app/build/outputs/apk/release/app-release.apk`

### Versioning
Keep `manifest.json`, `package.json`, and `android/app/build.gradle` aligned:
- `versionName`: same as `manifest.json`
- `versionCode`: `major*10000 + minor*100 + patch` (2.5.2 → 20502)

### Verification
Run `npm test` after shared-module changes. Install the APK on a device with `adb install -r <apk>` and walk the acceptance checklist in `docs/superpowers/specs/2026-10-29-android-app-design.md`.
```

- [ ] **Step 5: Build the release APK**

```bash
npm run android:sync
cd android && ./gradlew.bat assembleRelease
```
Expected: `android/app/build/outputs/apk/release/app-release.apk` exists and installs with `adb install -r`.

- [ ] **Step 6: Commit**

```bash
git add android/app/build.gradle android/keystore.properties.example DEVELOPMENT.md
git commit -m "build(android): add release signing config and build docs"
```

---

### Task 10: Device acceptance pass

**Files:**
- Modify only files needed to fix defects found during the pass.

**Interfaces:**
- Consumes: the release APK from Task 9.
- Produces: a verified APK; fixes committed separately.

- [ ] **Step 1: Install the release APK**

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 2: Walk the acceptance checklist**

From the spec (`docs/superpowers/specs/2026-10-29-android-app-design.md` §8):

1. Cold start shows local time and the default four cities.
2. Pin tap adds/removes a city; empty-map tap adds the correct UTC row; the 10-city cap holds.
3. Timeline shows 24 hours with a city/time header above each strip, date badges at 00:00 and row start, night shading and the now line.
4. Tap places a scrub; horizontal drag moves it; vertical drag over the timeline scrolls the page; `[x]` removes it; four-scrub cap holds; interval labels update.
5. Map is always visible; hover-only decorations are absent.
6. Settings: rename city, change timezone, remove, reorder by dragging the `⋮⋮` handle, clear all, search Open-Meteo and add a result, edit map calibration (numeric only) and reset, change period count and drag dividers, change now-line reference, change language and theme.
7. The bottom bar opens settings in-app without reloading the page (the bar stays mounted); hardware back and the Home item return to the main screen; changes are reflected.
8. Data survives app restart and rotation; the launcher shows the TimeMapper adaptive icon.
9. Airplane mode: local data loads; city search fails with the existing inline status and the page keeps working.

- [ ] **Step 3: Run the regression gate**

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 4: Fix defects one commit at a time**

For every defect, make the smallest change, re-run `npm test`, rebuild, and commit with a message scoped to the affected module (for example `fix(app): keep map toggle height on narrow screens`). Do not bundle unrelated fixes.

- [ ] **Step 5: Final report**

Report the installed APK path, the device/Android version used, and any checklist items that could not be verified. Do not claim the work is complete without the checklist results.

---

## Definition of Done

- `android-web/` staging produces only `src/`, `assets/` and the root redirect.
- Debug and release APKs build and install on a physical device.
- The acceptance checklist passes, or every exception is reported with evidence.
- `npm test` passes.
- No secrets (`*.jks`, `keystore.properties`) are committed.
- Extension popup/options still behave as before on desktop.
