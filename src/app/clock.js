/**
 * TimeMapper - 24-hour clock view
 */

import { CONFIG } from "../shared/config.js";
import { State } from "../shared/state.js";
import { TimeUtils, I18nUtils, EscapeUtils } from "../shared/utils.js";
import { DragReorderController } from "../shared/drag-reorder.js";

const DIAL_CENTER = 100;
const HOUR_STEP_DEG = 15;
const INNER_RADIUS = 91;
const INNER_WIDTH = 18;
const OUTER_RADIUS = 117;
const OUTER_WIDTH = 26;
const MINUTE_TICK_OUTER_RADIUS = 74;
const MINUTE_TICK_INNER_RADIUS = 71;
const MINUTE_NUMERAL_RADIUS = 67;
const MINUTE_STEP_DEG = 6;
const SCRUB_STEP_DEG = 1.25; // 15 deg per hour / 12 (5 minutes in a 24h dial)
const SCRUB_LINE_START_RADIUS = 0;
const SCRUB_INNER_BADGE_RADIUS = 100; // Inner ring outer radius (91 + 18/2)
const SCRUB_OUTER_BADGE_RADIUS = 130; // Outer ring outer radius (117 + 26/2)
const SCRUB_INTERVAL_ARC_RADIUS = 145; // Increased by 5px
const SCRUB_LINE_END_RADIUS = 139;

const PERIOD_TONES = ["mid", "day", "mid", "evening"];

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

