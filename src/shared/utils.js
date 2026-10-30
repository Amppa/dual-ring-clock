/**
 * TimeMapper - Utilities Module
 */

import { PROJECTION, CONFIG } from "./config.js";
import { i18nTranslations, i18nCityNames } from "./i18n.js";

export const MathUtils = {
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
};

export const EscapeUtils = {
  HTML_ENTITIES: {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  },

  /**
   * Escape a value for safe interpolation into an innerHTML template.
   * Only needed for values from user input or remote APIs.
   */
  html(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => EscapeUtils.HTML_ENTITIES[char]);
  }
};

export const TimeUtils = {
  _formatterCache: {},
  _resolvedCache: {},
  _cachedSupportedZones: null,

  getFormatter(locale, options) {
    const key = `${locale}_${options.timeZone || ''}_${options.hour || ''}_${options.minute || ''}_${options.hour12 || ''}_${options.weekday || ''}_${options.hourCycle || ''}_${options.timeZoneName || ''}_${options.year || ''}_${options.month || ''}_${options.day || ''}`;
    if (!this._formatterCache[key]) {
      this._formatterCache[key] = new Intl.DateTimeFormat(locale, options);
    }
    return this._formatterCache[key];
  },

  resolveZone(zone) {
    if (typeof zone !== "string") return "UTC";
    const cleanInput = zone.trim().toLowerCase().replace(/[\s\-_]+/g, "");

    if (this._resolvedCache[cleanInput]) {
      return this._resolvedCache[cleanInput];
    }

    // 1. Try case-insensitive and loose matching against browser supported zones
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      try {
        if (!this._cachedSupportedZones) {
          this._cachedSupportedZones = Intl.supportedValuesOf("timeZone");
        }
        const supported = this._cachedSupportedZones;
        // Look for exact match (ignoring case/spaces/hyphens/underscores)
        let match = supported.find(tz => tz.toLowerCase().replace(/[\s\-_]+/g, "") === cleanInput);
        if (match) {
          this._resolvedCache[cleanInput] = match;
          return match;
        }

        // Look for shorthand match (e.g. "taipei" matches "Asia/Taipei")
        match = supported.find(tz => {
          const parts = tz.toLowerCase().split("/");
          return parts[parts.length - 1].replace(/[\s\-_]+/g, "") === cleanInput;
        });
        if (match) {
          this._resolvedCache[cleanInput] = match;
          return match;
        }
      } catch (e) { }
    }

    // 2. Direct validation fallback (handles UTC offsets, Etc/GMT, etc.)
    try {
      this.getFormatter("en-US", { timeZone: zone }).format(new Date());
      this._resolvedCache[cleanInput] = zone;
      return zone;
    } catch { }

    // 3. Compatibility fallback for older browsers
    const prefixes = ["Asia", "Europe", "America", "Australia", "Africa", "Pacific", "Atlantic", "Indian"];
    const formatted = zone.trim().replace(/\s+/g, "_");
    for (const prefix of prefixes) {
      const candidate = `${prefix}/${formatted}`;
      try {
        this.getFormatter("en-US", { timeZone: candidate }).format(new Date());
        this._resolvedCache[cleanInput] = candidate;
        return candidate;
      } catch { }
    }

    this._resolvedCache[cleanInput] = "UTC";
    return "UTC";
  },

  isValidZone(zone) {
    if (typeof zone !== "string" || !zone.trim()) return false;
    const resolved = this.resolveZone(zone);
    try {
      this.getFormatter("en-US", { timeZone: resolved }).format(new Date());
      return resolved !== "UTC" || zone.trim().toUpperCase() === "UTC";
    } catch {
      return false;
    }
  },

  formatTime(date, zone, options = {}) {
    try {
      const resolved = this.resolveZone(zone);
      const locale = I18nUtils.getLocale() || "en-US";
      const formatter = this.getFormatter(locale, {
        timeZone: resolved,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        weekday: options.weekday ? "short" : undefined
      });
      return formatter.format(date);
    } catch {
      return "00:00";
    }
  },

  hourInZone(date, zone) {
    try {
      const resolved = this.resolveZone(zone);
      const formatter = this.getFormatter("en-US", {
        timeZone: resolved,
        hour: "2-digit",
        hourCycle: "h23"
      });
      const parts = formatter.formatToParts(date);
      const hourPart = parts.find((part) => part.type === "hour");
      return hourPart ? Number(hourPart.value) : date.getHours();
    } catch {
      return date.getHours();
    }
  },

  dateInZone(date, zone) {
    try {
      const resolved = this.resolveZone(zone);
      const formatter = this.getFormatter("en-US", {
        timeZone: resolved,
        month: "numeric",
        day: "numeric"
      });
      return formatter.format(date);
    } catch {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  },

  utcOffsetText(date, zone) {
    try {
      const resolved = this.resolveZone(zone);
      const formatter = this.getFormatter("en-US", {
        timeZone: resolved,
        timeZoneName: "shortOffset"
      });
      const parts = formatter.formatToParts(date);
      const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
      const match = offset.match(/^GMT([+-])?(\d{1,2})?(?::?(\d{2}))?$/);
      if (!match || !match[1]) return "UTC+0";

      const sign = match[1];
      const hour = Number(match[2] || 0);
      const minute = match[3] ? `:${match[3]}` : "";
      return `UTC${sign}${hour}${minute}`;
    } catch {
      return "UTC+0";
    }
  },

  getOffsetMinutes(date, zone) {
    try {
      const resolved = this.resolveZone(zone);
      const formatter = this.getFormatter("en-US", {
        timeZone: resolved,
        timeZoneName: "longOffset"
      });
      const parts = formatter.formatToParts(date);
      const offsetStr = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
      if (offsetStr === "GMT") return 0;

      const match = offsetStr.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
      if (!match) return 0;

      const sign = match[1] === "+" ? 1 : -1;
      const hours = Number(match[2]);
      const minutes = match[3] ? Number(match[3]) : 0;
      return sign * (hours * 60 + minutes);
    } catch {
      return 0;
    }
  },

  isCurrentlyDST(zone) {
    try {
      const resolved = this.resolveZone(zone);
      const currentYear = new Date().getFullYear();

      const jan = new Date(Date.UTC(currentYear, 0, 1));
      const jul = new Date(Date.UTC(currentYear, 6, 1));

      const janOffset = this.getOffsetMinutes(jan, resolved);
      const julOffset = this.getOffsetMinutes(jul, resolved);

      if (janOffset === julOffset) {
        return false;
      }

      const maxOffset = Math.max(janOffset, julOffset);
      const curOffset = this.getOffsetMinutes(new Date(), resolved);

      return curOffset === maxOffset;
    } catch {
      return false;
    }
  }
};

