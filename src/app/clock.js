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
