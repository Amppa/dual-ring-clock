# 時鐘頁設計：24 小時錶盤與城市時間牆

- 日期：2026-10-31
- 分支：`feat/clock-view`
- 狀態：已核准並實作；走針方式於 2026-10-31 調整為分針連續掃動

## 1. 背景與目標

三分頁底部導覽中的「時鐘」頁目前是空佔位（`src/app/index.html` 的 `#clockView`）。本設計填入兩個區塊：

1. **24 小時實體錶盤**：以裝置系統本地時間為準，具時針、分針與 24 小時標尺（頂端顯示 24）。
2. **已選城市時間牆**：依 `State.selectedIds` 列出城市名稱、日期，以及該城市當地 24 小時時間（大字）。

錶盤永遠代表裝置本地時間，不隨城市列變動；城市列為唯讀資訊。

## 2. 非目標（Non-goals）

- 不顯示秒針、不畫分鐘小刻度。
- 城市列不可點擊，也不提供「點城市把錶盤切到該時區」。
- 不顯示 GMT 偏移或 DST 徽章（時間軸頁已有）。
- 不新增設定項，不改 `State` / `Storage` schema，不改 `utils.js`。
- 不引入建置工具或自動化測試框架。

## 3. 決策摘要

| 項目 | 決定 |
|---|---|
| 錶盤方向 | 0 在正上方，順時針遞增 0→23 |
| 數字 | 頂端顯示 24，其餘 1–23 |
| 刻度 | 24 個小時刻度，無分鐘刻度 |
| 指針 | 時針＋分針，無秒針 |
| 走針 | 時針每分鐘微動 0.25°；分針每秒依秒數連續掃動 |
| 城市列內容 | 城市名＋日期（跨日標 `+1` / `−1`）＋大字 `HH:MM` |
| 時間格式 | `hourCycle: "h23"`（`00:00`–`23:59`，避免 `24:00`） |
| 空清單 | 顯示提示文字 |
| 錶盤時間來源 | 裝置系統本地時間 |
| 城市列互動 | 唯讀 |

## 4. 檔案與模組

| 檔案 | 變動 |
|---|---|
| `src/app/clock.js` | 新增 `ClockView` |
| `src/app/clock.css` | 新增時鐘頁樣式 |
| `src/app/index.html` | 填入 `#clockView` 骨架、引入 `clock.css` |
| `src/app/app.js` | import、初始化、切頁渲染、每分鐘 tick、`pageshow` 補渲染 |
| `src/shared/i18n.js` | 新增 4 個 key × 3 語言 |

不動 `src/shared/state.js`、`src/shared/utils.js`、`src/shared/config.js`。

### 模組介面

```js
export const ClockView = {
  init(),   // 快取 DOM、生成刻度與數字、首次 render
  render(), // 讀取 State 與 new Date()，更新指針、城市列、aria-label
};
```

`app.js` 的每分鐘 ticker 在 `currentView === "clock"` 時呼叫 `ClockView.render()`；另有一個每秒 ticker 呼叫 `ClockView.tick()`，讓分針連續掃動、時針角度維持每分鐘微動。不建立額外事件匯流排；語言／城市變更都發生在設定頁，切回時鐘頁時的 `render()` 自然拿到最新資料。

## 5. 錶盤規格

`#clockView` 骨架：

```html
<section class="clock-page">
  <div class="clock-face-wrap">
    <svg id="clockDial" class="clock-dial" viewBox="-30 -30 260 260" role="img" aria-label="">
      <circle class="clock-bezel" cx="100" cy="100" r="126"></circle>
      <g id="clockRing" class="clock-ring" aria-hidden="true"></g>
      <g id="clockTicks" aria-hidden="true"></g>
      <g id="clockBadges" aria-hidden="true"></g>
      <g id="clockNumerals" class="clock-numerals" aria-hidden="true"></g>
      <text id="clockInnerCityLabel" class="clock-ring-city-label" x="71.717" y="71.717" dy="0.35em" text-anchor="middle"></text>
      <text id="clockOuterCityLabel" class="clock-ring-city-label clock-ring-city-label--outer" x="-6.066" y="-6.066" dy="0.35em" text-anchor="middle"></text>
      <line id="clockHourHand" class="clock-hand clock-hand--hour" x1="100" y1="100" x2="100" y2="52"></line>
      <line id="clockMinuteHand" class="clock-hand clock-hand--minute" x1="100" y1="100" x2="100" y2="34"></line>
      <circle class="clock-pivot" cx="100" cy="100" r="4.5"></circle>
    </svg>
  </div>
  <section class="clock-cities" aria-labelledby="clockCitiesTitle">
    <h2 id="clockCitiesTitle" class="clock-section-title" data-i18n="clockSelectedCities">已選取的城市</h2>
    <ul id="clockCityList" class="clock-city-list"></ul>
  </section>
</section>
```

