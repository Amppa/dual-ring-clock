# TimeMapper

**English** | [繁體中文](README.zh-TW.md) | [Español](README.es.md)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-TimeMapper-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/Amppa)

A Chrome extension popup for comparing time across timezones. Click cities on a world map and line up their days on a 24-hour timeline, so you can find a moment that works for everyone.

---

## Install

### Chrome Web Store (Recommended)

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb).

### Manual (Developer mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the root folder of this repository.
5. Click the TimeMapper icon in the Chrome toolbar.

---

## How to use

**Choose cities** — click any pin on the world map to add that city to the timeline; click it again to remove it. Clicking an empty spot on the map adds that UTC offset (e.g. `UTC+8`) as a new row. The first time you open the popup, Tokyo, New York, Los Angeles and your browser's local time are already selected. Up to 10 cities are shown at once.

**Read the timeline** — each row is one city's 24-hour day, and the vertical **now line** marks this exact moment. The `00` cell also shows the date, so you can see where a city's day rolls over.

**Compare a specific moment** — click anywhere on the timeline to drop an alignment line (up to four). Drag a line to move it, or click its `[x]` to remove it. Every row updates to show what time that moment is in that city. The gap between two neighbouring markers — including the now line — is labelled with its length (`1.5h`).

**Use the map** — the map can shade the current night area, draw the hour lines for each timezone, and show a live time bubble above every selected city. The map panel collapses if you only want the timeline.

---

## Settings

Click the ⚙ button in the top bar to open the settings page. The language and theme pickers sit in the page header, and a live preview of the map and timeline stays pinned beside the settings as you edit.

| Section | What you can do |
| --- | --- |
| **Cities** | Review every city currently on your timeline: rename it, switch its timezone, fine-tune its map coordinates, drag the handle to reorder, or remove it with `×`. Search by name to add a city that is not on the map, load the example set, or clear everything. Up to 10 cities. |
| **Minimap** | Toggle the night area, hour lines and city time bubbles. |
| **Map Texture** | Fine-tune the map's longitude/latitude offsets, width/height scale and vertical offset, then restore the defaults. |
| **Time Periods** | Pick 2, 3 or 4 highlighted periods, then drag the handles on the 24-hour grid to set their hour ranges, or restore the defaults. Also choose what the now line is measured against (your browser's local time, or the first city). |

Each period count ships with its own colour scheme for light and dark, so the bands stay readable when you switch theme. Core settings (cities, custom cities, periods, language, now-line reference) sync across devices via `chrome.storage.sync`, while appearance theme and map calibration remain in local `localStorage`.

---

## A city that is not on the map

Search for it in the **Cities** section of the settings page. Results come from the [Open-Meteo geocoding API](https://geocoding-api.open-meteo.com/), so searching needs a network connection. The city you pick is placed on the map from its own coordinates and remembered for next time.

To add a city permanently to the built-in list, edit `cityCatalog` in `src/shared/cities.js`. The constants that turn longitude/latitude into a map position are documented in the `PROJECTION` block at the top of `src/shared/config.js`.

---

## Support / Sponsor

If you find TimeMapper helpful, consider supporting its development:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/Amppa)

---

## Privacy

TimeMapper does not collect or transmit any personal data. Read our full [Privacy Policy](PRIVACY.md).

---

## Checking translations

`node tools/check-i18n.mjs` verifies that the dictionaries in `src/shared/i18n.js` still cover every string the pages ask for. Run it after adding a UI string, a language, or a city.