export const I18nUtils = {
  /**
   * Active UI language. `State.currentLang`'s setter is the only writer
   * (via setLang), so this module never has to reach for the State singleton
   * to resolve a string.
   */
  _lang: "zh",

  setLang(lang) {
    this._lang = lang;
  },

  /** Internal code, falling back to the default language. */
  getLang() {
    return this._lang || "zh";
  },

  /** BCP-47 locale for date/time formatting. */
  getLocale() {
    return CONFIG.localeMap[this.getLang()];
  },

  /**
   * The one place that maps translation keys onto the DOM. Both the popup and
   * the options page call applyAttributes(); neither should re-implement it.
   * `pick`/`put` describe how each attribute type reads its key and writes its
   * value, because textContent and an attribute are not interchangeable.
   */
  _attributes: [
    { selector: "[data-i18n]", pick: (el) => el.dataset.i18n, put: (el, text) => { el.textContent = text; } },
    { selector: "[data-i18n-placeholder]", pick: (el) => el.dataset.i18nPlaceholder, put: (el, text) => { el.placeholder = text; } },
    { selector: "[data-i18n-title]", pick: (el) => el.dataset.i18nTitle, put: (el, text) => { el.title = text; } },
    { selector: "[data-i18n-aria-label]", pick: (el) => el.dataset.i18nAriaLabel, put: (el, text) => { el.setAttribute("aria-label", text); } }
  ],

  /**
   * Translate every marked element under `root` and announce the language to
   * assistive tech via <html lang>.
   *
   * A key missing from the active dictionary is reported rather than silently
   * left as the hard-coded text in the HTML, which would otherwise render as a
   * random language inside an otherwise translated page.
   */
  applyAttributes(root = document) {
    const lang = this.getLang();
    const dict = i18nTranslations[lang];

    if (!dict) {
      console.warn(`[i18n] no dictionary for language "${lang}"; leaving all marked text untranslated`);
    } else {
      for (const { selector, pick, put } of this._attributes) {
        root.querySelectorAll(selector).forEach((elem) => {
          const key = pick(elem);
          const text = dict[key];
          if (text === undefined || text === "") {
            console.warn(`[i18n] missing key "${key}" for language "${lang}" (${selector}); showing HTML fallback: "${(elem.textContent || "").trim()}"`);
            return;
          }
          put(elem, text);
        });
      }
    }

    document.documentElement.lang = CONFIG.localeMap[lang] || lang;
  },

  getTranslation(key, params = {}) {
    const lang = this.getLang();
    let text = i18nTranslations[lang]?.[key] || "";
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(`{${pKey}}`, pVal);
    }
    return text;
  },

  getCityName(city) {
    if (!city) return "";
    if (city.id.startsWith("custom-")) {
      return city.name;
    }
    const lang = this.getLang();
    if (city.id === "local") {
      if (city.matchingId) {
        return i18nCityNames[lang]?.[city.matchingId] || city.matchingId;
      }
      const parts = city.zone.split("/");
      return parts[parts.length - 1].replace(/_/g, " ");
    }
    return i18nCityNames[lang]?.[city.id] || city.id;
  }
};