幾何常數（viewBox `-30 -30 260 260`、內容仍以 `100,100` 為圓心，四周多留 30 單位給外圈）：

| 元素 | 參數 |
|---|---|
| 錶圈 | `r=96`，填 `--bg-card`，描邊 `--divider` 1px |
| 內圈時段環 | 圓環 `r=80`、寬 20（涵蓋 70–90，等於先前單圈），代表 `State.selectedIds[0]`，固定不旋轉：6.5–17.5 白天色、18.5–5.5 傍晚色（跨午夜）；17.5–18.5 與 5.5–6.5 各以 16 段 `color-mix()` 做白天↔傍晚漸層。色盤沿用時間軸：淺色 `#FFE7A3` / `#856C60`，深色 `#EEB422` / `#38302E` |
| 外圈時段環 | 圓環 `r=104`、寬 20（涵蓋 94–114，與內圈等寬），代表 `State.selectedIds[1]`；整圈（色段、刻度、底盤、數字）依 `-(offset2 − offset1)/60` 小時旋轉，讓同一指針角度可讀第二城市時間。少於兩個城市時不畫 |
| 小時刻度 | 每圈 24 個，各自從 `半徑 ± 寬/2` 貫穿色環；一律線寬 1；顏色 `--clock-tick`（淺色白、深色黑）。刻度先畫，數字圓盤再蓋住中段，形成被白／黑線切開的環 |
| 數字底盤 | 每圈 24 個，`r=6.5`，圓心落在各圈半徑上，填 `--clock-badge-bg`（淺色白、深色黑），不超出該圈內緣 |
| 小時數字 | 各圈半徑處，`font-size=8.5`，`text-anchor=middle`，以 `dy=0.35em` 對齊數字墨跡視覺中心；內圈頂端顯示 `24`；外圈數字隨環旋轉位置但文字保持直立；填 `--clock-badge-ink`（淺色深字、深色白字）、字重一致 |
| 城市名標籤 | 固定在 21 點方向（315°）：內圈內部 `r=40` 顯示第一城市名；錶圈外側 `r=150` 顯示第二城市名。兩者 `font-size=20`、不壓縮，填 `--text-primary`、`opacity=0.5`；由 `_renderCityLabels()` 隨城市與語言更新 |
| 時針 | `(100,100) → (100,52)`（長 48），`--text-primary`，線寬 5，圓端點 |
| 分針 | `(100,100) → (100,34)`（長 66），`--accent-solid`，線寬 3，圓端點 |
| 中心點 | `r=4.5`，填 `--accent-solid` |

內圈 70–90、外圈 94–114，皆寬 20；內外圈間隔 4，外圈到錶圈 `r=126` 間隔 12。整體 viewBox 與 CSS 寬度一起放大，讓內圈維持先前單圈的視覺大小；指針顯示第一城市時間，內圈刻度因此是參考盤。內圈缺省（沒有已選城市）時退回裝置本地城市；第二城市不存在時只畫內圈。

城市名標籤固定放在 21 點方向：第一城市名在內圈內部（`r=40`），第二城市名在**錶圈外側**（`r=150`，距外圈 36 單位、距錶圈 24 單位）。`r=150` 落在 SVG 方形盒的左上角落、已在圓形錶圈之外；SVG 設 `overflow: visible`，標籤若略超出盒邊會畫進頁面留白，時鐘本體不縮小。外圈標籤不壓縮，長名稱會向頁面左側延伸。

刻度與數字由 `buildRingPaths()` / `buildRingScale()` 依半徑、寬度與偏移生成；只有 zone／offset 簽章改變時重建。

```js
// 角度以正上方為 0、順時針為正；offsetHours 為該環的世界時旋轉
const angle = ((hour + offsetHours) * 15) * Math.PI / 180;
const x = 100 + radius * Math.sin(angle);
const y = 100 - radius * Math.cos(angle);
```