function buildArcPath(radius, startAngle, endAngle) {
  const p1 = polarPoint(radius, startAngle);
  const p2 = polarPoint(radius, endAngle);
  const span = (endAngle - startAngle + 360) % 360;
  const largeArc = span > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
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

function buildRingPaths(radius, width, offsetHours) {
  const periods = State.timePeriods && (State.timePeriods.length === 2 || State.timePeriods.length === 4)
    ? State.timePeriods
    : CONFIG.defaultDayNightPeriods;

  const tones = periods.length === 2 ? ["day", "evening"] : PERIOD_TONES;

  return periods.map((period, i) => {
    const nextPeriod = periods[(i + 1) % periods.length];
    const start = period.start;
    const end = nextPeriod.start;
    const tone = tones[i] || "day";
    return `<path class="clock-ring--${tone}" d="${ringArc(start, end, radius, offsetHours)}" style="stroke-width: ${width}"></path>`;
  });
}

function buildRingScale(radius, offsetHours, isOuter = false) {
  const numerals = [];
  const numeralClass = isOuter ? "clock-numeral clock-numeral--outer" : "clock-numeral clock-numeral--inner";

  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour + offsetHours) * HOUR_STEP_DEG;
    const label = polarPoint(radius, angle);
    const labelText = hour === 0 ? 24 : hour;
    numerals.push(
      `<text class="${numeralClass}" x="${label.x}" y="${label.y}" dy="0.35em" text-anchor="middle">${labelText}</text>`
    );
  }

  return { numerals };
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
  _scrubs: [],
  _activeDragScrubId: null,

  init() {
    const dial = document.getElementById("clockDial");
    if (!dial) return;
    this._refs = {
      dial,
      ring: document.getElementById("clockRing"),
      numerals: document.getElementById("clockNumerals"),
      minuteTrack: document.getElementById("clockMinuteTrack"),
      minuteTrackNumerals: document.getElementById("clockMinuteTrackNumerals"),
      hourHand: document.getElementById("clockHourHand"),
      minuteHand: document.getElementById("clockMinuteHand"),
      innerCityLabel: document.getElementById("clockInnerCityLabel"),
      outerCityLabel: document.getElementById("clockOuterCityLabel"),
      cityList: document.getElementById("clockCityList"),
      scrubLines: document.getElementById("clockScrubLines"),
      scrubIntervals: document.getElementById("clockScrubIntervals"),
      scrubBadges: document.getElementById("clockScrubBadges")
    };
    this._scrubs = [];
    this._activeDragScrubId = null;
    this._localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const minuteTrack = buildMinuteTrack();
    this._refs.minuteTrack.innerHTML = minuteTrack.ticks.join("");
    this._refs.minuteTrackNumerals.innerHTML = minuteTrack.numerals.join("");
    this._wireScrub();
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
    const configs = [
      {
        radius: OUTER_RADIUS,
        width: OUTER_WIDTH,
        offset: 0,
        isOuter: true
      }
    ];

    if (city2) {
      const deltaHours = (offset2 - offset1) / 60;
      configs.push({
        radius: INNER_RADIUS,
        width: INNER_WIDTH,
        offset: -deltaHours,
        isOuter: false
      });
    }

    return { city1, city2, zone1, zone2, offset1, offset2, configs };
  },

  _syncRings(now) {
    const { city1, city2, zone1, zone2, offset1, offset2, configs } = this._ringConfigs(now);
    this._current = { city1, city2 };

    const periodSig = `${State.periodMode || ""}|${(State.timePeriods || []).map((p) => p.start).join(",")}`;
    const signature = `${zone1}|${offset1}|${zone2}|${offset2}|${periodSig}`;
    if (signature === this._ringSignature) return;
    this._ringSignature = signature;

    const ringParts = [];
    const numeralParts = [];

    configs.forEach(({ radius, width, offset, isOuter }) => {
      ringParts.push(...buildRingPaths(radius, width, offset));
      const scale = buildRingScale(radius, offset, isOuter);
      numeralParts.push(...scale.numerals);
    });

    this._refs.ring.innerHTML = ringParts.join("");
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
    this._refs.outerCityLabel.textContent = city1 ? I18nUtils.getCityName(city1) : "";
    this._refs.innerCityLabel.textContent = city2 ? I18nUtils.getCityName(city2) : "";
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
    this._syncScrub(now);
  },

  _syncScrub(now) {
    if (!this._refs?.scrubLines || !this._refs?.scrubBadges) return;
    if (!this._scrubs || this._scrubs.length === 0) {
      this._refs.scrubLines.innerHTML = "";
      this._refs.scrubBadges.innerHTML = "";
      if (this._refs.scrubIntervals) this._refs.scrubIntervals.innerHTML = "";
      return;
    }

    const city1 = this._current?.city1 || State.findCity("local");
    const city2 = this._current?.city2 || null;
    const zone1 = city1?.zone || this._localZone;
    const zone2 = city2?.zone || null;
    const offset1 = TimeUtils.getOffsetMinutes(now, zone1);
    const offset2 = zone2 ? TimeUtils.getOffsetMinutes(now, zone2) : null;
    const deltaMins = offset2 !== null ? offset2 - offset1 : null;

    const lineParts = [];
    const badgeParts = [];

    this._scrubs.forEach((scrub) => {
      const angle = scrub.angle;
      const outerMinutes = Math.round((angle / 360) * 1440) % 1440;
      const h1 = Math.floor(outerMinutes / 60);
      const m1 = outerMinutes % 60;
      const outerTimeStr = `${String(h1).padStart(2, "0")}:${String(m1).padStart(2, "0")}`;

      const start = polarPoint(SCRUB_LINE_START_RADIUS, angle);
      const end = polarPoint(SCRUB_LINE_END_RADIUS, angle);
      const hitStart = polarPoint(10, angle);
      const outerPt = polarPoint(SCRUB_OUTER_BADGE_RADIUS, angle);

      const isDragging = this._activeDragScrubId === scrub.id;
      const dragClass = isDragging ? " is-dragging" : "";

      lineParts.push(
        `<line class="clock-scrub-line-hitbox" data-id="${scrub.id}" x1="${hitStart.x.toFixed(2)}" y1="${hitStart.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}"></line>` +
        `<line class="clock-scrub-line${dragClass}" data-id="${scrub.id}" x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}"></line>`
      );

      let innerBadgeHtml = "";
      if (city2 && deltaMins !== null) {
        const innerMinutes = ((outerMinutes + deltaMins) % 1440 + 1440) % 1440;
        const h2 = Math.floor(innerMinutes / 60);
        const m2 = innerMinutes % 60;
        const innerTimeStr = `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
        const innerPt = polarPoint(SCRUB_INNER_BADGE_RADIUS, angle);

        innerBadgeHtml = `
          <g class="clock-scrub-badge clock-scrub-badge--inner${dragClass}" data-id="${scrub.id}" role="slider" tabindex="0" aria-label="Inner ring time scrubber" transform="translate(${innerPt.x.toFixed(2)}, ${innerPt.y.toFixed(2)})">
            <rect class="clock-scrub-badge-bg clock-scrub-badge-bg--inner" x="-12.5" y="-7.5" width="25" height="15" rx="7.5"></rect>
            <text class="clock-scrub-badge-time clock-scrub-badge-time--inner" x="0" y="0" dy="0.35em" text-anchor="middle">${innerTimeStr}</text>
          </g>
        `;
      }

      const outerBadgeHtml = `
        <g class="clock-scrub-badge clock-scrub-badge--outer${dragClass}" data-id="${scrub.id}" role="slider" tabindex="0" aria-label="Outer ring time scrubber" transform="translate(${outerPt.x.toFixed(2)}, ${outerPt.y.toFixed(2)})">
          <rect class="clock-scrub-badge-bg clock-scrub-badge-bg--outer" x="-13" y="-8" width="26" height="16" rx="8"></rect>
          <text class="clock-scrub-badge-time clock-scrub-badge-time--outer" x="0" y="0" dy="0.35em" text-anchor="middle">${outerTimeStr}</text>
        </g>
      `;

      const closePt = polarPoint(SCRUB_INTERVAL_ARC_RADIUS, angle);
      const closeBtnHtml = `
        <g class="clock-scrub-close-btn" data-id="${scrub.id}" role="button" aria-label="Close time scrubber" transform="translate(${closePt.x.toFixed(2)}, ${closePt.y.toFixed(2)})">
          <circle r="5.5" class="clock-scrub-close-bg"></circle>
          <circle r="10" class="clock-scrub-close-hitbox"></circle>
          <text dy="0.32em" text-anchor="middle">×</text>
        </g>
      `;

      badgeParts.push(
        `<g class="clock-scrub-group" data-id="${scrub.id}">${innerBadgeHtml}${outerBadgeHtml}${closeBtnHtml}</g>`
      );
    });

    this._refs.scrubLines.innerHTML = lineParts.join("");
    this._refs.scrubBadges.innerHTML = badgeParts.join("");

    // Interval indicators between scrub lines on outer ring (when scrubs > 1)
    const intervalParts = [];
    if (this._refs.scrubIntervals) {
      if (this._scrubs.length > 1) {
        const sorted = [...this._scrubs].sort((a, b) => a.angle - b.angle);
        const count = sorted.length;

        const arcRadius = SCRUB_INTERVAL_ARC_RADIUS;
        const degPerPx = 180 / (Math.PI * arcRadius);
        const lineGapDeg = 10 * degPerPx; // 10px gap from scrub lines

        for (let i = 0; i < count; i++) {
          const s1 = sorted[i];
          const s2 = sorted[(i + 1) % count];

          let diffDeg = (s2.angle - s1.angle + 360) % 360;
          if (diffDeg === 0) diffDeg = 360;

          // 方案 A: 只顯示短的那一側 (<= 180°, 即 <= 12h)
          if (diffDeg > 180) continue;
          if (count === 2 && i === 1 && diffDeg === 180) continue;

          const diffHours = (diffDeg / 360) * 24;
          // Avoid collision if adjacent lines are closer than 1 hour (15 deg)
          if (diffHours < 1.0) continue;

          const roundedHours = Math.round(diffHours * 2) / 2;
          let text;
          if (diffHours === 0) {
            text = "0h";
          } else if (diffHours < 0.25) {
            text = "<0.5h";
          } else {
            text = `${roundedHours}h`;
          }

          const midAngle = (s1.angle + diffDeg / 2) % 360;
          const pt = polarPoint(arcRadius, midAngle);

          // Single continuous arc from s1 to s2 with 10px margins; pill is placed on top covering it
          let arcHtml = "";
          const arcSpan = diffDeg - 2 * lineGapDeg;
          if (arcSpan > 0.5) {
            const arcStart = (s1.angle + lineGapDeg) % 360;
            const arcEnd = (s1.angle + diffDeg - lineGapDeg + 360) % 360;
            const path = buildArcPath(arcRadius, arcStart, arcEnd);
            arcHtml = `<path class="clock-scrub-interval-arc" d="${path}"></path>`;
          }

          intervalParts.push(
            `<g class="clock-scrub-interval-group">` +
              arcHtml +
              `<g class="clock-scrub-interval-pill" transform="translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})">` +
                `<rect class="clock-scrub-interval-bg" x="-12" y="-6.5" width="24" height="13" rx="6.5"></rect>` +
                `<text class="clock-scrub-interval-text" x="0" y="0" dy="0.35em" text-anchor="middle">${text}</text>` +
              `</g>` +
            `</g>`
          );
        }
      }
      this._refs.scrubIntervals.innerHTML = intervalParts.join("");
    }
  },

  _wireScrub() {
    const dial = this._refs?.dial;
    if (!dial) return;

    let cachedCenter = null;
    const updateCachedCenter = () => {
      const pt = dial.createSVGPoint();
      pt.x = DIAL_CENTER;
      pt.y = DIAL_CENTER;
      const screenCenter = pt.matrixTransform(dial.getScreenCTM());
      cachedCenter = { x: screenCenter.x, y: screenCenter.y };
    };

    const calcAngleFromPointer = (e) => {
      if (cachedCenter) {
        const dx = e.clientX - cachedCenter.x;
        const dy = e.clientY - cachedCenter.y;
        const rad = Math.atan2(dx, -dy);
        const deg = (rad * 180 / Math.PI + 360) % 360;
        return (Math.round(deg / SCRUB_STEP_DEG) * SCRUB_STEP_DEG) % 360;
      }
      const pt = dial.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(dial.getScreenCTM().inverse());
      const dx = svgPt.x - DIAL_CENTER;
      const dy = svgPt.y - DIAL_CENTER;
      const rad = Math.atan2(dx, -dy);
      const deg = (rad * 180 / Math.PI + 360) % 360;
      return (Math.round(deg / SCRUB_STEP_DEG) * SCRUB_STEP_DEG) % 360;
    };

    let activePointerId = null;
    let pendingPointerPos = null;
    let dragRafId = null;

    const updateDrag = () => {
      dragRafId = null;
      if (!this._activeDragScrubId || !pendingPointerPos) return;

      const scrub = this._scrubs.find((s) => s.id === this._activeDragScrubId);
      if (!scrub) return;

      const newAngle = calcAngleFromPointer(pendingPointerPos);
      if (scrub.angle === newAngle) return;

      scrub.angle = newAngle;
      this._syncScrub(new Date());
    };

    const onPointerMove = (e) => {
      if (!this._activeDragScrubId || e.pointerId !== activePointerId) return;
      if (e.cancelable) e.preventDefault();

      pendingPointerPos = { clientX: e.clientX, clientY: e.clientY };
      if (dragRafId !== null) return;
      dragRafId = requestAnimationFrame(updateDrag);
    };

    const onPointerEnd = (e) => {
      if (e.pointerId !== activePointerId) return;

      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      pendingPointerPos = null;
      cachedCenter = null;

      try {
        dial.releasePointerCapture?.(e.pointerId);
      } catch (_) { }

      this._activeDragScrubId = null;
      activePointerId = null;
      this._syncScrub(new Date());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };

    const startDrag = (e, scrubId) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      updateCachedCenter();
      this._activeDragScrubId = scrubId;
      activePointerId = e.pointerId;
      try {
        dial.setPointerCapture?.(e.pointerId);
      } catch (_) { }

      const scrub = this._scrubs.find((s) => s.id === scrubId);
      if (scrub) {
        scrub.angle = calcAngleFromPointer(e);
      }
      this._syncScrub(new Date());

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
    };

    dial.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;

      // 1. Close button click
      const closeBtn = e.target.closest(".clock-scrub-close-btn");
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = closeBtn.dataset.id;
        this._scrubs = this._scrubs.filter((s) => s.id !== id);
        this._syncScrub(new Date());
        return;
      }

      // 2. Existing badge or line clicked
      const badge = e.target.closest(".clock-scrub-badge");
      if (badge) {
        startDrag(e, badge.dataset.id);
        return;
      }

      const line = e.target.closest(".clock-scrub-line, .clock-scrub-line-hitbox");
      if (line) {
        startDrag(e, line.dataset.id);
        return;
      }

      if (e.target.closest(".clock-city-handle")) return;

      // 3. Dial clicked -> create new scrub if < CONFIG.maxScrubs
      const pt = dial.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(dial.getScreenCTM().inverse());
      const dist = Math.hypot(svgPt.x - DIAL_CENTER, svgPt.y - DIAL_CENTER);

      if (dist <= 152) {
        const max = CONFIG.maxScrubs || 4;
        if (this._scrubs.length >= max) {
          return;
        }

        const angle = calcAngleFromPointer(e);
        const newScrub = {
          id: `scrub_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          angle
        };
        this._scrubs.push(newScrub);
        startDrag(e, newScrub.id);
      }
    });

    dial.addEventListener("click", (e) => {
      const closeBtn = e.target.closest(".clock-scrub-close-btn");
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = closeBtn.dataset.id;
        this._scrubs = this._scrubs.filter((s) => s.id !== id);
        this._syncScrub(new Date());
      }
    });
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
      const name = I18nUtils.getCityName(city);
      const ariaLabel = [name, dateText, timeText].filter(Boolean).join(" ");

      return `<li class="clock-city-row${index > 1 ? " is-secondary" : ""}" aria-label="${EscapeUtils.html(ariaLabel)}">
        <div class="clock-city-meta">
          <span class="clock-city-handle" aria-hidden="true">⋮⋮</span>
          <span class="clock-city-name">${EscapeUtils.html(name)}</span>
        </div>
        <div class="clock-city-clock">
          <span class="clock-city-date">${EscapeUtils.html(dateText)}</span>
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