export const PeriodUtils = {
  /** Active theme, following theme.js; falls back to light. */
  currentTheme() {
    try {
      if (globalThis.TimeMapperTheme) {
        return globalThis.TimeMapperTheme.resolve(localStorage.getItem("theme") || "auto");
      }
    } catch { }
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  },
  /** Fixed palette entry for a period index under the active theme. */
  getPeriodColors(idx) {
    const count = (typeof State !== "undefined" && State.timePeriods && State.timePeriods.length) || 3;
    const byCount = CONFIG.periodColorsByCount[count] || CONFIG.periodColorsByCount[3];
    const set = byCount[this.currentTheme()] || byCount.light;
    return set[idx] || set[set.length - 1];
  },
  getHourStyle(hour) {
    const timePeriods = (typeof State !== "undefined" && State.timePeriods) || CONFIG.defaultTimePeriods;
    let idx = timePeriods.findIndex((p) => {
      if (p.start <= p.end) {
        return hour >= p.start && hour <= p.end;
      } else {
        return hour >= p.start || hour <= p.end;
      }
    });
    if (idx < 0) idx = timePeriods.length - 1;
    const period = timePeriods[idx];
    return { ...period, ...this.getPeriodColors(idx) };
  }
};

/** lng/lat -> base-map percentage, memoised per city object. */
const basePositionCache = new WeakMap();

