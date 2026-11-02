/**
 * TimeMapper - 24-hour clock view
 */

import { State } from "../shared/state.js";
import { TimeUtils, I18nUtils, EscapeUtils } from "../shared/utils.js";
import { DragReorderController } from "../shared/drag-reorder.js";

const DIAL_CENTER = 100;
const HOUR_STEP_DEG = 15;
const INNER_RADIUS = 88;
const INNER_WIDTH = 20;
const OUTER_RADIUS = 112;
const OUTER_WIDTH = 20;
const RING_GRADIENT_STEPS = 16;
const MINUTE_TICK_OUTER_RADIUS = 74;
const MINUTE_TICK_INNER_RADIUS = 71;
const MINUTE_NUMERAL_RADIUS = 67;
const MINUTE_STEP_DEG = 6;

/** Segments walk clockwise; half-hour seams land between numeral badges, whole-hour seams cut through them. */
const RING_LAYOUTS = {
  twoTone: {
    solids: [
      { start: 6, end: 18, tone: "day" },
      { start: 18, end: 6, tone: "evening" }
    ],
    transitions: []
  },
  gradient: {
    solids: [
      { start: 6.5, end: 17.5, tone: "day" },
      { start: 18.5, end: 5.5, tone: "evening" }
    ],
    transitions: [
      { start: 17.5, end: 18.5, from: "day", to: "evening" },
      { start: 5.5, end: 6.5, from: "evening", to: "day" }
    ]
  },
  timeline: {
    solids: [
      { start: 8, end: 18, tone: "day" },
      { start: 18, end: 0, tone: "mid" },
      { start: 0, end: 8, tone: "evening" }
    ],
    transitions: []
  }
};

const zoneFormatters = new Map();

function polarPoint(radius, angle) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: DIAL_CENTER + radius * Math.sin(rad),
    y: DIAL_CENTER - radius * Math.cos(rad)
  };
}

function ringArc(startHour, endHour, radius, offsetHours) {
  const start = polarPoint(radius, (startHour + offsetHours) * HOUR_STEP_DEG);
  const end = polarPoint(radius, (endHour + offsetHours) * HOUR_STEP_DEG);
  const hours = (endHour - startHour + 24) % 24;
  const largeArc = hours > 12 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function timePartsInZone(date, zone) {
  const resolved = TimeUtils.resolveZone(zone);
  let formatter = zoneFormatters.get(resolved);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    zoneFormatters.set(resolved, formatter);
  }
  const parts = formatter.formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    hours: value("hour") % 24,
    minutes: value("minute"),
    seconds: value("second")
  };
}

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

function buildRingPaths(radius, width, offsetHours, theme) {
  const { solids, transitions } = RING_LAYOUTS[theme];
  const paths = solids.map(
    ({ start, end, tone }) =>
      `<path class="clock-ring--${tone}" d="${ringArc(start, end, radius, offsetHours)}" style="stroke-width: ${width}"></path>`
  );

  transitions.forEach(({ start, end, from, to }) => {
    const step = (end - start) / RING_GRADIENT_STEPS;
    for (let i = 0; i < RING_GRADIENT_STEPS; i += 1) {
      const mix = Math.round(((i + 0.5) / RING_GRADIENT_STEPS) * 100);
      const stroke = `color-mix(in srgb, var(--clock-ring-${to}) ${mix}%, var(--clock-ring-${from}))`;
      paths.push(
        `<path d="${ringArc(start + step * i, start + step * (i + 1), radius, offsetHours)}" style="stroke-width: ${width}; stroke: var(--clock-ring-${from}); stroke: ${stroke}"></path>`
      );
    }
  });

  return paths;
}

