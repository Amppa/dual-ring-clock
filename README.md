# DualRing Clock

<p align="center">
  <strong>Concentric dual-ring analog clock, 24-hour multi-city timeline, and interactive solar daylight map.</strong><br>
  以同心雙環時鐘為核心，融合跨時區 24 小時時間軸與實時晝夜地圖的高效時間對照工具。
</p>

<p align="center">
  <a href="#english">English</a> •
  <a href="#繁體中文">繁體中文</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#privacy">Privacy</a>
</p>

---

<div id="english"></div>

## English

DualRing Clock is an elegant, privacy-first cross-timezone alignment tool designed for remote teams, global travelers, and international collaboration. It brings together a unique concentric dual-ring clock face, a 24-hour parallel timeline, and a real-time solar daylight map to make timezone comparison effortless and intuitive.

---

### Features

#### 🕒 Concentric Dual-Ring Analog Clock
- **Simultaneous Two-City Dial**: The outer ring tracks local (or primary) time, while the inner ring represents your secondary target city on the same coaxial dial.
- **Multi-Scrub Lines**: Click anywhere on the clock face to place up to 4 interactive scrub lines. Each scrub line simultaneously displays dual-ring time badges on both cities.
- **Continuous Interval Arcs**: Automatically calculates and renders smooth arc segments between scrub lines with centered duration pills (e.g. `2.5h`), visualizing time spans at a glance.
- **Ultra-Smooth 120fps Drag**: Optimized with `requestAnimationFrame`, cached dial center coordinates, and step quantization guards for fluid interaction on mobile and desktop.

#### 📊 24-Hour Timeline & Period Mapper
- **Parallel Multi-City Tracks**: View up to 10 cities side-by-side on 24-hour horizontal strips.
- **Synchronized Now-Line**: A crisp vertical indicator marks the current moment across all timezones.
- **Dual Period Segmentation Modes**:
  - **Day & Night Mode (2-period)**: Clean 06:00 / 18:00 thresholds.
  - **Daily Routine Mode (4-period)**: Granular 07:00 / 08:00 / 18:00 / 00:00 division.
  - Interactive drag-to-adjust dividers with mode-activation guard to prevent accidental misclicks.
- **Live Reorderable City Cards**: Drag handles (`⋮⋮`) with fluid displacement animations that slide sibling cards out of the way in real time.

#### 🗺️ Interactive Daylight World Map
- **Solar Terminator Projection**: Real-time astronomical calculation of the Earth's day/night shadow overlay.
- **Timezone Hour Lines & City Pins**: Tap any city pin to toggle it on your timeline, or tap open space on the map to add an arbitrary UTC offset (`UTC+8`).
- **Texture Calibration**: Precise numeric controls to calibrate map longitude, latitude, scale, and vertical offset.

---

### Quick Start

#### Web Preview (Zero-Build ES Modules)
The web application requires no compilation or bundler:
```bash
# Clone the repository
git clone https://github.com/Amppa/dual-ring-clock.git
cd dual-ring-clock

# Start local preview server
npm run dev
```
Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser. Use DevTools mobile emulation (`Ctrl+Shift+M` or `Cmd+Shift+M`) for the full touch experience.

#### Android Application
DualRing Clock is built as a standalone Android app powered by Capacitor:
```bash
# 1. Build and stage web assets
npm run android:web

# 2. Sync with Android project
npm run android:sync

# 3. Build & Deploy directly to a connected device via ADB
npm run android:deploy
```
*(Requires Android SDK / ADB and Java 17+ installed).*

---

### Settings & City Search

