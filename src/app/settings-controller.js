/**
 * TimeMapper - Mobile App Settings Controller
 */

import { CONFIG } from "../shared/config.js";
import { State } from "../shared/state.js";
import {
  MathUtils,
  I18nUtils,
  PeriodUtils,
  TimeUtils
} from "../shared/utils.js";
import { TimeMapperVersion } from "../shared/version.js";
import { CityPreview } from "../shared/city-preview.js";
import { Renderer } from "./renderer.js";

const PERIOD_META = {
  2: [
    { key: "day", labelKey: "periodDay", icon: "☀️" },
    { key: "night", labelKey: "periodNight", icon: "🛌" }
  ],
  3: [
    { key: "day", labelKey: "periodDay", icon: "☀️" },
    { key: "evening", labelKey: "periodEvening", icon: "🌙" },
    { key: "night", labelKey: "periodLateNight", icon: "🛌" }
  ],
  4: [
    { key: "morning", labelKey: "periodMorning", icon: "🌅" },
    { key: "day", labelKey: "periodDay", icon: "☀️" },
    { key: "evening", labelKey: "periodEvening", icon: "🌙" },
    { key: "night", labelKey: "periodNight", icon: "🛌" }
  ]
};

export const SettingsController = {
  cityRefs: null,

  init() {
    const versionLabel = document.getElementById("versionLabel");
    TimeMapperVersion.render(versionLabel);

    const citiesMount = document.getElementById("cardCities");
    this.cityRefs = citiesMount ? CityPreview.collectRefs(citiesMount) : null;

    this.initMobileAddCity();
    this.wireCities();
    this.wireAppearance();
    this.wirePeriods();
    this.refresh();
  },

  refresh() {
    this.renderCities();
    this.renderAppearance();
    this.renderPeriodControls();
  },

  renderCities() {
    if (!this.cityRefs) return;
    CityPreview.renderCurrentCitiesList(this.cityRefs, () => {
      Renderer.render();
    });

    const mobileAddCityZone = document.getElementById("mobileAddCityZone");
    const mobileAddCityName = document.getElementById("mobileAddCityName");
    if (mobileAddCityZone) {
      const isFull = State.selectedIds.length >= State.cityLimit;
      mobileAddCityZone.disabled = isFull;
      if (mobileAddCityName) mobileAddCityName.disabled = isFull;
    }
  },

  initMobileAddCity() {
    const mobileAddCityName = document.getElementById("mobileAddCityName");
    const mobileAddCityZone = document.getElementById("mobileAddCityZone");
    if (!mobileAddCityZone) return;

    mobileAddCityZone.innerHTML = "";
    const zoneToCity = new Map();
    State.allCities().forEach((city) => {
      if (city.id === "local" || city.id.startsWith("custom-")) return;
      if (!zoneToCity.has(city.zone)) zoneToCity.set(city.zone, city);
    });

    const supportedZones = (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function")
      ? Intl.supportedValuesOf("timeZone")
      : Array.from(zoneToCity.keys());

    const allZones = Array.from(new Set([...zoneToCity.keys(), ...supportedZones]));
    const now = new Date();
    const zoneDetails = allZones.map((zone) => {
      const offsetMins = TimeUtils.getOffsetMinutes(now, zone);
      const sign = offsetMins >= 0 ? "+" : "-";
      const absMins = Math.abs(offsetMins);
      const hours = Math.floor(absMins / 60);
      const mins = absMins % 60;
      const offsetStr = `UTC${sign}${hours}${mins > 0 ? ":" + String(mins).padStart(2, "0") : ""}`;
      const cityName = zoneToCity.has(zone)
        ? I18nUtils.getCityName(zoneToCity.get(zone))
        : zone.split("/").pop().replace(/_/g, " ");
      return { zone, offsetMins, label: `${zone} (${offsetStr})`, cityName };
    });

    zoneDetails.sort((a, b) => {
      if (a.offsetMins !== b.offsetMins) return a.offsetMins - b.offsetMins;
      return a.zone.localeCompare(b.zone);
    });

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = I18nUtils.getTranslation("cityZonePlaceholder") || "選擇城市時區";
    mobileAddCityZone.appendChild(placeholder);

    zoneDetails.forEach((detail) => {
      const option = document.createElement("option");
      option.value = detail.zone;
      option.textContent = detail.label;
      option.dataset.cityName = detail.cityName;
      mobileAddCityZone.appendChild(option);
    });

    mobileAddCityZone.addEventListener("change", () => {
      const zone = mobileAddCityZone.value;
      if (!zone) return;
      if (State.selectedIds.length >= State.cityLimit) {
        mobileAddCityZone.value = "";
        return;
      }

      const selectedOpt = mobileAddCityZone.selectedOptions[0];
      const cityName = selectedOpt?.dataset?.cityName || (zoneToCity.get(zone) ? I18nUtils.getCityName(zoneToCity.get(zone)) : zone.split("/").pop().replace(/_/g, " "));

      if (mobileAddCityName) {
        mobileAddCityName.value = cityName;
      }

      const source = zoneToCity.get(zone);
      const newCity = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cityName,
        zone,
        x: MathUtils.clamp(source?.x || 50, 0, 100),
        y: MathUtils.clamp(source?.y || 50, 0, 100),
        lng: source?.lng,
        lat: source?.lat
      };

      State.customCities = [...State.customCities, newCity];
      State.saveCustomCities();
      State.toggleCity(newCity.id);

      setTimeout(() => {
        if (mobileAddCityName) mobileAddCityName.value = "";
        mobileAddCityZone.value = "";
        mobileAddCityZone.blur();
      }, 300);

      this.renderCities();
      Renderer.render();
    });
  },

  wireCities() {
    if (!this.cityRefs) return;
    CityPreview.wireResetButtons(this.cityRefs, () => {
      this.renderCities();
      Renderer.render();
    });
  },

  renderAppearance() {
    const langSelect = document.getElementById("mobileLangSelect");
    if (langSelect) {
      langSelect.value = State.getLanguagePreference();
    }

    const themeSelect = document.getElementById("mobileThemeSelect");
    if (themeSelect) {
      themeSelect.value = localStorage.getItem("theme") || "auto";
    }
  },

  wireAppearance() {
    const langSelect = document.getElementById("mobileLangSelect");
    if (langSelect) {
      langSelect.addEventListener("change", () => {
        State.saveLanguage(langSelect.value);
        I18nUtils.applyAttributes();
        this.refresh();
        Renderer.render();
      });
    }

    const themeSelect = document.getElementById("mobileThemeSelect");
    if (themeSelect) {
      themeSelect.addEventListener("change", () => {
        if (globalThis.TimeMapperTheme) {
          globalThis.TimeMapperTheme.apply(themeSelect.value);
        }
      });
    }
  },

  renderInteractiveHours() {
    const interactiveHours = document.getElementById("interactiveHours");
    if (!interactiveHours) return;
    interactiveHours.innerHTML = "";

    for (let h = 0; h < 24; h++) {
      const cell = document.createElement("div");
      cell.className = "hour-cell interactive-hour-cell";
      cell.textContent = String(h).padStart(2, "0");
      cell.dataset.hour = String(h);
      cell.title = I18nUtils.getTranslation("hourCellTitle", { time: `${String(h).padStart(2, "0")}:00` });

      const styleInfo = PeriodUtils.getHourStyle(h);
      cell.style.backgroundColor = styleInfo.color;
      cell.style.color = styleInfo.fontColor;

      cell.addEventListener("click", () => {
        this.handleCellClick(h);
      });

      interactiveHours.appendChild(cell);
    }
  },

  renderTimelineDividers() {
    const timelineDividersLayer = document.getElementById("timelineDividersLayer");
    if (!timelineDividersLayer) return;
    timelineDividersLayer.innerHTML = "";

    const count = State.timePeriods.length;
    const metaList = PERIOD_META[count] || PERIOD_META[3];

    State.timePeriods.forEach((period, idx) => {
      const meta = metaList[idx] || { labelKey: "periodFallback", icon: "⏰" };
      const label = I18nUtils.getTranslation(meta.labelKey, { index: idx + 1 });
      const divider = document.createElement("div");
      divider.className = "timeline-divider";
      divider.dataset.periodIndex = String(idx);
      divider.style.left = `${(period.start / 24) * 100}%`;
      divider.setAttribute("tabindex", "0");
      divider.setAttribute("role", "slider");
      divider.setAttribute("aria-label", I18nUtils.getTranslation("periodStartAria", { label }));
      divider.setAttribute("aria-valuenow", String(period.start));

      const topKnob = document.createElement("div");
      topKnob.className = "timeline-knob divider-knob-top";
      topKnob.textContent = `${meta.icon} ${String(period.start).padStart(2, "0")}:00`;

      const line = document.createElement("div");
      line.className = "timeline-divider-line";

      const bottomKnob = document.createElement("div");
      bottomKnob.className = "timeline-knob-bottom";

      divider.append(topKnob, line, bottomKnob);
      this.wireDividerDrag(divider, idx);
      timelineDividersLayer.appendChild(divider);
    });
  },

  moveDividerToHour(idx, targetHour) {
    const N = State.timePeriods.length;
    const prevIdx = (idx - 1 + N) % N;
    const nextIdx = (idx + 1) % N;

    const prevStart = State.timePeriods[prevIdx].start;
    const nextStart = State.timePeriods[nextIdx].start;

    if (targetHour === prevStart || targetHour === nextStart) return false;

    const isInsidePrev = (prevStart < nextStart)
      ? (targetHour > prevStart && targetHour < nextStart)
      : (targetHour > prevStart || targetHour < nextStart);

    if (!isInsidePrev) return false;

    State.timePeriods[idx].start = targetHour;
    State.timePeriods[prevIdx].end = (targetHour - 1 + 24) % 24;

    State.saveTimePeriods();
    this.renderInteractiveHours();
    this.renderTimelineDividers();
    Renderer.render();
    return true;
  },

  handleCellClick(targetHour) {
    const N = State.timePeriods.length;
    let bestIdx = -1;
    let minDistance = 999;

    for (let i = 0; i < N; i++) {
      const start = State.timePeriods[i].start;
      const dist = Math.min(
        Math.abs(targetHour - start),
        24 - Math.abs(targetHour - start)
      );
      if (dist < minDistance && dist > 0) {
        minDistance = dist;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      this.moveDividerToHour(bestIdx, targetHour);
    }
  },

  wireDividerDrag(dividerEl, idx) {
    const interactiveHours = document.getElementById("interactiveHours");
    let isDragging = false;

    const onPointerMove = (e) => {
      if (!isDragging || !interactiveHours) return;
      const rect = interactiveHours.getBoundingClientRect();
      if (rect.width <= 0) return;

      const px = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const rawHour = Math.round((px / rect.width) * 24) % 24;
      this.moveDividerToHour(idx, rawHour);
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      dividerEl.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    dividerEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dividerEl.classList.add("is-dragging");
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      e.preventDefault();
    });
  },

  renderPeriodControls() {
    this.renderInteractiveHours();
    this.renderTimelineDividers();
  },

  wirePeriods() {
    const resetPeriodsButton = document.getElementById("resetPeriodsButton");
    if (resetPeriodsButton) {
      resetPeriodsButton.addEventListener("click", () => {
        State.timePeriods = JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
        State.saveTimePeriods();
        this.renderPeriodControls();
        Renderer.render();
      });
    }
  }
};