時針與分針都以第一城市的當地時間計算；時針每分鐘更新，分針每秒更新：

```js
const { hours: h, minutes: m, seconds: s } = timePartsInZone(now, city1.zone);
const hourAngle = ((h % 24) + m / 60) * 15;
const minuteAngle = (m + s / 60) * 6;
hourHand.setAttribute("transform", `rotate(${hourAngle} 100 100)`);
minuteHand.setAttribute("transform", `rotate(${minuteAngle} 100 100)`);
```

- 不加 CSS transition：分針每秒依秒數重算角度，視覺上連續掃動；時針每分鐘微動。若加 transition，整圈回繞時會反向補間，因此維持直接設定 `transform`。
- `00:00` 兩針重疊，分針較長且為強調色，仍可辨識。
- SVG `aria-label` 隨每次 tick 更新為「城市 HH:MM，24 小時制」。
- 內圈固定第一城市、外圈固定第二城市；外圈偏移 `Δ = (offset2 − offset1)/60` 小時，整圈旋轉 `−Δ`。DST 造成 offset 改變時，簽章變更並重建雙環。

## 6. 城市列規格

資料來源與順序：

- 依 `State.selectedIds` 原順序（與時間軸一致）。
- 每筆以 `State.findCity(id)` 取得城市；找不到就跳過該筆。
- 城市名稱用 `I18nUtils.getCityName(city)`，自動處理 `local` 與 `custom-*`。

單列結構：

```html
<li class="clock-city-row" aria-label="東京 10/31 +1 09:41">
  <div class="clock-city-meta">
    <span class="clock-city-name">東京</span>
    <span class="clock-city-date">10/31</span>
    <!-- 僅在跨日時插入 -->
    <span class="clock-day-shift">+1</span>
  </div>
  <span class="clock-city-time">09:41</span>
</li>
```

時間：

- 使用 `TimeUtils.getFormatter(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })`。
- `locale` 取 `I18nUtils.getLocale() || "en-US"`。
- 明確用 `h23`，避免部分語系在午夜輸出 `24:00`，與錶盤的 24 小時標尺衝突。

日期：

- 顯示用 `{ month: "numeric", day: "numeric" }`（例如 `10/31`、`31/10`），跟隨目前語言。
- 跨日徽章 `+1` / `−1`（U+2212），只在與裝置本地日期不同時顯示。

跨日計算用日期序數比較，避免 DST 與時區邊界問題：

```js
function dayOrdinal(date, zone) {
  const text = TimeUtils.getFormatter("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const [y, m, d] = text.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
```

裝置本地日期以 `Intl.DateTimeFormat().resolvedOptions().timeZone` 作為 zone 傳入同一函式。

空清單：

```html
<li class="clock-empty">尚未選取城市，請到設定新增</li>
```

清單每次 `render()` 重建，因此空狀態文字不可依賴 `data-i18n`（`applyAttributes()` 只在初始化與語言切換時掃描一次），必須用 `I18nUtils.getTranslation("clockEmptyCities")` 取得。

城市名可能是使用者自訂輸入，組裝列時一律用 `EscapeUtils.html()` 跳脫（與 `timeline-preview.js` 相同做法），或改用 `textContent` 寫入。

同一時區的重複城市（例如東京／大阪）各自獨立成列；`State` 的 10 城市上限已由既有邏輯保證。

## 7. 更新時機

| 時機 | 行為 |
|---|---|
| `ClockView.init()` | 生成錶盤、首次 `render()` |
| `showView("clock")` | `ClockView.render()` |
| 每分鐘 ticker | `currentView === "clock"` 時 `render()`（時針微動、城市列、城市名標籤、必要時重建雙環） |
| 每秒 ticker | `currentView === "clock"` 時 `tick()`（分針掃動） |
| 城市／時區／offset 改變 | `_syncRings()` 比對 `zone|offset` 簽章，變更才重建雙環 |
| `pageshow`（`event.persisted`） | 時鐘頁可見時 `render()`，修正休眠後的舊時間 |
| 語言切換 | 發生在設定頁；切回時鐘頁時整份重繪 |
| 主題切換 | 顏色全走 CSS 變數，不需重繪 |
| 城市增減 | 發生在設定頁；切回時重繪 |

