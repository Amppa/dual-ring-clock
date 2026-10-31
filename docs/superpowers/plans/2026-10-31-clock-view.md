# 24-Hour Clock View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the empty `#clockView` with a local-time 24-hour analog dial (hour/minute hands, 0–23 scale) and a list of selected cities showing each city's date and local time in large type.

**Architecture:** One new self-contained module, `ClockView`, builds the dial marks once at init and re-renders hands plus the city list from `State` and `new Date()` on every minute tick. Markup and a dedicated stylesheet live in `src/app/`; colors come entirely from existing CSS tokens. `app.js` owns the lifecycle and only calls into the view.

**Tech Stack:** Zero-build native ES modules, SVG, CSS custom properties, `Intl.DateTimeFormat` through `TimeUtils`.

**Spec:** `docs/superpowers/specs/2026-10-31-clock-view-design.md`

## Global Constraints

- Work on branch `feat/clock-view`; never commit to `master`.
- Zero-build native ES modules; do not add dependencies or build tooling.
- Do not modify `src/shared/state.js`, `src/shared/utils.js`, or `src/shared/config.js`.
- Every visible string must go through `src/shared/i18n.js` for `zh`, `en`, and `es`.
- Time display uses `hourCycle: "h23"` (`00:00`–`23:59`), never `24:00`.
- Dial orientation is fixed: 0 at the top, clockwise 0→23.
- Use existing CSS tokens only; no hard-coded colors.
- Escape user-provided city names with `EscapeUtils.html()`.
- Per `AGENTS.md`, do not run automated/headless/browser verification. Verification is manual in `npm run dev` → `http://127.0.0.1:4173/_dev`.
- Commit after each task with only the files listed for that task.
- Minute updates align to the wall-clock minute boundary, not to page load time.

---

### Task 1: Clock view shell, styles, and strings

**Files:**
- Modify: `src/app/index.html:10` (stylesheet link), `src/app/index.html:21` (`#clockView`)
- Create: `src/app/clock.css`
- Modify: `src/shared/i18n.js:5`, `src/shared/i18n.js:74`, `src/shared/i18n.js:142`

**Interfaces:**
- Consumes: existing design tokens in `src/shared/tokens.css` and bottom-bar layout.
- Produces: DOM ids `#clockDial`, `#clockTicks`, `#clockNumerals`, `#clockHourHand`, `#clockMinuteHand`, `#clockCityList`; classes `.clock-*`; i18n keys `clockLocalTime`, `clockSelectedCities`, `clockEmptyCities`, `clockDialAriaLabel`.

- [ ] **Step 1: Add the clock stylesheet link**

In `src/app/index.html`, after the bottom-bar stylesheet link:

```html
  <link rel="stylesheet" href="../shared/bottom-bar.css">
  <link rel="stylesheet" href="clock.css">
```

- [ ] **Step 2: Replace the empty clock view with the page skeleton**

Replace `src/app/index.html` line 21:

```html
    <div id="clockView" class="view"></div>
```

with:

```html
    <div id="clockView" class="view">
      <section class="clock-page">
        <div class="clock-face-wrap">
          <svg id="clockDial" class="clock-dial" viewBox="0 0 200 200" role="img" aria-label="">
            <circle class="clock-bezel" cx="100" cy="100" r="96"></circle>
            <g id="clockTicks" aria-hidden="true"></g>
            <g id="clockNumerals" class="clock-numerals" aria-hidden="true"></g>
            <line id="clockHourHand" class="clock-hand clock-hand--hour" x1="100" y1="100" x2="100" y2="52"></line>
            <line id="clockMinuteHand" class="clock-hand clock-hand--minute" x1="100" y1="100" x2="100" y2="30"></line>
            <circle class="clock-pivot" cx="100" cy="100" r="4.5"></circle>
          </svg>
          <p class="clock-local-label" data-i18n="clockLocalTime">本地時間</p>
        </div>
        <section class="clock-cities" aria-labelledby="clockCitiesTitle">
          <h2 id="clockCitiesTitle" class="clock-section-title" data-i18n="clockSelectedCities">已選取的城市</h2>
          <ul id="clockCityList" class="clock-city-list"></ul>
        </section>
      </section>
    </div>
```

- [ ] **Step 3: Create `src/app/clock.css`**

