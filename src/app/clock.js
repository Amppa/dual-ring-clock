/**
 * TimeMapper - 24-hour clock view
 */

import { State } from "../shared/state.js";
import { TimeUtils, I18nUtils, EscapeUtils } from "../shared/utils.js";

const DIAL_CENTER = 100;
const HOUR_STEP_DEG = 15;

function polarPoint(radius, angle) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: DIAL_CENTER + radius * Math.sin(rad),
    y: DIAL_CENTER - radius * Math.cos(rad)
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

export const ClockView = {
  _refs: null,
  _localZone: null,

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
    this._localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
    const now = new Date();
    this._renderHands(now);
    this._renderCityList(now);
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
  },

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
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.ClockView = ClockView;
}
