/**
 * DualRing Clock - Map Projection Constants
 *
 * Linear conversion from geographic coordinates to base map percentages (0-100):
 *   x = lngX * longitude + lngXOffset
 *   y = latY * latitude  + latYOffset
 */
export const PROJECTION = {
  lngX: 0.2816,
  lngXOffset: 46.2357,
  latY: -0.5257,
  latYOffset: 63.3239
};

/**
 * DualRing Clock - Configuration Module
 */
export const CONFIG = {
  defaultSelection: ["local", "tokyo", "new-york", "los-angeles"],
  maxCities: 10,
  maxScrubs: 4,
  storageKey: "worldTimeAlignerCities",
  customCitiesKey: "worldTimeAlignerCustomCities",
  timePeriodsKey: "worldTimeAlignerTimePeriods",
  periodModeKey: "worldTimeAlignerPeriodMode",
  dayNightPeriodsKey: "worldTimeAlignerDayNightPeriods",
  languagePreferenceKey: "worldTimeAlignerLanguagePref",
  /** Internal UI language codes offered in the settings. */
  supportedLanguages: ["zh", "en", "es"],
  /** Maps an internal UI language code to the BCP-47 locale used for date/time formatting. */
  localeMap: { zh: "zh-TW", en: "en-US", es: "es-ES" },
  defaultMapSettings: {
    lngOffset: 1.0,
    latOffset: 20.7,
    widthScale: 1.0,
    heightScale: 1.39,
    mapYOffset: 30,
    showNightArea: true,
    showHourLines: false,
    showCityTimes: true
  },
  defaultPeriodMode: "dayNight",
  defaultDayNightPeriods: [
    { name: "day", start: 6, end: 17 },
    { name: "night", start: 18, end: 5 }
  ],
  defaultTimePeriods: [
    { name: "morning", start: 7, end: 7 },
    { name: "day", start: 8, end: 17 },
    { name: "evening", start: 18, end: 23 },
    { name: "night", start: 0, end: 6 }
  ],
  periodColorsByCount: {
    2: {
      light: [
        { color: "#FFE7A3", fontColor: "#000000" },
        { color: "#856C60", fontColor: "#FFFFFF" }
      ],
      dark: [
        { color: "#EEB422", fontColor: "#000000" },
        { color: "#38302E", fontColor: "#FFFFFF" }
      ]
    },
    4: {
      light: [
        { color: "#F9BE6C", fontColor: "#000000" },
        { color: "#FFE7A3", fontColor: "#000000" },
        { color: "#F9BE6C", fontColor: "#000000" },
        { color: "#856C60", fontColor: "#FFFFFF" }
      ],
      dark: [
        { color: "#B8860B", fontColor: "#000000" },
        { color: "#EEB422", fontColor: "#000000" },
        { color: "#B8860B", fontColor: "#000000" },
        { color: "#38302E", fontColor: "#FFFFFF" }
      ]
    }
  }
};