```css
#clockView[hidden] {
  display: none;
}

.clock-page {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.clock-face-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.clock-dial {
  width: min(72vw, 320px);
  aspect-ratio: 1;
  display: block;
}

.clock-bezel {
  fill: var(--bg-card);
  stroke: var(--divider);
  stroke-width: 1;
}

.clock-tick {
  stroke: var(--text-secondary);
  stroke-width: 1;
}

.clock-tick--major {
  stroke: var(--text-primary);
  stroke-width: 2;
}

.clock-numeral {
  fill: var(--text-secondary);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.clock-numeral--major {
  fill: var(--text-primary);
  font-weight: 600;
}

.clock-hand {
  stroke-linecap: round;
}

.clock-hand--hour {
  stroke: var(--text-primary);
  stroke-width: 5;
}

.clock-hand--minute {
  stroke: var(--accent-solid);
  stroke-width: 3;
}

.clock-pivot {
  fill: var(--accent-solid);
}

.clock-local-label {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  letter-spacing: 0.08em;
}

.clock-cities {
  display: flex;
  flex-direction: column;
}

.clock-section-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 4px;
}

.clock-city-list {
  list-style: none;
}

.clock-city-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 4px;
  border-top: 1px solid var(--divider);
}

.clock-city-row:first-child {
  border-top: 0;
}

.clock-city-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.clock-city-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.clock-city-date {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

.clock-day-shift {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  background: var(--btn-bg);
  border-radius: var(--radius-pill);
  padding: 1px 6px;
}

.clock-city-time {
  font-size: clamp(1.9rem, 9vw, 2.75rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  color: var(--text-primary);
}

.clock-empty {
  padding: 28px 4px;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-sm);
}
```

- [ ] **Step 4: Add the four i18n keys to each dictionary**

In `src/shared/i18n.js`, in the `zh` dictionary, after `navSettings: "設定",`:

```js
    clockLocalTime: "本地時間",
    clockSelectedCities: "已選取的城市",
    clockEmptyCities: "尚未選取城市，請到設定新增",
    clockDialAriaLabel: "本地時間 {time}，24 小時制",
```

In the `en` dictionary, after `navSettings: "Settings",`:

```js
    clockLocalTime: "Local time",
    clockSelectedCities: "Selected cities",
    clockEmptyCities: "No cities selected. Add some in Settings.",
    clockDialAriaLabel: "Local time {time}, 24-hour clock",
```

In the `es` dictionary, after `navSettings: "Ajustes",`:

```js
    clockLocalTime: "Hora local",
    clockSelectedCities: "Ciudades seleccionadas",
    clockEmptyCities: "Sin ciudades seleccionadas. Añádelas en Ajustes.",
    clockDialAriaLabel: "Hora local {time}, formato de 24 horas",
```

- [ ] **Step 5: Verify manually**

Run `npm run dev` (if port 4173 is already in use, reuse that running server or run `PORT=5000 npm run dev`). Open `http://127.0.0.1:4173/_dev`, select Pixel 7, click the 時鐘 tab.

Expected: circular card bezel, the "本地時間" caption, and the "已選取的城市" heading. No console errors. The hands are still static pointing up because JS is not wired yet.

- [ ] **Step 6: Commit**

```bash
git add src/app/index.html src/app/clock.css src/shared/i18n.js
git commit -m "feat(clock): scaffold the clock view shell"
```

---

### Task 2: Build and drive the 24-hour dial

**Files:**
- Create: `src/app/clock.js`
- Modify: `src/app/app.js:6` (import), `src/app/app.js:49-53` (`showView`), `src/app/app.js:67-68` (init), `src/app/app.js:100-105` (`pageshow`), `src/app/app.js:117-120` (minute ticker)

**Interfaces:**
- Consumes: DOM ids and classes from Task 1; `I18nUtils.getTranslation`.
- Produces: `ClockView.init()` and `ClockView.render()`; `ClockView.render()` is safe to call repeatedly and before/after init (no-ops without refs).

- [ ] **Step 1: Create `src/app/clock.js` with dial rendering**