時鐘頁不可見時 ticker 直接跳過，不做多餘 DOM 更新。

## 8. 多語系字串

| key | zh | en | es |
|---|---|---|---|
| `clockSelectedCities` | 已選取的城市 | Selected cities | Ciudades seleccionadas |
| `clockEmptyCities` | 尚未選取城市，請到設定新增 | No cities selected. Add some in Settings. | Sin ciudades seleccionadas. Añádelas en Ajustes. |
| `clockDialAriaLabel` | {city} {time}，24 小時制 | {city} {time}, 24-hour clock | {city} {time}, formato de 24 horas |

`clockDialAriaLabel` 透過 `I18nUtils.getTranslation("clockDialAriaLabel", { city, time })` 取值。

## 9. 版面與樣式

- `.clock-page`：`max-width: 560px`、左右自動置中、`display: flex`、`flex-direction: column`、`gap: 20px`。
- `.clock-face-wrap`：垂直排列、置中、`padding-top: 16px`；錶盤寬度 `min(94vw, 416px)`、`aspect-ratio: 1`、`overflow: visible`。viewBox 保持 260，時鐘本體不因城市名而縮小。
- `.clock-section-title`：`--font-md`、600、`--text-primary`。
- `.clock-city-row`：`display: flex`、`align-items: center`、`justify-content: space-between`、`gap: 12px`、`padding: 14px 4px`、`border-top: 1px solid var(--divider)`；第一列無上邊框。
- `.clock-city-meta`：`display: flex`、`align-items: center`、`flex-wrap: wrap`、`gap: 6px`、`min-width: 0`。
- `.clock-city-name`：`0.95rem`、600。
- `.clock-city-date` / `.clock-day-shift`：`--font-xs`、`--text-secondary`；徽章用 `--btn-bg` 底、`--radius-pill`、`padding: 1px 6px`。
- `.clock-city-time`：`clamp(1.9rem, 9vw, 2.75rem)`、600、`font-variant-numeric: tabular-nums`、`letter-spacing: -0.02em`、`line-height: 1`、`text-align: right`、`white-space: nowrap`。
- `.clock-empty`：置中、`--text-secondary`、上下 `28px` 留白。
- `body` 既有 `padding-bottom: 88px` 足以避開底部導覽；城市過多時整頁滾動。

## 10. 邊界與錯誤處理

- 無已選城市：顯示空清單提示，錶盤仍正常運作。
- 無效時區：`TimeUtils.resolveZone()` 既有的 UTC fallback 生效，不在時鐘頁重複防禦。
- 自訂城市：`I18nUtils.getCityName()` 使用使用者輸入名稱。
- 裝置時區在 App 開啟期間變更：下一次 tick 即反映；錶盤用 `Date` 的本地方法取值。
- 時鐘頁隱藏：ticker 不做事，避免背景耗電。

## 11. 驗證（人工）

依 `AGENTS.md`，不新增或執行自動化驗證。以 `npm run dev` → `http://127.0.0.1:4173/_dev` 手動確認：

1. 三分頁切換正常，時鐘頁不再空白。
2. 內圈 24 在上方、外圈數字依第二城市時差旋轉；兩圈各有 24 個數字與刻度。指針顯示第一城市時間；以指針角度讀外圈可得到第二城市當地時間。21 點位置：內圈內部顯示第一城市名，外圈外側顯示第二城市名。
3. 分針跨分時跳 6°，時針同步微動。
4. 城市列順序與時間軸一致；時間皆為 `HH:MM` 24 小時制。
5. 跨日城市顯示 `+1` / `−1`（例：本地台北晚上、紐約同日或前一日）。
6. DST 城市（紐約、雪梨）時間正確。
7. 空城市清單顯示提示。
8. 語言切中／英／西，城市名、標題、提示同步切換。
9. 深色／淺色主題下錶盤與文字對比正常。
10. 切到時間軸再切回，時間立即更新；App 從背景回來後時間不殘留舊值。
11. 10 個城市時列表可滾動且不被底部導覽遮住。

## 12. 風險

- 不同語系的日期格式：只取 numeric 月／日，已避免長格式撐破版面。
- SVG 文字垂直置中在舊 WebView 可能有偏差；目標為 Android WebView（Chromium），必要時改用 `dy` 微調。
- 城市列時間依賴 `Intl` 時區資料；既有 App 已全面依賴，無新增風險。