function buildRingScale(radius, width, offsetHours) {
  const ticks = [];
  const badges = [];
  const numerals = [];
  const outerRadius = radius + width / 2;
  const innerRadius = radius - width / 2;

  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour + offsetHours) * HOUR_STEP_DEG;
    const outer = polarPoint(outerRadius, angle);
    const inner = polarPoint(innerRadius, angle);
    ticks.push(
      `<line class="clock-tick" x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}"></line>`
    );

    const label = polarPoint(radius, angle);
    const labelText = hour === 0 ? 24 : hour;
    badges.push(
      `<circle class="clock-numeral-badge" cx="${label.x}" cy="${label.y}" r="6.5"></circle>`
    );
    numerals.push(
      `<text class="clock-numeral" x="${label.x}" y="${label.y}" dy="0.35em" text-anchor="middle">${labelText}</text>`
    );
  }

  return { ticks, badges, numerals };
}

/** Inner-ring minute scale: fixed geometry, so it is painted once instead of per rebuild. */
function buildMinuteTrack() {
  const ticks = [];
  const numerals = [];

  for (let minute = 0; minute < 60; minute += 5) {
    const angle = minute * MINUTE_STEP_DEG;
    const tickOuter = polarPoint(MINUTE_TICK_OUTER_RADIUS, angle);
    const tickInner = polarPoint(MINUTE_TICK_INNER_RADIUS, angle);
    ticks.push(
      `<line class="clock-minute-tick" x1="${tickOuter.x}" y1="${tickOuter.y}" x2="${tickInner.x}" y2="${tickInner.y}"></line>`
    );

    const label = polarPoint(MINUTE_NUMERAL_RADIUS, angle);
    const labelText = String(minute === 0 ? 60 : minute).padStart(2, "0");
    numerals.push(
      `<text class="clock-minute-numeral" x="${label.x}" y="${label.y}" dy="0.35em" text-anchor="middle">${labelText}</text>`
    );
  }

  return { ticks, numerals };
}

