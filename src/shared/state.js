/**
 * DualRing Clock - Application State Management Module
 */

import { CONFIG } from "./config.js";
import { cityCatalog } from "./cities.js";
import { Storage } from "./storage.js";
import { TimeUtils, TimelineUtils, I18nUtils } from "./utils.js";

/** Map placement percentages: non-numeric falls back to 50, values clamp to 0-100. */
function clampMapPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

/**
 * Whitelist normalization for custom cities (schema: id, name, zone, x, y, lng, lat).
 * Returns null for entries that cannot be repaired.
 */
function sanitizeCustomCity(city) {
  if (!city || typeof city !== "object") return null;
  if (typeof city.id !== "string" || !city.id) return null;
  if (typeof city.name !== "string" || !city.name.trim()) return null;
  if (typeof city.zone !== "string" || !city.zone) return null;
  const x = clampMapPercent(city.x);
  const y = clampMapPercent(city.y);
  const lng = Number(city.lng);
  const lat = Number(city.lat);
  return {
    id: city.id,
    name: city.name.trim().slice(0, 50),
    zone: city.zone,
    x,
    y,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : undefined,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : undefined
  };
}

export const State = {
  selectedIds: [],
  customCities: [],
  mapSettings: {},
  periodMode: "dayNight",
  dayNightPeriods: [],
  routinePeriods: [],
  get timePeriods() {
    return this.periodMode === "dayNight" ? this.dayNightPeriods : this.routinePeriods;
  },
  set timePeriods(val) {
    if (this.periodMode === "dayNight") {
      this.dayNightPeriods = val;
    } else {
      this.routinePeriods = val;
    }
  },
  /** "auto" | "zh" | "en" | "es" */
  _languagePreference: "auto",
  baseHours: [],
  scrubs: [],             // array of { id, fraction } objects
  activeScrubId: null,    // id of the active scrub line
  cityLimit: 10,
  _localCity: null,
  _cachedCityList: null,
  _cachedCityIndex: null,
  _cachedCustomCities: null,

  /**
   * Derived from the active scrub line; never assigned directly.
   * Hours to shift "now" by so that it lines up with the active scrub.
   */
  get selectedOffsetHours() {
    const activeFraction = this.getActiveScrubFraction();
    if (activeFraction === null) return 0;
    return (activeFraction - TimelineUtils.getNowFraction()) * 24;
  },

  async init() {
    this._localCity = null;
    this._cachedCityList = null;
    this._cachedCityIndex = null;
    this._cachedCustomCities = null;

    this._languagePreference = Storage.get(CONFIG.languagePreferenceKey, "auto");
    I18nUtils.setLang(this.resolveLanguage());
    this.periodMode = Storage.get(CONFIG.periodModeKey, CONFIG.defaultPeriodMode) || "dayNight";
    this.dayNightPeriods = this.resolveDayNightPeriods(Storage.get(CONFIG.dayNightPeriodsKey));
    this.routinePeriods = this.resolveTimePeriods(Storage.get(CONFIG.timePeriodsKey));
    this.mapSettings = this.loadMapSettings();
    this.customCities = this.resolveCustomCities(Storage.get(CONFIG.customCitiesKey));
    this.cityLimit = CONFIG.maxCities;
    this.selectedIds = this.resolveSelection(Storage.get(CONFIG.storageKey));
    this.scrubs = [];
    this.activeScrubId = null;
    this.makeBaseHours();
  },

  resolveLanguage() {
    const pref = this._languagePreference;
    if (pref && pref !== "auto" && CONFIG.supportedLanguages.includes(pref)) return pref;
    return this.detectNavigatorLanguage();
  },

  detectNavigatorLanguage() {
    const navLang = (navigator.language || navigator.userLanguage || "zh").toLowerCase();
    if (navLang.startsWith("en")) return "en";
    if (navLang.startsWith("es")) return "es";
    return "zh";
  },

  getLanguagePreference() {
    return this._languagePreference || "auto";
  },

  saveLanguage(lang) {
    if (lang !== "auto" && !CONFIG.supportedLanguages.includes(lang)) return;
    this._languagePreference = lang;
    Storage.set(CONFIG.languagePreferenceKey, lang);
    if (lang === "auto") {
      I18nUtils.setLang(this.detectNavigatorLanguage());
      return;
    }
    I18nUtils.setLang(lang);
  },

  resolveDayNightPeriods(saved) {
    const fallback = () => JSON.parse(JSON.stringify(CONFIG.defaultDayNightPeriods));
    if (Array.isArray(saved) && saved.length === 2 &&
      saved.every((p) => p && Number.isFinite(Number(p.start)) && Number.isFinite(Number(p.end)))) {
      return saved.map((p, i) => ({
        name: p.name || CONFIG.defaultDayNightPeriods[i]?.name || `period${i + 1}`,
        start: Number(p.start),
        end: Number(p.end)
      }));
    }
    return fallback();
  },

  resolveTimePeriods(saved) {
    const fallback = () => JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
    if (Array.isArray(saved) && saved.length === 4 &&
      saved.every((p) => p && Number.isFinite(Number(p.start)) && Number.isFinite(Number(p.end)))) {
      return saved.map((p, i) => ({
        name: p.name || CONFIG.defaultTimePeriods[i]?.name || `period${i + 1}`,
        start: Number(p.start),
        end: Number(p.end)
      }));
    }
    return fallback();
  },

  saveTimePeriods() {
    Storage.set(CONFIG.periodModeKey, this.periodMode);
    Storage.set(CONFIG.dayNightPeriodsKey, this.dayNightPeriods);
    Storage.set(CONFIG.timePeriodsKey, this.routinePeriods);
  },

  loadMapSettings() {
    return { ...CONFIG.defaultMapSettings };
  },

  resolveCustomCities(saved) {
    if (Array.isArray(saved)) {
      return saved.map(sanitizeCustomCity).filter((c) => c !== null);
    }
    return [];
  },

  saveCustomCities() {
    Storage.set(CONFIG.customCitiesKey, this.customCities);
  },

  resolveSelection(saved) {
    const limit = this.cityLimit || CONFIG.maxCities;
    if (Array.isArray(saved)) {
      return [...new Set(saved)].filter((id) => this.findCity(id)).slice(0, limit);
    }
    return [...CONFIG.defaultSelection].slice(0, limit);
  },

  saveSelection() {
    Storage.set(CONFIG.storageKey, this.selectedIds);
  },

  getActiveScrubFraction() {
    if (!this.activeScrubId || !this.scrubs || this.scrubs.length === 0) return null;
    const active = this.scrubs.find(s => s.id === this.activeScrubId);
    return active ? active.fraction : null;
  },

  allCities() {
    if (!this._localCity) {
      const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const matchingCity = cityCatalog.find((c) => c.zone === localZone);
      let lng = 114.15; // default fallback Hong Kong longitude
      let lat = 22.3;   // default fallback Hong Kong latitude

      if (matchingCity) {
        lng = matchingCity.lng;
        lat = matchingCity.lat;
      } else {
        try {
          const now = new Date();
          const offsetMins = TimeUtils.getOffsetMinutes(now, localZone);
          lng = offsetMins * 0.25;
          lat = 20.0;
        } catch {
          lng = 114.15;
          lat = 22.3;
        }
      }

      this._localCity = {
        id: "local",
        zone: localZone,
        lng: lng,
        lat: lat,
        matchingId: matchingCity ? matchingCity.id : null
      };
    }

    if (!this._cachedCityList || this._cachedCustomCities !== this.customCities) {
      this._cachedCityList = [this._localCity, ...cityCatalog, ...this.customCities];
      this._cachedCityIndex = new Map(this._cachedCityList.map((c) => [c.id, c]));
      this._cachedCustomCities = this.customCities;
    }
    return this._cachedCityList;
  },

  findCity(id) {
    if (!this._cachedCityIndex || this._cachedCustomCities !== this.customCities) {
      this.allCities();
    }
    return this._cachedCityIndex.get(id);
  },

  makeBaseHours() {
    const now = new Date();
    const firstCity = this.selectedIds.length > 0 ? this.findCity(this.selectedIds[0]) : null;

    if (firstCity && firstCity.zone) {
      const zone = TimeUtils.resolveZone(firstCity.zone);
      const formatter = TimeUtils.getFormatter("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const dateStr = formatter.format(now);
      const [year, month, day] = dateStr.split("-").map(Number);
      const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
      const offsetMins = TimeUtils.getOffsetMinutes(noonUTC, zone);
      const midnightUTC = Date.UTC(year, month - 1, day, 0) - offsetMins * 60000;
      this.baseHours = [new Date(midnightUTC)];
    } else {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      this.baseHours = [start];
    }
  },

  toggleCity(id) {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((item) => item !== id);
      if (id.startsWith("custom-") || this.customCities.some((city) => city.id === id)) {
        this.customCities = this.customCities.filter((city) => city.id !== id);
        this.saveCustomCities();
      }
    } else {
      if (this.selectedIds.length >= this.cityLimit) {
        return false;
      }
      this.selectedIds = [...this.selectedIds, id];
    }
    this.saveSelection();
    return true;
  }
};
