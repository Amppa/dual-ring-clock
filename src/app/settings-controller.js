/**
 * DualRing Clock - Mobile App Settings Controller
 */

import { CONFIG } from "../shared/config.js";
import { State } from "../shared/state.js";
import {
  MathUtils,
  I18nUtils,
  PeriodUtils,
  RegionUtils,
  TimeUtils
} from "../shared/utils.js";
import { AppVersion } from "../shared/version.js";
import { CityPreview } from "../shared/city-preview.js";
import { Renderer } from "./renderer.js";

const PERIOD_META = [
  { key: "morning", labelKey: "periodMorning" },
  { key: "day", labelKey: "periodDay" },
  { key: "evening", labelKey: "periodEvening" },
  { key: "night", labelKey: "periodNight" }
];

export const SettingsController = {
  cityRefs: null,

  init() {
    const versionLabel = document.getElementById("versionLabel");
    AppVersion.render(versionLabel);

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
    const mobileAddCityContinent = document.getElementById("mobileAddCityContinent");
    if (mobileAddCityZone) {
      const isFull = State.selectedIds.length >= State.cityLimit;
      mobileAddCityZone.disabled = isFull;
      if (mobileAddCityName) mobileAddCityName.disabled = isFull;
      if (mobileAddCityContinent) mobileAddCityContinent.disabled = isFull;
    }
  },

  initMobileAddCity() {
    const mobileAddCityName = document.getElementById("mobileAddCityName");
    const mobileAddCityContinent = document.getElementById("mobileAddCityContinent");
    const mobileAddCityZone = document.getElementById("mobileAddCityZone");
    if (!mobileAddCityContinent || !mobileAddCityZone) return;

    const zoneToCity = new Map();
    State.allCities().forEach((city) => {
      if (city.id === "local" || city.id.startsWith("custom-")) return;
      if (!zoneToCity.has(city.zone)) zoneToCity.set(city.zone, city);
    });

    const makeOption = (value, text) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      return option;
    };

    mobileAddCityContinent.innerHTML = "";
    mobileAddCityContinent.appendChild(makeOption("", I18nUtils.getTranslation("continentPlaceholder")));
    const sortedZones = TimeUtils.getSortedZones();
    const continentsPresent = new Set(sortedZones.map((d) => d.continent));
    RegionUtils.continents.forEach(({ id, labelKey }) => {
      if (continentsPresent.has(id)) {
        mobileAddCityContinent.appendChild(makeOption(id, I18nUtils.getTranslation(labelKey)));
      }
    });

    // Second column: the continent's zones in plain offset order; the
    // whole world stays pickable. cityName feeds the name prefill on add.
    const fillZoneOptions = (continent) => {
      mobileAddCityZone.innerHTML = "";
      mobileAddCityZone.appendChild(makeOption("", I18nUtils.getTranslation("cityZonePlaceholder") || "選擇城市時區"));
      if (!continent) return;
      const cityNameOf = (zone) => {
        const city = zoneToCity.get(zone);
        return city ? I18nUtils.getCityName(city) : zone.split("/").pop().replace(/_/g, " ");
      };
      sortedZones.filter((d) => d.continent === continent).forEach((detail) => {
        const option = makeOption(detail.zone, detail.label);
        option.dataset.cityName = cityNameOf(detail.zone);
        mobileAddCityZone.appendChild(option);
      });
    };
    fillZoneOptions("");

    mobileAddCityContinent.addEventListener("change", () => {
      fillZoneOptions(mobileAddCityContinent.value);
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
        const themeObj = globalThis.AppTheme;
        if (themeObj) {
          themeObj.apply(themeSelect.value);
        }
      });
    }
  },

  renderInteractiveHours(mode) {
    const isDayNight = mode === "dayNight";
    const hoursEl = document.getElementById(isDayNight ? "interactiveHoursDayNight" : "interactiveHoursRoutine");
    if (!hoursEl) return;
    hoursEl.innerHTML = "";

    const periods = isDayNight ? State.dayNightPeriods : State.routinePeriods;

    for (let h = 0; h < 24; h++) {
      const cell = document.createElement("div");
      cell.className = "hour-cell interactive-hour-cell";
      cell.textContent = String(h).padStart(2, "0");
      cell.dataset.hour = String(h);
      cell.title = I18nUtils.getTranslation("hourCellTitle", { time: `${String(h).padStart(2, "0")}:00` });

      const styleInfo = PeriodUtils.getHourStyle(h, periods);
      cell.style.backgroundColor = styleInfo.color;
      cell.style.color = styleInfo.fontColor;

      cell.addEventListener("click", () => {
        this.handleCellClick(mode, h);
      });

      hoursEl.appendChild(cell);
    }
  },

  renderTimelineDividers(mode) {
    const isDayNight = mode === "dayNight";
    const dividersLayer = document.getElementById(isDayNight ? "timelineDividersLayerDayNight" : "timelineDividersLayerRoutine");
    if (!dividersLayer) return;
    dividersLayer.innerHTML = "";

    const periods = isDayNight ? State.dayNightPeriods : State.routinePeriods;
    const metaList = isDayNight
      ? [{ labelKey: "periodDay" }, { labelKey: "periodNight" }]
      : PERIOD_META;

    periods.forEach((period, idx) => {
      const meta = metaList[idx] || { labelKey: `period${idx + 1}` };
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
      topKnob.textContent = `${String(period.start).padStart(2, "0")}:00`;

      const line = document.createElement("div");
      line.className = "timeline-divider-line";

      const bottomKnob = document.createElement("div");
      bottomKnob.className = "timeline-knob-bottom";

      divider.append(topKnob, line, bottomKnob);
      this.wireDividerDrag(divider, mode, idx);
      dividersLayer.appendChild(divider);
    });
  },

  updateInteractiveHours(mode) {
    const isDayNight = mode === "dayNight";
    const hoursEl = document.getElementById(isDayNight ? "interactiveHoursDayNight" : "interactiveHoursRoutine");
    if (!hoursEl) return;
    const periods = isDayNight ? State.dayNightPeriods : State.routinePeriods;

    const cells = hoursEl.children;
    for (let h = 0; h < 24 && h < cells.length; h++) {
      const cell = cells[h];
      const styleInfo = PeriodUtils.getHourStyle(h, periods);
      cell.style.backgroundColor = styleInfo.color;
      cell.style.color = styleInfo.fontColor;
    }
  },

  updateDividerPosition(dividerEl, targetHour) {
    dividerEl.style.left = `${(targetHour / 24) * 100}%`;
    dividerEl.setAttribute("aria-valuenow", String(targetHour));
    const topKnob = dividerEl.querySelector(".divider-knob-top");
    if (topKnob) {
      topKnob.textContent = `${String(targetHour).padStart(2, "0")}:00`;
    }
  },

  moveDividerToHour(mode, idx, targetHour) {
    if (State.periodMode !== mode) return false;

    const isDayNight = mode === "dayNight";
    const periods = isDayNight ? State.dayNightPeriods : State.routinePeriods;
    if (targetHour === periods[idx].start) return false;

    const N = periods.length;
    const prevIdx = (idx - 1 + N) % N;
    const nextIdx = (idx + 1) % N;

    const prevStart = periods[prevIdx].start;
    const nextStart = periods[nextIdx].start;

    if (targetHour === prevStart || targetHour === nextStart) return false;

    const isInsidePrev = (prevStart < nextStart)
      ? (targetHour > prevStart && targetHour < nextStart)
      : (targetHour > prevStart || targetHour < nextStart);

    if (!isInsidePrev) return false;

    periods[idx].start = targetHour;
    periods[prevIdx].end = (targetHour - 1 + 24) % 24;
    return true;
  },

  applyDividerMove(mode, idx, targetHour, dividerEl) {
    const moved = this.moveDividerToHour(mode, idx, targetHour);
    if (!moved) return false;

    this.updateDividerPosition(dividerEl, targetHour);
    this.updateInteractiveHours(mode);
    return true;
  },

  handleCellClick(mode, targetHour) {
    if (State.periodMode !== mode) return;

    const isDayNight = mode === "dayNight";
    const periods = isDayNight ? State.dayNightPeriods : State.routinePeriods;
    const N = periods.length;
    let bestIdx = -1;
    let minDistance = 999;

    for (let i = 0; i < N; i++) {
      const start = periods[i].start;
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
      const moved = this.moveDividerToHour(mode, bestIdx, targetHour);
      if (moved) {
        State.saveTimePeriods();
        this.renderPeriodControls();
        Renderer.render();
      }
    }
  },

  wireDividerDrag(dividerEl, mode, idx) {
    const isDayNight = mode === "dayNight";
    const hoursEl = document.getElementById(isDayNight ? "interactiveHoursDayNight" : "interactiveHoursRoutine");
    let isDragging = false;
    let cachedRect = null;
    let pendingClientX = null;
    let dragRafId = null;

    const updateDrag = () => {
      dragRafId = null;
      if (!isDragging || !cachedRect || pendingClientX === null || State.periodMode !== mode) return;

      const px = Math.max(0, Math.min(pendingClientX - cachedRect.left, cachedRect.width));
      const rawHour = Math.round((px / cachedRect.width) * 24) % 24;
      this.applyDividerMove(mode, idx, rawHour, dividerEl);
    };

    const onPointerMove = (e) => {
      if (!isDragging || State.periodMode !== mode) return;
      pendingClientX = e.clientX;
      if (dragRafId !== null) return;
      dragRafId = requestAnimationFrame(updateDrag);
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }

      try {
        dividerEl.releasePointerCapture(e.pointerId);
      } catch (_) {}

      dividerEl.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      State.saveTimePeriods();
      Renderer.render();
    };

    dividerEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (State.periodMode !== mode) return; // Must be enabled first
      if (!hoursEl) return;

      cachedRect = hoursEl.getBoundingClientRect();
      if (cachedRect.width <= 0) return;

      isDragging = true;
      pendingClientX = e.clientX;
      dividerEl.classList.add("is-dragging");

      try {
        dividerEl.setPointerCapture(e.pointerId);
      } catch (_) {}

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      e.preventDefault();
    });
  },

  renderPeriodControls() {
    const isDayNight = State.periodMode === "dayNight";

    const radioDayNight = document.getElementById("periodModeRadioDayNight");
    const radioRoutine = document.getElementById("periodModeRadioRoutine");
    if (radioDayNight) radioDayNight.checked = isDayNight;
    if (radioRoutine) radioRoutine.checked = !isDayNight;

    const blockDayNight = document.getElementById("periodModeBlockDayNight");
    const blockRoutine = document.getElementById("periodModeBlockRoutine");
    if (blockDayNight) blockDayNight.classList.toggle("is-active", isDayNight);
    if (blockRoutine) blockRoutine.classList.toggle("is-active", !isDayNight);

    this.renderInteractiveHours("dayNight");
    this.renderTimelineDividers("dayNight");

    this.renderInteractiveHours("routine");
    this.renderTimelineDividers("routine");
  },

  wirePeriods() {
    const radioDayNight = document.getElementById("periodModeRadioDayNight");
    const radioRoutine = document.getElementById("periodModeRadioRoutine");
    const blockDayNight = document.getElementById("periodModeBlockDayNight");
    const blockRoutine = document.getElementById("periodModeBlockRoutine");

    const selectMode = (mode) => {
      if (State.periodMode === mode) return;
      State.periodMode = mode;
      State.saveTimePeriods();
      this.renderPeriodControls();
      Renderer.render();
    };

    if (radioDayNight) {
      radioDayNight.addEventListener("change", () => {
        if (radioDayNight.checked) selectMode("dayNight");
      });
    }

    if (radioRoutine) {
      radioRoutine.addEventListener("change", () => {
        if (radioRoutine.checked) selectMode("routine");
      });
    }

    if (blockDayNight) {
      blockDayNight.addEventListener("click", () => {
        selectMode("dayNight");
      });
    }

    if (blockRoutine) {
      blockRoutine.addEventListener("click", () => {
        selectMode("routine");
      });
    }

    const resetPeriodsButton = document.getElementById("resetPeriodsButton");
    if (resetPeriodsButton) {
      resetPeriodsButton.addEventListener("click", () => {
        State.dayNightPeriods = JSON.parse(JSON.stringify(CONFIG.defaultDayNightPeriods));
        State.routinePeriods = JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
        State.periodMode = "dayNight";
        State.saveTimePeriods();
        this.renderPeriodControls();
        Renderer.render();
      });
    }
  }
};