Tap the **Settings** tab in the bottom navigation bar to manage:
- **City Management**: Reorder, rename, switch timezones, or remove cities.
- **City Search**: Search any global city via the [Open-Meteo Geocoding API](https://geocoding-api.open-meteo.com/). Coordinates are mapped directly onto the world map for future use.
- **Appearance & Language**: Switch between System / Light / Dark themes, and English, Traditional Chinese (`zh-Hant`), or Spanish (`es`).

---

### Privacy First

DualRing Clock is committed to zero data collection:
- **100% Local**: All city choices, calibration, and customized period boundaries are stored strictly in client-side `localStorage`.
- **No Trackers**: No third-party analytics, cookies, advertising SDKs, or background telemetry.
- Full details available in our [Privacy Policy (PRIVACY.md)](PRIVACY.md).

---

<div id="繁體中文"></div>

## 繁體中文

DualRing Clock 是一款專為跨國團隊協作、遠端工作與國際差旅量身打造的高效時間對齊工具。透過獨創的「同心雙環時鐘」、24 小時跨時區時間軸以及動態晝夜投影地圖，讓跨時區時間換算不再繁瑣，一目了然。

---

### 核心功能特色

#### 🕒 同心雙環指針時鐘（Concentric Dual-Ring Clock）
- **雙城同軸盤面**：同一個圓形錶盤上整合內外雙環——外環顯示本地（或主選城市）時間，內環即時對照目標城市時間，指針一體聯動。
- **多時段標記手柄（Multi-Scrub）**：點擊錶盤任意處可建立最多 4 條對齊手柄，雙環即時同步顯示兩地的具體時間 Badge。
- **連續時間弧線（Interval Arcs）**：相鄰標記線之間自動計算時間差，並繪製平滑圓弧與置中時長膠囊（如 `2.5h`），時差跨度一目了然。
- **120fps 超順暢拖曳**：採用 `requestAnimationFrame` 節流、錶盤中心點快取與步進量化守衛，手機觸控滑動極致絲滑。

#### 📊 24 小時跨時區時間軸（24-Hour Timeline & Period Mapper）
- **多城市並排檢視**：在 24 小時水平橫條上最多同時並排 10 座城市。
- **全域同步現在線**：一條清晰俐落的垂直標記線貫穿所有城市，標記出全球的當下時刻。
- **雙時段劃分模式**：
  - **日夜模式（2段）**：06:00 / 18:00 簡潔切換。
  - **作息模式（4段）**：細分為 07:00 / 08:00 / 18:00 / 00:00 晨、晝、暮、夜。
  - 具備「模式啟用防誤觸機制」，未啟用的模式點擊只會切換，絕不意外拖動分界線。
- **即時擠開位移動畫**：按住城市卡片左側手柄（`⋮⋮`）拖曳，相鄰卡片在滑過中線時即時平滑讓位，放手自動吸附。

#### 🗺️ 即時晝夜投影地圖（Interactive Daylight World Map）
- **太陽終結線投影**：透過真實天文演算法實時計算地球上的晝夜陰影分界。
- **時區小時線與城市圖釘**：點擊地圖圖釘可快速增減城市列，點擊空白處可依當地 UTC 偏移量新增自訂列（如 `UTC+8`）。
- **地圖貼圖校準**：支援對經緯度偏移、縮放比例與垂直位置進行微調校準。

---

### 快速開始

#### Web 瀏覽器預覽（免編譯原生 ES 模組）
本專案採用純原生 ES Module 架構，無需任何 Webpack/Vite 複雜打包：
```bash
# 複製儲存庫
git clone https://github.com/Amppa/dual-ring-clock.git
cd dual-ring-clock

# 啟動本地開發預覽伺服器
npm run dev
```
在瀏覽器開啟 [http://127.0.0.1:4173](http://127.0.0.1:4173)。按 `F12` 切換為手機模擬模式即可體驗完整的觸控拖曳手感。

#### Android 應用程式
基於 Capacitor 建構為獨立 Android App：
```bash
# 1. 輸出 Web 資產
npm run android:web

# 2. 同步至 Android 原生專案
npm run android:sync

# 3. 透過 ADB 一鍵編譯並安裝至手機
npm run android:deploy
```
*(需已安裝 Android SDK / ADB 及 Java 17+ 環境)*。

---

### 設定與城市管理

點擊底部導覽列的**「設定」**：
- **城市清單管理**：拖曳排序、修改城市名稱、切換時區或移除城市。
- **全球城市搜尋**：透過 [Open-Meteo 地理編碼 API](https://geocoding-api.open-meteo.com/) 搜尋全世界任何城市，自動解析經緯度與時區並投射至地圖。
- **佈景主題與語言**：支援系統自動／淺色／深色模式切換，以及繁體中文（`zh-Hant`）、English、Español（`es`）。

---

### 隱私承諾

DualRing Clock 堅守純本機執行與零資料收集承諾：
- **100% 本機儲存**：所有城市清單、自訂時段、外觀設定皆完全留存在本機 `localStorage`。
- **零追蹤器**：無任何第三方分析工具、追蹤碼、廣告 SDK 或背景遙測數據傳輸。
- 完整聲明請參閱 [隱私權政策 (PRIVACY.md)](PRIVACY.md)。

---

## 贊助支持 / Sponsor

如果你覺得 DualRing Clock 對你有幫助，歡迎贊助支持開發：

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/Amppa)
