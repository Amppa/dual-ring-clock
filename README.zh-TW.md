# TimeMapper

[English](README.md) | **繁體中文** | [Español](README.es.md)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-TimeMapper-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/Amppa)

一個用來比對多個時區時間的 Chrome 擴充功能。點擊世界地圖上的城市，把它們的一天並排在 24 小時時間軸上，快速找出大家都方便的時間。

---

## 安裝

### Chrome 線上應用程式商店（推薦）

直接前往 [Chrome 線上應用程式商店](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb) 安裝。

### 手動安裝（開發人員模式）

1. 下載或 clone 這個專案。
2. 開啟 Chrome，進入 `chrome://extensions/`。
3. 打開右上角的「**開發人員模式**」。
4. 點擊「**載入未封裝項目**」，選擇這個專案的根目錄。
5. 點擊 Chrome 工具列上的 TimeMapper 圖示。

---

## 使用方式

**選擇城市** — 點擊世界地圖上的任一圖釘，就能把該城市加到時間軸，再點一次即可移除。點擊地圖上的空白處，會以該處的 UTC 偏移（例如 `UTC+8`）新增一列。第一次開啟時會先預設選取東京、紐約、洛杉磯，以及你瀏覽器的本地時間。同時最多顯示 10 個城市。

**看時間軸** — 每一列是一個城市的 24 小時，直向的**現在線**標出此刻。`00` 那一格會同時顯示日期，方便看出城市在哪裡跨日。

**比對特定時刻** — 在時間軸上點一下就會放下一條對齊線（最多 4 條）。拖曳可以移動位置，點 `[x]` 可以移除。每一列都會即時顯示那個時刻在該城市是幾點。兩條相鄰的標記線（含現在線）之間會標出間隔長度，例如 `1.5h`。

**使用地圖** — 地圖可以顯示目前的夜間範圍、各時區的小時線，並在已選城市的圖釘上方顯示即時時間泡泡。只想要時間軸的話，地圖區塊可以收合。

---

## 設定

點擊頂部工具列的 ⚙ 按鈕開啟設定頁面。語言與佈景主題的下拉選單位於頁首，右側設定區塊左邊則會固定顯示地圖與時間軸的即時預覽。

| 區塊 | 可以做什麼 |
| --- | --- |
| **城市清單管理** | 檢視目前時間軸上的每個城市：修改名稱、切換時區、微調地圖座標、拖曳左側手柄調整順序，或點 `×` 移除。可以依名稱搜尋地圖上沒有的城市、載入預設範例，或全部清除。最多 10 個城市。 |
| **小地圖設定** | 開關夜間範圍、小時線與城市時間泡泡。 |
| **小地圖貼圖設定** | 微調地圖的經度／緯度偏移、寬度／高度縮放與垂直偏移，並可一鍵恢復預設。 |
| **時段設定** | 選擇要劃分 2、3 或4 個時段，再於 24 小時格線上拖曳手柄調整各時段的起迄時間，或恢復預設。同時可設定現在線的基準（瀏覽器本地時間，或第一個城市的時間）。 |

每種時段數量都自帶淺色與深色兩套配色，切換佈景主題時時段依然清楚易讀。核心設定（城市清單、自訂城市、時段、語言及現在線基準）會透過 `chrome.storage.sync` 跨裝置同步，佈景主題與地圖校準值則保存在本地的 `localStorage`。

---

## 地圖上沒有的城市

在設定頁的**城市清單管理**區塊搜尋即可。結果來自 [Open-Meteo 地理編碼 API](https://geocoding-api.open-meteo.com/)，所以搜尋需要網路連線。選取後會依該城市自己的座標放到地圖上，並記住供下次使用。

想把城市永久加進內建清單，請編輯 `src/shared/cities.js` 的 `cityCatalog`；經緯度轉換成地圖位置的常數寫在 `src/shared/config.js` 最上方的 `PROJECTION` 區塊。

---

## 贊助支持

如果你覺得 TimeMapper 對你有幫助，歡迎贊助支持開發：

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/Amppa)

---

## 隱私權政策

TimeMapper 不收集或傳輸任何個人隱私資料。完整聲明請參閱 [隱私權政策 (PRIVACY.md)](PRIVACY.md)。

---

## 翻譯檢查

`node tools/check-i18n.mjs` 會檢查 `src/shared/i18n.js` 的字典是否仍涵蓋兩個頁面用到的每個字串。新增介面字串、語言或城市之後跑一次。