```js
/**
 * TimeMapper - 24-hour clock view
 */

import { I18nUtils } from "../shared/utils.js";

const DIAL_CENTER = 100;
const HOUR_STEP_DEG = 15;

function polarPoint(radius, angle) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: DIAL_CENTER + radius * Math.sin(rad),
    y: DIAL_CENTER - radius * Math.cos(rad)
  };
}

export const ClockView = {
  _refs: null,

  init() {
    const dial = document.getElementById("clockDial");
    if (!dial) return;
    this._refs = {
      dial,
      ticks: document.getElementById("clockTicks"),
      numerals: document.getElementById("clockNumerals"),
      hourHand: document.getElementById("clockHourHand"),
      minuteHand: document.getElementById("clockMinuteHand"),
      cityList: document.getElementById("clockCityList")
    };
    this._buildDial();
    this.render();
  },

  _buildDial() {
    const { ticks, numerals } = this._refs;
    const tickParts = [];
    const numeralParts = [];

    for (let hour = 0; hour < 24; hour += 1) {
      const angle = hour * HOUR_STEP_DEG;
      const major = hour % 6 === 0;
      const outer = polarPoint(88, angle);
      const inner = polarPoint(major ? 76 : 82, angle);
      tickParts.push(
        `<line class="clock-tick${major ? " clock-tick--major" : ""}" x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}"></line>`
      );

      const label = polarPoint(68, angle);
      numeralParts.push(
        `<text class="clock-numeral${major ? " clock-numeral--major" : ""}" x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central">${hour}</text>`
      );
    }

    ticks.innerHTML = tickParts.join("");
    numerals.innerHTML = numeralParts.join("");
  },

  render() {
    if (!this._refs) return;
    this._renderHands(new Date());
  },

  _renderHands(now) {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const hourAngle = ((hours % 24) + minutes / 60) * HOUR_STEP_DEG;
    const minuteAngle = minutes * 6;

    this._refs.hourHand.setAttribute("transform", `rotate(${hourAngle} 100 100)`);
    this._refs.minuteHand.setAttribute("transform", `rotate(${minuteAngle} 100 100)`);

    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    this._refs.dial.setAttribute(
      "aria-label",
      I18nUtils.getTranslation("clockDialAriaLabel", { time })
    );
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.ClockView = ClockView;
}
```

- [ ] **Step 2: Import `ClockView` in `src/app/app.js`**

After the `SettingsController` import:

```js
import { SettingsController } from "./settings-controller.js";
import { ClockView } from "./clock.js";
```

- [ ] **Step 3: Render the clock when its tab becomes active**

In `showView`, extend the branch:

```js
  if (currentView === "settings") {
    SettingsController.refresh();
  } else if (currentView === "timeline") {
    Renderer.render();
  } else if (currentView === "clock") {
    ClockView.render();
  }
```

- [ ] **Step 4: Initialize the clock during app startup**

In `init()`, immediately after `Renderer.render();`:

```js
  Renderer.render();
  ClockView.init();
  SettingsController.init();
```

- [ ] **Step 5: Refresh after the app resumes from the background**

Replace the `pageshow` handler body:

```js
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      applyTheme();
      Renderer.render();
      if (currentView === "clock") ClockView.render();
    }
  });
```

- [ ] **Step 6: Tick the clock on the minute boundary while visible**

Replace the minute interval with a self-rescheduling timeout that fires exactly at `:00`:

```js
  function tickMinute() {
    if (currentView === "timeline") Renderer.render();
    else if (currentView === "clock") ClockView.render();
  }

  function scheduleMinuteTick() {
    const delay = 60 * 1000 - (Date.now() % (60 * 1000));
    setTimeout(() => {
      tickMinute();
      scheduleMinuteTick();
    }, delay);
  }
  scheduleMinuteTick();
```

- [ ] **Step 7: Verify manually**

Refresh `http://127.0.0.1:4173/_dev`. Expected: 24 hour ticks and numerals 0–23, 0 at the top; the minute hand matches the system minute; the hour hand sits between two numerals at the correct fraction (for 09:30 it is about halfway between 9 and 10). Inspect the SVG in DevTools and confirm `transform="rotate(...)"` is set. Wait for a minute rollover and confirm both hands advance.

- [ ] **Step 8: Commit**

```bash
git add src/app/clock.js src/app/app.js
git commit -m "feat(clock): render the 24-hour dial and hands"
```

---

### Task 3: Render the selected-city time wall

**Files:**
- Modify: `src/app/clock.js` (imports, `dayOrdinal`, `_localZone`, `render`, `_renderCityList`)

**Interfaces:**
- Consumes: `ClockView` from Task 2; `State.selectedIds`, `State.findCity()`, `TimeUtils.getFormatter()`, `TimeUtils.resolveZone()`, `I18nUtils.getCityName()`, `I18nUtils.getTranslation()`, `EscapeUtils.html()`.
- Produces: the final city rows and empty state inside `#clockCityList`.

