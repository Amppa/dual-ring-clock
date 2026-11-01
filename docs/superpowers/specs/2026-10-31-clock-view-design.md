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
- 除盤面主題（§13）外不新增設定項，不改 `utils.js`。
- 不引入建置工具或自動化測試框架。

## 3. 決策摘要

| 項目 | 決定 |
|---|---|
| 錶盤方向 | 0 在正上方，順時針遞增 0→23 |
| 數字 | 頂端顯示 24，其餘 1–23 |
| 刻度 | 24 個小時刻度，無分鐘刻度 |
| 指針 | 時針＋分針，無秒針 |
| 走針 | 時針每分鐘微動 0.25°；分針每秒依秒數連續掃動 |
| 城市列內容 | `⋮⋮` 把手＋城市名（大字 400）＋日期（大字 100，跨日標 `+1` / `−1`）＋`HH:MM`（大字 600）；每列是独立卡片 |
| 時間格式 | `hourCycle: "h23"`（`00:00`–`23:59`，避免 `24:00`） |
| 空清單 | 顯示提示文字 |
| 錶盤時間來源 | 第一個已選城市（沒有已選城市時退回裝置本地時間） |
| 城市列互動 | 可拖曳 `⋮⋮` 重排 `State.selectedIds`；列本身不可點擊 |
| 盤面主題 | 三档（§13）：`twoTone` 6–18／18–6 硬邊、`gradient` 半點邊界＋16 段漸層（現況、預設）、`timeline` 8／18／0 三色，分界點與時間軸相同；由設定頁「時鐘」卡選擇，存 `State.clockDialTheme` |

## 4. 檔案與模組

| 檔案 | 變動 |
|---|---|
| `src/app/clock.js` | 新增 `ClockView`；色環分段依 `RING_LAYOUTS[State.clockDialTheme]` 產生（§13） |
| `src/app/clock.css` | 新增時鐘頁樣式；`.clock-ring--day/mid/evening` 只指到 token |
| `src/app/index.html` | 填入 `#clockView` 骨架、引入 `clock.css`；新增設定頁 `#cardClock`（§13） |
| `src/app/app.js` | import、初始化、切頁渲染、每分鐘 tick、`pageshow` 補渲染 |
| `src/shared/i18n.js` | 新增時鐘頁與設定卡字串 × 3 語言 |
| `src/shared/config.js` | `clockDialThemeKey`、`clockDialThemes`、`defaultClockDialTheme`（§13） |
| `src/shared/state.js` | `clockDialTheme` 欄位、`resolveClockDialTheme()`、`saveClockDialTheme()`（§13） |
| `src/shared/tokens.css` | `--clock-ring-day` / `--clock-ring-mid` / `--clock-ring-evening`、徽章與刻度色 token（§13） |
| `src/app/settings-controller.js` | `renderClock()` / `wireClock()` 接線盤面主題下拉（§13） |

`src/shared/utils.js` 不動。

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
      <text id="clockInnerCityLabel" class="clock-ring-city-label" x="100" y="60" dy="0.35em" text-anchor="middle"></text>
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
| 內圈時段環 | 圓環 `r=88`、寬 20（涵蓋 78–98），代表 `State.selectedIds[0]`，固定不旋轉；時段分段依盤面主題（§13），預設 `gradient`：6.5–17.5 白天色、18.5–5.5 傍晚色（跨午夜），17.5–18.5 與 5.5–6.5 各以 16 段 `color-mix()` 做白天↔傍晚漸層。色盤沿用時間軸：淺色 `#FFE7A3` / `#856C60`，深色 `#EEB422` / `#38302E` |
| 外圈時段環 | 圓環 `r=112`、寬 20（涵蓋 102–122，與內圈等寬），代表 `State.selectedIds[1]`；整圈（色段、刻度、底盤、數字）依 `-(offset2 − offset1)/60` 小時旋轉，讓同一指針角度可讀第二城市時間。少於兩個城市時不畫 |
| 小時刻度 | 每圈 24 個，各自從 `半徑 ± 寬/2` 貫穿色環；一律線寬 1；顏色 `--clock-tick`（淺色白、深色黑）。刻度先畫，數字圓盤再蓋住中段，形成被白／黑線切開的環 |
| 數字底盤 | 每圈 24 個，`r=6.5`，圓心落在各圈半徑上，填 `--clock-badge-bg`（淺色白、深色黑），不超出該圈內緣 |
| 小時數字 | 各圈半徑處，`font-size=8.5`，`text-anchor=middle`，以 `dy=0.35em` 對齊數字墨跡視覺中心；內圈頂端顯示 `24`；外圈數字隨環旋轉位置但文字保持直立；填 `--clock-badge-ink`（淺色深字、深色白字）、字重一致 |
| 城市名標籤 | 第一城市名在內圈內部、**24 點方向**（`r=40`，`x=100,y=60`）；第二城市名在錶圈外側、**21 點方向**（`r=150`）。兩者 `font-size=20`、不壓縮，填 `--text-primary`、`opacity=0.5`；由 `_renderCityLabels()` 隨城市與語言更新 |
| 時針 | 單一填充路徑（等桿＋等邊三角形尖）：`M 97.5 100 L 97.5 38.330 L 100 34 L 102.5 38.330 L 102.5 100 Z`；全長 66、桿寬 5；填 `--text-primary` |
| 分針 | 單一填充路徑：`M 98.5 100 L 98.5 26.598 L 100 24 L 101.5 26.598 L 101.5 100 Z`；全長 76、桿寬 3；填 `--accent-solid` |
| 中心點 | `r=4.5`，填 `--accent-solid` |

