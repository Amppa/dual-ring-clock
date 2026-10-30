/**
 * TimeMapper - Shared Minimap Rendering Module
 */

import { State } from "./state.js";
import { MapUtils, TimeUtils, I18nUtils, MathUtils, TimelineUtils } from "./utils.js";

const NIGHT_DECLINATION_DEG = 35.0;
const NIGHT_TAN_DEC = Math.tan(NIGHT_DECLINATION_DEG * Math.PI / 180);
const NIGHT_Y_SHIFT = 10;

export const MapPreview = {
  ASSET_PATH: "../../assets/world-map.jpg",

  /** "Now" shifted by `offsetHours`; every sun-driven layer shares this. */
  shiftedNow(offsetHours) {
    return new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  },

  /**
   * Collect the nodes this module renders into. `root` is `document`
   * in the popup or the mount element built by buildPreview().
   */
  collectRefs(root) {
    const q = (sel) => root.querySelector(sel);
    return {
      mapShell: q(".map-shell"),
      mapImg: q(".world-map"),
      cityLayer: q(".city-layer"),
      timezoneHoverBands: q("#timezoneHoverBands") || q(".timezone-hover-bands"),
      mapTimeLabelLayer: q(".map-time-label-layer"),
      hourLines: q(".hour-lines"),
      nightAreaOverlay: q(".night-area-overlay"),
      nightPath: q("#nightPath"),
      nightPathRef: q("#nightPathRef"),
      mapTimeline: q(".map-timeline"),
    };
  },

  /**
   * Build a standalone preview (map shell + timeline strip) into `mount`.
   * Same relative asset path works from src/popup/ and src/options/.
   */
  buildPreview(mount) {
    mount.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "map-shell";

    const img = document.createElement("img");
    img.className = "world-map";
    img.src = this.ASSET_PATH;
    img.alt = "World Map";
    shell.append(img);

    const hourLines = document.createElement("div");
    hourLines.className = "hour-lines";
    hourLines.setAttribute("aria-hidden", "true");
    shell.append(hourLines);

    const svgNS = "http://www.w3.org/2000/svg";
    const overlay = document.createElementNS(svgNS, "svg");
    overlay.setAttribute("class", "night-area-overlay");
    overlay.setAttribute("viewBox", "0 0 100 100");
    overlay.setAttribute("preserveAspectRatio", "none");
    overlay.setAttribute("aria-hidden", "true");
    const nightPath = document.createElementNS(svgNS, "path");
    nightPath.setAttribute("id", "nightPath");
    nightPath.setAttribute("d", "");
    const nightPathRef = document.createElementNS(svgNS, "path");
    nightPathRef.setAttribute("id", "nightPathRef");
    nightPathRef.setAttribute("d", "");
    overlay.append(nightPath, nightPathRef);
    shell.append(overlay);

    const hoverBands = document.createElement("div");
    hoverBands.id = "timezoneHoverBands";
    hoverBands.className = "timezone-hover-bands";
    shell.append(hoverBands);

    const cityLayer = document.createElement("div");
    cityLayer.className = "city-layer";
    cityLayer.setAttribute("aria-label", "City Pins");
    shell.append(cityLayer);

    const labelLayer = document.createElement("div");
    labelLayer.className = "map-time-label-layer";
    labelLayer.setAttribute("aria-hidden", "true");
    shell.append(labelLayer);

    const timeline = document.createElement("div");
    timeline.id = "mapTimeline";
    timeline.className = "map-timeline";
    timeline.setAttribute("aria-hidden", "true");

    mount.append(shell, timeline);
    return this.collectRefs(mount);
  },

  _createPinElement(city, isSelected, currentOffset, subsolarLng, nightCurve = null) {
    const position = MapUtils.mapPosition(city);
    const button = document.createElement("button");
    button.type = "button";
    const isNight = this.isCityInNight(city, currentOffset, subsolarLng, nightCurve);
    button.className = `city-pin${isSelected ? " is-selected" : ""}${isNight ? " is-night" : ""}`;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.dataset.id = city.id;
    button.dataset.zone = city.zone;

    const cityName = I18nUtils.getCityName(city);
    button.title = cityName;
    button.setAttribute("aria-label", I18nUtils.getTranslation("selectCity", { name: cityName }));
    return button;
  },

  /**
   * Full pins mount (sync immediate + schedule deferred pins).
   * Used by options preview, tests, and full repaints.
   */
  renderPins(refs, onCityToggle) {
    this.renderPinsImmediate(refs, onCityToggle);
    this.mountDeferredPins(refs);
  },

  /**
   * Fast-path immediate reconciler: updates transforms, labels, and mounts/patches
   * visible & selected pins without wiping the DOM. Background catalog pins are
   * deferred to mountDeferredPins on idle.
   */
  renderPinsImmediate(refs, onCityToggle) {
    if (refs.mapImg) {
      refs.mapImg.style.transform = `translateY(calc(-50% + ${State.mapSettings.mapYOffset || 0}px))`;
    }
    if (refs.cityLayer) {
      refs.cityLayer.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }
    if (refs.mapTimeLabelLayer) {
      refs.mapTimeLabelLayer.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }

    const activeFraction = State.getActiveScrubFraction();
    const useFraction = activeFraction !== null ? activeFraction : TimelineUtils.getNowFraction();
    let targetDate = null;
    if (useFraction !== null && State.baseHours && State.baseHours[0]) {
      targetDate = new Date(State.baseHours[0].getTime() + useFraction * 24 * 3600000);
    }

    // Single delegated click listener on cityLayer instead of 70+ closures
    if (refs.cityLayer && !refs.cityLayer._hasCityDelegation) {
      refs.cityLayer._hasCityDelegation = true;
      refs.cityLayer.addEventListener("click", (e) => {
        const pin = e.target.closest(".city-pin");
        if (!pin || !refs.cityLayer.contains(pin)) return;
        e.stopPropagation();
        const cityId = pin.dataset.id;
        if (cityId) {
          State.toggleCity(cityId);
          if (refs._onCityToggle) refs._onCityToggle();
        }
      });
    }
    refs._onCityToggle = onCityToggle;

    const allCities = State.allCities();
    const currentOffset = State.selectedOffsetHours || 0;
    const subsolarLng = MapUtils.subsolarLng(this.shiftedNow(currentOffset));
    // One shared terminator curve for all pins: replaces 70x trig with lookups.
    const nightCurve = this.calcNightPoints(currentOffset).curve;
    const selectedSet = new Set(State.selectedIds);
    const validCityIdSet = new Set(allCities.map((c) => c.id));

    if (!refs.cityLayer) return;

    // Map existing mounted pins by data-id
    const mountedPinsMap = new Map();
    Array.from(refs.cityLayer.children).forEach((el) => {
      const id = el.dataset?.id;
      if (!id) return;
      if (!validCityIdSet.has(id)) {
        // Obsolete custom city removed
        el.remove();
      } else {
        mountedPinsMap.set(id, el);
      }
    });

    // 1. Initial mount if cityLayer is completely empty
    if (mountedPinsMap.size === 0) {
      const immediateCities = allCities.filter((c) => selectedSet.has(c.id) || c.id === "local");
      const pinFrag = document.createDocumentFragment();
      immediateCities.forEach((city) => {
        pinFrag.append(this._createPinElement(city, selectedSet.has(city.id), currentOffset, subsolarLng, nightCurve));
      });
      refs.cityLayer.append(pinFrag);
    } else {
      // 2. Incremental update: update selected & night classes on already-mounted pins
      for (const [id, btn] of mountedPinsMap) {
        const city = State.findCity(id);
        if (!city) continue;
        const isSelected = selectedSet.has(city.id);
        const isNight = this.isCityInNight(city, currentOffset, subsolarLng, nightCurve);
        btn.classList.toggle("is-selected", isSelected);
        btn.classList.toggle("is-night", isNight);
      }

      // 3. Ensure any selected city not yet mounted gets mounted immediately
      const missingSelectedFrag = document.createDocumentFragment();
      selectedSet.forEach((id) => {
        if (!mountedPinsMap.has(id)) {
          const city = State.findCity(id);
          if (city) {
            const el = this._createPinElement(city, true, currentOffset, subsolarLng, nightCurve);
            missingSelectedFrag.append(el);
            mountedPinsMap.set(id, el);
          }
        }
      });
      if (missingSelectedFrag.childNodes.length > 0) {
        refs.cityLayer.append(missingSelectedFrag);
      }
    }

    // Synchronize label layer for selected cities without wiping unchanged labels
    if (refs.mapTimeLabelLayer) {
      const existingLabelMap = new Map();
      Array.from(refs.mapTimeLabelLayer.children).forEach((lbl) => {
        const id = lbl.dataset?.id;
        if (!id || !selectedSet.has(id)) {
          lbl.remove();
        } else {
          existingLabelMap.set(id, lbl);
        }
      });

      const labelFrag = document.createDocumentFragment();
      State.selectedIds.forEach((id) => {
        if (!existingLabelMap.has(id)) {
          const city = State.findCity(id);
          if (!city) return;
          const position = MapUtils.mapPosition(city);
          const label = document.createElement("div");
          label.className = "map-time-label";
          label.style.left = `${position.x}%`;
          label.style.top = `${position.y}%`;
          label.dataset.id = city.id;
          label.dataset.zone = city.zone;
          if (targetDate) {
            label.textContent = TimeUtils.formatTime(targetDate, city.zone);
            label.style.display = "";
          } else {
            label.style.display = "none";
          }
          labelFrag.append(label);
        }
      });
      if (labelFrag.childNodes.length > 0) {
        refs.mapTimeLabelLayer.append(labelFrag);
      }
      this.updateMapCityTimes(refs, activeFraction);
    }
  },

  /** Idle-mount remaining catalog pins in one step without re-rendering anything else. */
  mountDeferredPins(refs) {
    if (!refs.cityLayer) return;
    const existingIds = new Set(Array.from(refs.cityLayer.children).map((el) => el.dataset?.id));
    const deferredCities = State.allCities().filter((city) => {
      if (!city || existingIds.has(city.id)) return false;
      return true;
    });
    if (deferredCities.length === 0) return;

    if (this._deferredIdleTimer) {
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(this._deferredIdleTimer);
      else clearTimeout(this._deferredIdleTimer);
      this._deferredIdleTimer = null;
    }

    const schedule = typeof requestIdleCallback === "function"
      ? (fn) => requestIdleCallback(fn, { timeout: 1000 })
      : (fn) => setTimeout(fn, 0);

    this._deferredIdleTimer = schedule(() => {
      this._deferredIdleTimer = null;
      if (!refs.cityLayer) return;
      const currentMountedSet = new Set(Array.from(refs.cityLayer.children).map((el) => el.dataset?.id));
      const deferredFrag = document.createDocumentFragment();
      const curOffset = State.selectedOffsetHours || 0;
      const curSubsolar = MapUtils.subsolarLng(this.shiftedNow(curOffset));
      const curCurve = this.calcNightPoints(curOffset).curve;
      const selectedSet = new Set(State.selectedIds);
      deferredCities.forEach((city) => {
        if (currentMountedSet.has(city.id)) return;
        currentMountedSet.add(city.id);
        deferredFrag.append(this._createPinElement(city, selectedSet.has(city.id), curOffset, curSubsolar, curCurve));
      });
      if (deferredFrag.childNodes.length > 0) {
        refs.cityLayer.append(deferredFrag);
      }
    });
  },

  /**
   * Screen-x position of each 2-hour solar terminator line, wrapped into the
   * visible span around the map centre. `x` is intentionally unclamped so each
   * caller can pick its own policy: the hour lines pin to the edges, the
   * timeline strip drops off-map ticks.
   */
  hourLinePositions(offsetHours) {
    const subsolarLng = MapUtils.subsolarLng(this.shiftedNow(offsetHours));
    const centerLng = MapUtils.getXLongitude(50);
    const out = [];
    for (let h = 0; h < 24; h += 2) {
      let diff = subsolarLng + (h - 12) * 15 - centerLng;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      out.push({ hour: h, x: MapUtils.getLongitudeX(centerLng + diff) });
    }
    return out;
  },

  renderHourLines(refs, offsetHours = 0) {
    if (!refs.hourLines) return;
    refs.hourLines.innerHTML = "";

    const frag = document.createDocumentFragment();
    for (const { x: rawX } of this.hourLinePositions(offsetHours)) {
      const line = document.createElement("div");
      line.style.position = "absolute";
      line.style.left = `${MathUtils.clamp(rawX, 0, 100)}%`;
      line.style.top = "0";
      line.style.bottom = "0";
      line.style.width = "1px";
      line.style.backgroundColor = "rgba(8, 74, 96, 0.18)";
      frag.append(line);
    }
    refs.hourLines.append(frag);
  },

  calcNightPoints(offsetHours) {
    const subsolarLng = MapUtils.subsolarLng(this.shiftedNow(offsetHours));
    if (this._cachedNightPoints && this._cachedNightPoints.subsolarLng === subsolarLng) {
      return this._cachedNightPoints.points;
    }

    const points = [];
    // Numeric curve for isCityInNight lookups: same calibrated viewport
    // coordinates as the SVG path, so pins and shading always agree.
    const curve = [];
    for (let x = 0; x <= 100; x += 2) {
      const lng = MapUtils.getXLongitude(x);
      const lat = Math.atan(-Math.cos((lng - subsolarLng) * Math.PI / 180) / NIGHT_TAN_DEC)
        * 180 / Math.PI + NIGHT_Y_SHIFT;
      const { x: px, y: py } = MapUtils.mapPosition({ lng, lat });
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      curve.push({ x: px, y: py });
    }
    // Keep the string array as the return value (SVG path building reads it);
    // stash the numeric curve alongside for night lookups.
    points.curve = curve;
    this._cachedNightPoints = { subsolarLng, points };
    return points;
  },

  renderMapTimeline(refs, offsetHours = 0) {
    if (!refs.mapTimeline) return;
    refs.mapTimeline.innerHTML = "";

    const frag = document.createDocumentFragment();
    for (const { hour, x } of this.hourLinePositions(offsetHours)) {
      if (x < 0 || x > 100) continue;
      const tick = document.createElement("div");
      tick.className = "map-timeline-tick";
      tick.style.left = `${x}%`;

      const label = document.createElement("div");
      label.className = "map-timeline-label";
      label.style.left = `${x}%`;
      label.textContent = `${String(hour).padStart(2, "0")}:00`;

      frag.append(tick, label);
    }
    refs.mapTimeline.append(frag);
  },

  renderHourBands(refs, offsetHours = 0) {
    if (!refs.timezoneHoverBands) return;
    refs.timezoneHoverBands.innerHTML = "";

    const subsolarLng = MapUtils.subsolarLng(this.shiftedNow(offsetHours));
    const centerLng = MapUtils.getXLongitude(50);
    const frag = document.createDocumentFragment();

    for (let h = 0; h < 24; h++) {
      let diff = subsolarLng + (h - 12) * 15 - centerLng;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;

      const x_left = MapUtils.getLongitudeX(centerLng + diff - 7.5);
      const x_right = MapUtils.getLongitudeX(centerLng + diff + 7.5);

      const left = MathUtils.clamp(Math.min(x_left, x_right), 0, 100);
      const right = MathUtils.clamp(Math.max(x_left, x_right), 0, 100);
      const width = right - left;
      if (width < 0.2) continue;

      const band = document.createElement("div");
      band.className = "timezone-band";
      band.dataset.hour = String(h);
      band.title = `${String(h).padStart(2, "0")}:00`;
      band.style.left = `${left.toFixed(2)}%`;
      band.style.width = `${width.toFixed(2)}%`;
      frag.append(band);
    }

    refs.timezoneHoverBands.append(frag);
  },

  renderNightArea(refs, offsetHours = 0, skipPinsUpdate = false) {
    if (!refs.nightPath) return;

    // Shading itself is cheap and needed for first paint; bands/lines/ticks
    // are decorations that can wait for idle (see renderNightDecorations).
    const activePts = this.renderNightShading(refs, offsetHours);

    if (!skipPinsUpdate) {
      this.updatePinsNightState(refs, offsetHours, activePts?.curve);
    }
  },

  /** SVG shading only (no bands/lines/ticks); shared by sync and idle paths. */
  renderNightShading(refs, offsetHours = 0) {
    if (!refs.nightPath) return null;
    if (refs.nightAreaOverlay) {
      refs.nightAreaOverlay.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }
    const activePts = this.calcNightPoints(offsetHours);
    refs.nightPath.setAttribute("d", `M 0,100 L ${activePts.join(" L ")} L 100,100 Z`);
    if (refs.nightPathRef) {
      if (!this._cachedNowPath || Math.abs(Date.now() - (this._cachedNowPathTime || 0)) > 60000) {
        const realNowPts = this.calcNightPoints(0);
        this._cachedNowPath = `M ${realNowPts.join(" L ")}`;
        this._cachedNowPathTime = Date.now();
      }
      refs.nightPathRef.setAttribute("d", this._cachedNowPath);
    }
    const activeFraction = State.getActiveScrubFraction();
    this.updateMapCityTimes(refs, activeFraction);
    return activePts;
  },

  /** Bands + hour lines + timeline ticks; deferred past first paint and cached by offset. */
  renderNightDecorations(refs, offsetHours = 0) {
    if (this._lastDecorOffset === offsetHours && refs.hourLines && refs.hourLines.children.length > 0) {
      return;
    }
    this._lastDecorOffset = offsetHours;
    this.renderMapTimeline(refs, offsetHours);
    this.renderHourLines(refs, offsetHours);
    this.renderHourBands(refs, offsetHours);
  },

  /**
   * Determine if a city is inside the night curve (terminator) at the given offset.
   * `cachedSubsolarLng` allows batch callers to avoid recomputing subsolar longitude.
   * `cachedCurve` (from calcNightPoints().curve) allows skipping the per-city
   * trigonometry entirely: the pin shares the exact curve the shading draws,
   * so color and shadow can never disagree by 1px.
   */
  isCityInNight(city, offsetHours = 0, cachedSubsolarLng = null, cachedCurve = null) {
    const cityPos = MapUtils.mapPosition(city);
    if (cachedCurve && cachedCurve.length > 0) {
      return this._isNightFromCurve(cityPos, cachedCurve);
    }
    const { lng } = MapUtils.lngLatOf(city);
    const subsolarLng = cachedSubsolarLng !== null
      ? cachedSubsolarLng
      : MapUtils.subsolarLng(this.shiftedNow(offsetHours));
    const termLat = Math.atan(-Math.cos((lng - subsolarLng) * Math.PI / 180) / NIGHT_TAN_DEC)
      * 180 / Math.PI + NIGHT_Y_SHIFT;
    const termPos = MapUtils.mapPosition({ lng, lat: termLat });
    return cityPos.y >= termPos.y;
  },

  /** Table lookup against the terminator polyline (51 pts, x step 2). */
  _isNightFromCurve(cityPos, curve) {
    const x = cityPos.x;
    // Clamp to endpoints when calibration pushes pins off the curve span.
    if (x <= curve[0].x) return cityPos.y >= curve[0].y;
    const last = curve[curve.length - 1];
    if (x >= last.x) return cityPos.y >= last.y;
    // Linear scan over 51 pts is cheaper than trig; find bracketing segment.
    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i];
      const b = curve[i + 1];
      if (x >= a.x && x <= b.x) {
        const span = b.x - a.x;
        const t = span > 0 ? (x - a.x) / span : 0;
        const curveY = a.y + (b.y - a.y) * t;
        return cityPos.y >= curveY;
      }
    }
    // Non-monotonic calibration fallback: nearest point.
    let best = curve[0];
    let bestDist = Math.abs(x - best.x);
    for (let i = 1; i < curve.length; i++) {
      const d = Math.abs(x - curve[i].x);
      if (d < bestDist) { bestDist = d; best = curve[i]; }
    }
    return cityPos.y >= best.y;
  },

  /** Synchronize .is-night class on all rendered pins */
  updatePinsNightState(refs, offsetHours = 0, cachedCurve = null) {
    if (!refs.cityLayer) return;
    const allCities = State.allCities();
    const pinElements = refs.cityLayer.querySelectorAll(".city-pin");
    if (!pinElements.length) return;
    const curve = cachedCurve || this.calcNightPoints(offsetHours).curve;
    const subsolarLng = MapUtils.subsolarLng(this.shiftedNow(offsetHours));
    pinElements.forEach((btn, idx) => {
      // Phased mounting appends deferred pins after the selected ones, so DOM
      // order no longer matches allCities order. The pin's own data-id is
      // authoritative; the index is only a fallback for unmarked pins.
      const city = (btn.dataset.id ? State.findCity(btn.dataset.id) : null) || allCities[idx];
      if (city) {
        btn.classList.toggle("is-night", this.isCityInNight(city, offsetHours, subsolarLng, curve));
      }
    });
  },

  updateMapCityTimes(refs, activeFraction) {
    if (!refs.mapTimeLabelLayer) return;

    const useFraction = activeFraction !== null ? activeFraction : TimelineUtils.getNowFraction();

    if (useFraction === null || !State.baseHours || !State.baseHours[0]) {
      refs.mapTimeLabelLayer.querySelectorAll(".map-time-label").forEach((label) => {
        label.style.display = "none";
        label.textContent = "";
      });
      return;
    }

    const targetDate = new Date(State.baseHours[0].getTime() + useFraction * 24 * 3600000);

    refs.mapTimeLabelLayer.querySelectorAll(".map-time-label").forEach((label) => {
      const zone = label.dataset.zone;
      if (zone) {
        label.textContent = TimeUtils.formatTime(targetDate, zone);
        label.style.display = "";
      }
    });
  },

  applyVisibility(refs) {
    if (refs.nightAreaOverlay) {
      refs.nightAreaOverlay.style.display = State.mapSettings.showNightArea ? "" : "none";
    }
    if (refs.hourLines) {
      refs.hourLines.style.display = State.mapSettings.showHourLines ? "" : "none";
    }
    if (refs.mapTimeLabelLayer) {
      refs.mapTimeLabelLayer.style.display = State.mapSettings.showCityTimes ? "" : "none";
    }
  },

  /** Full repaint: pins + night + timeline + visibility. */
  renderAll(refs, onCityToggle, offsetHours = 0) {
    this.renderPins(refs, onCityToggle);
    this.renderNightArea(refs, offsetHours);
    this.renderNightDecorations(refs, offsetHours);
    this.applyVisibility(refs);
  },

  /**
   * Wire clicking on the map background to generate and add a custom timezone city.
   * Accurately calculates coordinates relative to refs.cityLayer to prevent Y-offset.
   */
  wireMapClick(refs, onCityAdded) {
    const targetEl = refs.mapShell || (refs.cityLayer ? refs.cityLayer.parentElement : null);
    if (!targetEl || targetEl._hasMapClickDelegation) return;
    targetEl._hasMapClickDelegation = true;

    targetEl.addEventListener("click", (e) => {
      if (e.target.closest(".city-pin")) return;
      if (!refs.cityLayer) return;

      const layerRect = refs.cityLayer.getBoundingClientRect();
      if (!layerRect.width || !layerRect.height) return;

      const clickX = ((e.clientX - layerRect.left) / layerRect.width) * 100;
      const clickY = ((e.clientY - layerRect.top) / layerRect.height) * 100;

      const x = MathUtils.clamp(MapUtils.uncalibrateX(clickX), 0, 100);
      const y = MathUtils.clamp(MapUtils.uncalibrateY(clickY), 0, 100);
      const lng = Number(MapUtils.xToLng(x).toFixed(2));
      const lat = Number(MapUtils.yToLat(y).toFixed(2));

      const offset = MathUtils.clamp(Math.round(lng / 15), -12, 12);
      const offsetText = offset >= 0 ? `+${offset}` : `${offset}`;
      const name = `UTC${offsetText}`;

      let zone;
      if (offset === 0) {
        zone = "Etc/GMT";
      } else if (offset > 0) {
        zone = `Etc/GMT-${offset}`;
      } else {
        zone = `Etc/GMT+${Math.abs(offset)}`;
      }

      const newCity = {
        id: `custom-utc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        zone,
        x,
        y,
        lng,
        lat
      };

      if (State.selectedIds.length >= State.cityLimit) {
        return;
      }

      State.customCities = [...State.customCities, newCity];
      State.saveCustomCities();
      State.toggleCity(newCity.id);
      if (typeof onCityAdded === "function") {
        onCityAdded(newCity);
      }
    });
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.MapPreview = MapPreview;
}