- [ ] **Step 1: Expand the imports**

Replace the import line in `src/app/clock.js` with both imports:

```js
import { State } from "../shared/state.js";
import { TimeUtils, I18nUtils, EscapeUtils } from "../shared/utils.js";
```

- [ ] **Step 2: Add the day-ordinal helper**

After `polarPoint`:

```js
function dayOrdinal(date, zone) {
  const text = TimeUtils.getFormatter("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const [year, month, day] = text.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}
```

- [ ] **Step 3: Resolve and cache the device zone**

Add `_localZone: null,` after `_refs: null,`:

```js
export const ClockView = {
  _refs: null,
  _localZone: null,
```

In `init()`, after the refs object is assigned:

```js
    this._localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
```

- [ ] **Step 4: Extend `render()` to rebuild the city list**

Replace `render()`:

```js
  render() {
    if (!this._refs) return;
    const now = new Date();
    this._renderHands(now);
    this._renderCityList(now);
  },
```

- [ ] **Step 5: Add `_renderCityList`**

After `_renderHands`, add:

```js
  _renderCityList(now) {
    const list = this._refs.cityList;
    const cities = State.selectedIds
      .map((id) => State.findCity(id))
      .filter(Boolean);

    if (cities.length === 0) {
      list.innerHTML = `<li class="clock-empty">${EscapeUtils.html(
        I18nUtils.getTranslation("clockEmptyCities")
      )}</li>`;
      return;
    }

    const locale = I18nUtils.getLocale() || "en-US";
    const localDay = dayOrdinal(now, this._localZone);

    const rows = cities.map((city) => {
      const zone = TimeUtils.resolveZone(city.zone);
      const timeText = TimeUtils.getFormatter(locale, {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).format(now);
      const dateText = TimeUtils.getFormatter(locale, {
        timeZone: zone,
        month: "numeric",
        day: "numeric"
      }).format(now);
      const shift = dayOrdinal(now, zone) - localDay;
      const shiftText = shift > 0 ? `+${shift}` : shift < 0 ? `\u2212${Math.abs(shift)}` : "";
      const shiftMarkup = shiftText
        ? `<span class="clock-day-shift">${shiftText}</span>`
        : "";
      const name = I18nUtils.getCityName(city);
      const ariaLabel = [name, dateText, shiftText, timeText].filter(Boolean).join(" ");

      return `<li class="clock-city-row" aria-label="${EscapeUtils.html(ariaLabel)}">
        <div class="clock-city-meta">
          <span class="clock-city-name">${EscapeUtils.html(name)}</span>
          <span class="clock-city-date">${EscapeUtils.html(dateText)}</span>
          ${shiftMarkup}
        </div>
        <span class="clock-city-time">${EscapeUtils.html(timeText)}</span>
      </li>`;
    });

    list.innerHTML = rows.join("");
  },
```

- [ ] **Step 6: Verify manually against the spec**

Refresh `http://127.0.0.1:4173/_dev` and confirm:

1. City rows follow `State.selectedIds` order and match the timeline order.
2. Every time is `HH:MM` 24-hour format; no `24:00` at midnight.
3. Cities on another calendar day show `+1` or `−1` next to the date.
4. A DST city (New York or Sydney) shows the correct current time.
5. Removing all cities in 設定 shows the empty-state sentence.
6. Switching 語言 to English and Spanish updates the heading, caption, city names, and empty state.
7. Light and dark themes keep readable contrast.
8. Switching to 時間軸 and back refreshes the clock immediately.
9. With 10 cities the list scrolls and clears the bottom bar.
10. Background the app for a minute, return, and confirm the minute hand is current.

- [ ] **Step 7: Commit**

```bash
git add src/app/clock.js
git commit -m "feat(clock): list selected cities with local times"
```

---

## Self-Review

- **Spec coverage:** Task 1 covers markup, styles, i18n, empty-state styling (§2, §4, §8, §9). Task 2 covers the dial geometry, angles, and lifecycle (§5, §7). Task 3 covers city rows, h23 formatting, date shifts, empty state, escaping, and manual acceptance (§6, §10, §11).
- **Placeholder scan:** No TBD/TODO steps; every code step contains the exact code.
- **Type consistency:** `ClockView.init()`/`render()` are the only public methods; `_refs` and `_localZone` names are consistent across Tasks 2 and 3. `dayOrdinal(date, zone)` is defined before use.