內圈 78–98、外圈 102–122，皆寬 20；內外圈間隔 4，外圈到錶圈 `r=126` 也間隔 4。內圈半徑放大到 88，指針仍在內圈內部；指針顯示第一城市時間，內圈刻度因此是參考盤。內圈缺省（沒有已選城市）時退回裝置本地城市；第二城市不存在時只畫內圈。

指針為單一填充 `<path>`：等寬桿身直接接上邊長等於桿寬的等邊三角形尖端，一個元素沒有接合面，因此零縫、零肩。旋轉只更新該 `<path>` 的 `transform`；不使用 SVG filter、mask 或動畫 path。中心端由圓心點覆蓋，兩針尖端在 `y=34`／`y=24`，全長 66／76。

城市名標籤：第一城市名在內圈內部、24 點方向（`r=40`）；第二城市名在**錶圈外側**、21 點方向（`r=150`，距外圈 28 單位、距錶圈 24 單位）。`r=150` 落在 SVG 方形盒的左上角落、已在圓形錶圈之外；SVG 設 `overflow: visible`，標籤若略超出盒邊會畫進頁面留白，時鐘本體不縮小。外圈標籤不壓縮，長名稱會向頁面左側延伸。

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

單列結構（名稱、日期與時間同为大字，只靠字重區分）：

```html
<li class="clock-city-row" aria-label="東京 10/31 +1 09:41">
  <div class="clock-city-meta">
    <span class="clock-city-handle" aria-hidden="true">⋮⋮</span>
    <span class="clock-city-name">東京</span>
  </div>
  <div class="clock-city-clock">
    <span class="clock-city-date">10/31</span>
    <!-- 僅在跨日時插入 -->
    <span class="clock-day-shift">+1</span>
    <span class="clock-city-time">09:41</span>
  </div>
</li>
```

前兩列（對應內／外圈）保持強對比；第 3 列起加上 `.is-secondary`，文字 50%、卡片 55% 強度，表達「備選」。

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

### 6.1 拖曳重排

- 每列最左側的 `⋮⋮` 是拖曳把手（`pointerdown` 起拖），與設定頁城市清單相同的互動模型：跟手 `translateY`、相鄰列過半時用 `transform` 即時讓位、放手後以 0.15s 動畫到位再提交。
- 提交時重排 `State.selectedIds`（同樣的 splice 邏輯）並 `State.saveSelection()`；因為時間軸與內／外圈都讀同一份順序，順序變更會同時影響：
  - 時間軸列順序
  - 內圈＝新的第一個城市、外圈＝新的第二個城市（`_syncRings()` 的簽章改變就會重建雙環）
- 拖曳期間 `render()` 跳過 `_renderCityList()`，避免每分鐘 ticker 重建列表把拖曳中的節點抽掉；拖曳結束才整份重繪。
- 把手設 `touch-action: none`，列表邊緣 72px 內自動捲動（`requestAnimationFrame`），讓第 10 列也能拖到頂部。
- 只有 1 個城市時不綁手把。

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
| 城市列拖曳 | 拖曳中跳過列表重建；放手提交 `State.selectedIds` 後 `render()`（含雙環簽章比對） |