export const MapUtils = {
  /**
   * Longitude of the subsolar point (where the sun is directly overhead)
   * for the given instant, in degrees.
   */
  subsolarLng(date) {
    return -(date.getUTCHours() + date.getUTCMinutes() / 60 - 12) * 15;
  },

  lngToX(lng) {
    return PROJECTION.lngX * lng + PROJECTION.lngXOffset;
  },

  xToLng(x) {
    return (x - PROJECTION.lngXOffset) / PROJECTION.lngX;
  },

  latToY(lat) {
    return PROJECTION.latY * lat + PROJECTION.latYOffset;
  },

  yToLat(y) {
    return (y - PROJECTION.latYOffset) / PROJECTION.latY;
  },

  lngLatOf(city) {
    if (typeof city.lng === "number" && typeof city.lat === "number") {
      return { lng: city.lng, lat: city.lat };
    }
    return { lng: this.xToLng(city.x), lat: this.yToLat(city.y) };
  },

  /**
   * Apply the user's calibration (scale + offset) to a base-map percentage.
   * `uncalibrate*` are the exact inverses, so a screen percentage can be
   * mapped back to the uncalibrated base map.
   */
  calibrateX(x) {
    const settings = (typeof State !== "undefined" && State.mapSettings) || CONFIG.defaultMapSettings;
    return 50 + (x - 50) * settings.widthScale + settings.lngOffset;
  },

  calibrateY(y) {
    const settings = (typeof State !== "undefined" && State.mapSettings) || CONFIG.defaultMapSettings;
    return 50 + (y - 50) * settings.heightScale - settings.latOffset;
  },

  uncalibrateX(screenX) {
    const settings = (typeof State !== "undefined" && State.mapSettings) || CONFIG.defaultMapSettings;
    return 50 + (screenX - 50 - settings.lngOffset) / settings.widthScale;
  },

  uncalibrateY(screenY) {
    const settings = (typeof State !== "undefined" && State.mapSettings) || CONFIG.defaultMapSettings;
    return 50 + (screenY - 50 + settings.latOffset) / settings.heightScale;
  },

  mapPosition(city) {
    // Base-map position depends only on lng/lat, so it is memoised per city
    // object. A WeakMap keeps the cache off the city data itself: an edited
    // custom city is a new object, so its old entry is collected with it.
    let base = basePositionCache.get(city);
    if (!base) {
      const hasLngLat = typeof city.lng === "number" && typeof city.lat === "number";
      base = {
        x: hasLngLat ? this.lngToX(city.lng) : city.x,
        y: hasLngLat ? this.latToY(city.lat) : city.y
      };
      basePositionCache.set(city, base);
    }
    return {
      x: MathUtils.clamp(this.calibrateX(base.x), 0, 100),
      y: MathUtils.clamp(this.calibrateY(base.y), 0, 100)
    };
  },

  /** Unclamped screen-x percentage for a longitude. */
  getLongitudeX(lng) {
    return this.calibrateX(this.lngToX(lng));
  },

  getXLongitude(screenX) {
    return this.xToLng(this.uncalibrateX(screenX));
  }
};

export const TimelineUtils = {
  getNowFraction() {
    const now = new Date();
    let hours, minutes;

    if (typeof State !== "undefined" && State.nowLineMode === "firstCity" && State.selectedIds.length > 0) {
      const firstCity = State.findCity(State.selectedIds[0]);
      if (firstCity) {
        const zone = TimeUtils.resolveZone(firstCity.zone);
        const formatter = TimeUtils.getFormatter("en-US", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        });
        const parts = formatter.formatToParts(now);
        hours = Number(parts.find((p) => p.type === "hour").value);
        minutes = Number(parts.find((p) => p.type === "minute").value);
      } else {
        hours = now.getHours();
        minutes = now.getMinutes();
      }
    } else {
      // Default: browser local time
      hours = now.getHours();
      minutes = now.getMinutes();
    }

    return (hours + minutes / 60) / 24;
  },

  formatFractionTime(fraction) {
    if (typeof fraction !== "number" || isNaN(fraction)) return "--:--";
    let totalMinutes = Math.round(fraction * 24 * 60);
    totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  },

  snapToFiveMinutes(fraction) {
    if (typeof fraction !== "number" || isNaN(fraction)) return 0;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const snappedMinutes = Math.round(totalMinutes / 5) * 5;
    return MathUtils.clamp(snappedMinutes / (24 * 60), 0, 1);
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.MathUtils = MathUtils;
  globalThis.EscapeUtils = EscapeUtils;
  globalThis.TimeUtils = TimeUtils;
  globalThis.I18nUtils = I18nUtils;
  globalThis.PeriodUtils = PeriodUtils;
  globalThis.MapUtils = MapUtils;
  globalThis.TimelineUtils = TimelineUtils;
}
