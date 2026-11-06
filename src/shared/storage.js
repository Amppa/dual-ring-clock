/**
 * DualRing Clock - Storage Module
 *
 * Lightweight, direct localStorage wrapper for Android / WebView.
 */

export const Storage = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
    } catch (err) {
      console.warn("[DualRing Clock] localStorage write failed for", key, err);
    }
  }
};