時鐘頁不可見時 ticker 直接跳過，不做多餘 DOM 更新。

## 8. 多語系字串

| key | zh | en | es |
|---|---|---|---|
| `clockSelectedCities` | 城市清單 | City list | Lista de ciudades |
| `clockEmptyCities` | 尚未選取城市，請到設定新增 | No cities selected. Add some in Settings. | Sin ciudades seleccionadas. Añádelas en Ajustes. |
| `clockDialAriaLabel` | {city} {time}，24 小時制 | {city} {time}, 24-hour clock | {city} {time}, formato de 24 horas |

`clockDialAriaLabel` 透過 `I18nUtils.getTranslation("clockDialAriaLabel", { city, time })` 取值。

## 9. 版面與樣式

- `.clock-page`：`max-width: 560px`、左右自動置中、`display: flex`、`flex-direction: column`、`gap: 20px`。
- `.clock-face-wrap`：垂直排列、置中、`padding-top: 16px`；錶盤寬度 `min(94vw, 416px)`、`aspect-ratio: 1`、`overflow: visible`。viewBox 保持 260，時鐘本體不因城市名而縮小。
- `.clock-section-title`：`--font-md`、600、`--text-primary`。
- `.clock-city-list`：`display: flex`、`flex-direction: column`、`gap: 10px`（卡片之間靠 gap，不再用分隔線）。
- `.clock-city-row`：卡片式 —`background: var(--bg-card)`、`border-radius: var(--radius-lg)`、`padding: 12px 14px`、`color: var(--text-primary)`；`flex-wrap: wrap`、`gap: 4px 12px`。`transition: transform 0.2s`、`will-change: transform` 供拖曳讓位動畫；`.is-dragging` 取消 transition、加 `z-index: 2` 與不透明卡片底。
- `.clock-city-row.is-secondary`（第 3 列起）：`color: color-mix(in srgb, var(--text-primary) 50%, transparent)`、`background: color-mix(in srgb, var(--bg-card) 55%, transparent)`。列內文字一律 `color: inherit`，跟著層級變淡。
- `.clock-city-meta`：把手＋城市名，`gap: 14px`、`min-width: 0`。
- `.clock-city-handle`：`⋮⋮`、`color: inherit`、`opacity: 0.6`、`font-size: 1.5rem`、`letter-spacing: -0.15em`、`touch-action: none`、`cursor: grab`（拖曳中 `grabbing`）。
- `.clock-city-name`：`clamp(1.9rem, 9vw, 2.75rem)`、**400**。
- `.clock-city-clock`：`align-items: baseline`、`gap: 14px`、`margin-left: auto`、`white-space: nowrap`。
- `.clock-city-date`：與時間同字号 `clamp(1.9rem, 9vw, 2.75rem)`、**100**、tabular-nums。
- `.clock-day-shift`：`--font-xs`、`color: inherit`；徽章用 `--btn-bg` 底、`--radius-pill`、`padding: 1px 6px`、`align-self: center`。
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
2. 內圈 24 在上方、外圈數字依第二城市時差旋轉；兩圈各有 24 個數字與刻度。指針顯示第一城市時間；以指針角度讀外圈可得到第二城市當地時間。24 點位置內圈顯示第一城市名，21 點位置外圈顯示第二城市名。
3. 分針每秒連續掃動、時針每分鐘微動；兩針末端為尖角。
4. 城市列順序與時間軸一致；時間皆為 `HH:MM` 24 小時制。
5. 每列是獨立卡片；城市名、日期、時間字号相同，只靠字重區分（400／100／600）；日期在時間左側，兩側間距 14px。
6. 拖曳 `⋮⋮` 可重排城市；放手後設定頁、時間軸與內／外圈都照新順序（內圈變成新的第一個城市）。
7. 拖到列表上下緣 72px 內會自動捲動；只有 1 個城市時無法拖曳。
8. 第 3 列起為備選層級：文字 50%、卡片 55% 強度，可一眼分辨前兩列對應錶盤。
8. 跨日城市顯示 `+1` / `−1`（例：本地台北晚上、紐約同日或前一日）。
9. DST 城市（紐約、雪梨）時間正確。
10. 空城市清單顯示提示。
11. 語言切中／英／西，城市名、標題（城市清單）、提示同步切換。
12. 深色／淺色主題下錶盤與文字對比正常。
13. 切到時間軸再切回，時間立即更新；App 從背景回來後時間不殘留舊值。
14. 10 個城市時列表可滾動且不被底部導覽遮住；很長的城市名讓列換行而不縮小字級。
15. 設定「時鐘」卡切三档後切回時鐘頁，內／外圈分段對應（§13）：雙色硬邊在 6／18（6、18 的數字徽章跨在色界上）；雙色微漸層維持現況；三色硬邊在 8／18／24，與時間軸的分界線同一位置、中段是時間軸的 period2 色。
16. 重新開啟 App 後盤面主題維持上次選擇；切深／淺色時三档的顏色都跟著 token 換。