export const ClockView = {
  _refs: null,
  _localZone: null,
  _ringSignature: "",
  _current: null,

  init() {
    const dial = document.getElementById("clockDial");
    if (!dial) return;
    this._refs = {
      dial,
      ring: document.getElementById("clockRing"),
      badges: document.getElementById("clockBadges"),
      ticks: document.getElementById("clockTicks"),
      numerals: document.getElementById("clockNumerals"),
      minuteTrack: document.getElementById("clockMinuteTrack"),
      minuteTrackNumerals: document.getElementById("clockMinuteTrackNumerals"),
      hourHand: document.getElementById("clockHourHand"),
      minuteHand: document.getElementById("clockMinuteHand"),
      innerCityLabel: document.getElementById("clockInnerCityLabel"),
      outerCityLabel: document.getElementById("clockOuterCityLabel"),
      cityList: document.getElementById("clockCityList")
    };
    this._localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const minuteTrack = buildMinuteTrack();
    this._refs.minuteTrack.innerHTML = minuteTrack.ticks.join("");
    this._refs.minuteTrackNumerals.innerHTML = minuteTrack.numerals.join("");
    this.render();
  },

  _selectedCities() {
    return State.selectedIds
      .map((id) => State.findCity(id))
      .filter(Boolean);
  },

  _ringConfigs(now) {
    const cities = this._selectedCities();
    const city1 = cities[0] || State.findCity("local") || null;
    const city2 = cities[1] || null;
    const zone1 = city1?.zone || this._localZone;
    const zone2 = city2?.zone || null;
    const offset1 = TimeUtils.getOffsetMinutes(now, zone1);
    const offset2 = zone2 ? TimeUtils.getOffsetMinutes(now, zone2) : null;
    const configs = [{ radius: INNER_RADIUS, width: INNER_WIDTH, offset: 0 }];

    if (city2) {
      const deltaHours = (offset2 - offset1) / 60;
      configs.push({ radius: OUTER_RADIUS, width: OUTER_WIDTH, offset: -deltaHours });
    }

    return { city1, city2, zone1, zone2, offset1, offset2, configs };
  },

  _syncRings(now) {
    const { city1, city2, zone1, zone2, offset1, offset2, configs } = this._ringConfigs(now);
    this._current = { city1, city2 };

    const signature = `${zone1}|${offset1}|${zone2}|${offset2}|${State.clockDialTheme}`;
    if (signature === this._ringSignature) return;
    this._ringSignature = signature;

    const ringParts = [];
    const tickParts = [];
    const badgeParts = [];
    const numeralParts = [];

    configs.forEach(({ radius, width, offset }) => {
      ringParts.push(...buildRingPaths(radius, width, offset, State.clockDialTheme));
      const scale = buildRingScale(radius, width, offset);
      tickParts.push(...scale.ticks);
      badgeParts.push(...scale.badges);
      numeralParts.push(...scale.numerals);
    });

    this._refs.ring.innerHTML = ringParts.join("");
    this._refs.ticks.innerHTML = tickParts.join("");
    this._refs.badges.innerHTML = badgeParts.join("");
    this._refs.numerals.innerHTML = numeralParts.join("");
  },

  render() {
    if (!this._refs) return;
    const now = new Date();
    this._syncRings(now);
    this._renderCityLabels();
    this._renderHands(now);
    if (!DragReorderController.isDragging()) this._renderCityList(now);
  },

  tick() {
    if (!this._refs) return;
    this._renderHands(new Date());
  },

  _renderCityLabels() {
    const { city1, city2 } = this._current || {};
    this._refs.innerCityLabel.textContent = city1 ? I18nUtils.getCityName(city1) : "";
    this._refs.outerCityLabel.textContent = city2 ? I18nUtils.getCityName(city2) : "";
  },

  _renderHands(now) {
    const city1 = this._current?.city1 || State.findCity("local");
    const zone = city1?.zone || this._localZone;
    const { hours, minutes, seconds } = timePartsInZone(now, zone);
    const hourAngle = ((hours % 24) + minutes / 60) * HOUR_STEP_DEG;
    const minuteAngle = (minutes + seconds / 60) * 6;

    this._refs.hourHand.setAttribute("transform", `rotate(${hourAngle} 100 100)`);
    this._refs.minuteHand.setAttribute("transform", `rotate(${minuteAngle} 100 100)`);

    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const cityName = city1 ? I18nUtils.getCityName(city1) : "";
    this._refs.dial.setAttribute(
      "aria-label",
      I18nUtils.getTranslation("clockDialAriaLabel", { city: cityName, time })
    );
  },

  _renderCityList(now) {
    const list = this._refs.cityList;
    const cities = this._selectedCities();

    if (cities.length === 0) {
      list.innerHTML = `<li class="clock-empty">${EscapeUtils.html(
        I18nUtils.getTranslation("clockEmptyCities")
      )}</li>`;
      return;
    }

    const locale = I18nUtils.getLocale() || "en-US";
    const localDay = dayOrdinal(now, this._localZone);

    const rows = cities.map((city, index) => {
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

      return `<li class="clock-city-row${index > 1 ? " is-secondary" : ""}" aria-label="${EscapeUtils.html(ariaLabel)}">
        <div class="clock-city-meta">
          <span class="clock-city-handle" aria-hidden="true">⋮⋮</span>
          <span class="clock-city-name">${EscapeUtils.html(name)}</span>
        </div>
        <div class="clock-city-clock">
          <span class="clock-city-date">${EscapeUtils.html(dateText)}</span>
          ${shiftMarkup}
          <span class="clock-city-time">${EscapeUtils.html(timeText)}</span>
        </div>
      </li>`;
    });

    list.innerHTML = rows.join("");
    this._wireRowDrag();
  },

  _wireRowDrag() {
    const rows = this._rowElements();
    if (rows.length < 2) return;
    rows.forEach((row, index) => {
      row.querySelector(".clock-city-handle")?.addEventListener("pointerdown", (e) => {
        DragReorderController.begin({
          event: e,
          container: this._refs.cityList,
          item: row,
          items: this._rowElements(),
          handle: e.currentTarget,
          startIndex: index,
          onReorder: (fromIndex, toIndex) => {
            const next = [...State.selectedIds];
            const [removed] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, removed);
            State.selectedIds = next;
            State.saveSelection();
            this.render();
          }
        });
      });
    });
  },

  _rowElements() {
    return Array.from(this._refs.cityList.children).filter((el) => el.classList.contains("clock-city-row"));
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.ClockView = ClockView;
}