## 12. 風險

- 不同語系的日期格式：只取 numeric 月／日，已避免長格式撐破版面。
- SVG 文字垂直置中在舊 WebView 可能有偏差；目標為 Android WebView（Chromium），已用 `dy=0.35em` 校正。
- 城市列時間依賴 `Intl` 時區資料；既有 App 已全面依賴，無新增風險。
- `font-weight: 100` 需要 Thin face；Roboto／Inter 有，缺少 Thin 的字型會被合成或回退，日期與城市名的對比會不如預期。
- 大字級城市名列較易換行（`flex-wrap: wrap`）；選擇不縮小、不壓縮文字，改為讓時間群組落到第二列。
- 時鐘頁拖曳是 `clock.js` 內自行實作的互動，與 `city-preview.js` 的設定頁版本結構相同但程式碼重複；若第三處需要同樣行為，再抽共用模組。

## 13. 盤面主題（設定頁「時鐘」卡）

**入口**：`index.html` 的 `#cardClock`（在外觀卡之後），一個 `control-group`：標籤 `盤面主題`＋ `select.styled-select#mobileClockDialThemeSelect`，三個 option 帶 `data-i18n`，與語言／佈景主題下拉同一写法。

**持久化**：`CONFIG.clockDialThemeKey = "worldTimeAlignerClockDialTheme"`、`clockDialThemes = ["twoTone", "gradient", "timeline"]`、`defaultClockDialTheme = "gradient"`。`State.init()` 用 `resolveClockDialTheme()` 讀（不在清單內的值退回預設），`saveClockDialTheme()` 走同一校驗再寫 `Storage`。下拉 `change` 只存值，不呼叫 `Renderer.render()`：改設定時時鐘頁是隱藏的，切回時 `ClockView.render()` 自會重建。

**分段表**（`clock.js` 的 `RING_LAYOUTS`；`buildRingPaths(radius, width, offsetHours, theme)` 照它產 `<path>`，每档各段加總 24 小時）：

| theme | 白天段 | 中段 | 傍晚段 | 邊界處理 |
|---|---|---|---|---|
| `twoTone` 雙色 | 6 → 18 | — | 18 → 6 | 整點硬邊；6／18 的數字徽章正好跨在色界上 |
| `gradient` 雙色微漸層（預設） | 6.5 → 17.5 | — | 18.5 → 5.5 | 另在 17.5–18.5、5.5–6.5 各畫 16 段 `color-mix(in srgb, ...)`；色界落在半點，不切到徽章 |
| `timeline` 三色 | 8 → 18 | 18 → 0 | 0 → 8 | 整點硬邊，分界點與時間軸的 period 分界線同一位置（8–17／18–23／0–7 那些小時格的邊）；8、18、24 三個徽章會被色界切過 |

**顏色 token**：`--clock-ring-day` / `--clock-ring-mid` / `--clock-ring-evening` 在 `tokens.css` 三個 block（`:root` 為暗色預設、`[data-theme="dark"]`、`[data-theme="light"]`）各自定義。`--clock-ring-mid` 深 `#B8860B`／淺 `#F9BE6C`，取 `CONFIG.periodColorsByCount[3]` 的中間色；day／evening 兩個 token 本來就等於同表的第一、第三色，所以三色档不重複定義色盤。三档共用同一組 token，只差分段與有無漸層，換深淺色由 CSS 變數自動生效、不需要重新取色。

**重建時機**：`_syncRings()` 的 signature 是 `zone1|offset1|zone2|offset2|clockDialTheme`；主題改變使 signature 不同，下一次 `render()` 重建兩圈色環。刻度、徽章、數字走同一份 `buildRingScale()`，不受主題影響；指針、城市名標籤也不變。

**多圈**：內圈與外圈共用同一主題，只差 `offsetHours`，之後新增第三圈沿用。
