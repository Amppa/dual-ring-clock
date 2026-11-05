/**
 * TimeMapper - Shared City List Preview Module
 */

import { State } from "./state.js";
import { CONFIG } from "./config.js";
import { MathUtils, MapUtils, TimeUtils, I18nUtils, EscapeUtils } from "./utils.js";
import { DragReorderController } from "./drag-reorder.js";

export const CityPreview = {
  /**
   * Collect the nodes this module renders into.
   */
  collectRefs(root) {
    const q = (sel) => root.querySelector(sel);
    return {
      currentCitiesList: q("#currentCitiesList"),
      resetButton: q("#resetButton"),
    };
  },

  /** Clear drag state on every city card. */
  clearCardDragState(refs) {
    DragReorderController.cancel();
    if (refs?.currentCitiesList) {
      refs.currentCitiesList.classList.remove("is-dragging-active");
    }
    document.querySelectorAll(".current-city-card").forEach((c) => {
      c.classList.remove("drag-over-top", "drag-over-bottom", "is-dragging");
      c.style.transform = "";
      c.style.transition = "";
    });
  },

  /**
   * Render the current-cities list from State.
   * `onReorder` is invoked after a drag-reorder so the page can repaint
   * dependent UI (timeline rows, map previews, ...).
   */
  renderCurrentCitiesList(refs, onReorder) {
    if (!refs.currentCitiesList) return;
    if (DragReorderController.isDragging()) CityPreview.clearCardDragState(refs);
    refs.currentCitiesList.innerHTML = "";

    State.selectedIds.forEach((id) => {
      const city = State.findCity(id);
      if (!city) return;

      const cityName = I18nUtils.getCityName(city);

      const card = document.createElement("div");
      card.className = "current-city-card";
      card.dataset.id = id;

      const currentZone = city.zone || "UTC";

      card.innerHTML = `
        <div class="drag-handle" aria-label="Drag to reorder">⋮⋮</div>
        <input class="city-name-input" type="text" value="${EscapeUtils.html(cityName)}" placeholder="Name">
        <select class="city-zone-select"></select>
        <button type="button" class="remove-city-card-btn" aria-label="${EscapeUtils.html(I18nUtils.getTranslation("removeCity", { name: cityName }))}">×</button>
      `;

      const nameInput = card.querySelector(".city-name-input");
      const zoneSelect = card.querySelector(".city-zone-select");
      const removeBtn = card.querySelector(".remove-city-card-btn");
      const dragHandle = card.querySelector(".drag-handle");

      // Timezone options: browser-supported zones + zones of selected cities,
      // sorted by UTC offset.
      const supportedZones = (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function")
        ? Intl.supportedValuesOf("timeZone")
        : ["UTC", "Asia/Taipei", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

      const uniqueZonesSet = new Set(supportedZones);
      State.selectedIds.forEach((sid) => {
        const c = State.findCity(sid);
        if (c && c.zone) uniqueZonesSet.add(c.zone);
      });

      const now = new Date();
      const zoneDetails = Array.from(uniqueZonesSet).map((zone) => {
        const offsetMins = TimeUtils.getOffsetMinutes(now, zone);
        const sign = offsetMins >= 0 ? "+" : "-";
        const absMins = Math.abs(offsetMins);
        const hours = Math.floor(absMins / 60);
        const mins = absMins % 60;
        const offsetStr = `UTC${sign}${hours}${mins > 0 ? ":" + String(mins).padStart(2, "0") : ""}`;
        return { zone, offsetMins, label: `${zone} (${offsetStr})` };
      });

      zoneDetails.sort((a, b) => {
        if (a.offsetMins !== b.offsetMins) return a.offsetMins - b.offsetMins;
        return a.zone.localeCompare(b.zone);
      });

      zoneDetails.forEach((detail) => {
        const opt = document.createElement("option");
        opt.value = detail.zone;
        opt.textContent = detail.label;
        zoneSelect.appendChild(opt);
      });
      zoneSelect.value = currentZone;

      dragHandle.addEventListener("pointerdown", (e) => {
        CityPreview.beginPointerDrag(e, card, refs, onReorder);
      });

      const handleAutoSave = () => {
        const nextName = nameInput.value.trim();
        const nextZone = zoneSelect.value.trim();

        let isValid = true;

        if (!nextName) {
          nameInput.classList.add("invalid");
          isValid = false;
        } else {
          nameInput.classList.remove("invalid");
        }

        if (!nextZone || !TimeUtils.isValidZone(nextZone)) {
          zoneSelect.classList.add("invalid");
          isValid = false;
        } else {
          zoneSelect.classList.remove("invalid");
        }

        if (!isValid) return;

        const { lng, lat } = MapUtils.lngLatOf(city);
        const x = MathUtils.clamp(MapUtils.lngToX(lng), 0, 100);
        const y = MathUtils.clamp(MapUtils.latToY(lat), 0, 100);

        let targetId = city.id;
        let isNewCustom = false;
        if (!targetId.startsWith("custom-")) {
          targetId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          isNewCustom = true;
        }

        const updatedCity = {
          id: targetId,
          name: nextName,
          zone: nextZone,
          x: x,
          y: y,
          lng: lng,
          lat: lat
        };

        if (isNewCustom) {
          card.dataset.id = targetId;
          State.customCities = [...State.customCities, updatedCity];
          State.selectedIds = State.selectedIds.map((selectedId) => (selectedId === city.id ? targetId : selectedId));
          State.saveCustomCities();
          State.saveSelection();
        } else {
          State.customCities = State.customCities.map((existing) => (existing.id === city.id ? updatedCity : existing));
          State.saveCustomCities();
          State.saveSelection();
        }
      };

      nameInput.addEventListener("blur", handleAutoSave);
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          nameInput.blur();
        }
      });

      zoneSelect.addEventListener("change", handleAutoSave);

      removeBtn.addEventListener("click", () => {
        const currentId = card.dataset.id || id;
        State.toggleCity(currentId);
        CityPreview.renderCurrentCitiesList(refs, onReorder);
        if (typeof onReorder === "function") {
          onReorder();
        }
      });

      refs.currentCitiesList.append(card);
    });
  },

  beginPointerDrag(e, card, refs, onReorder) {
    const cards = Array.from(refs.currentCitiesList?.querySelectorAll(".current-city-card") || []);
    const startIndex = cards.indexOf(card);
    if (startIndex === -1 || cards.length <= 1) return;

    DragReorderController.begin({
      event: e,
      container: refs.currentCitiesList,
      item: card,
      items: cards,
      handle: e.currentTarget,
      startIndex,
      onReorder: (fromIndex, toIndex) => {
        const next = [...State.selectedIds];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        State.selectedIds = next;
        State.saveSelection();

        CityPreview.renderCurrentCitiesList(refs, onReorder);

        if (typeof onReorder === "function") onReorder();
      }
    });
  },

  /**
   * Wire reset button.
   * `onReset` is called after the selection is reset.
   */
  wireResetButtons(refs, onReset) {
    if (refs.resetButton) {
      refs.resetButton.addEventListener("click", () => {
        State.selectedIds = [...CONFIG.defaultSelection].slice(0, State.cityLimit);
        State.saveSelection();
        if (onReset) onReset();
      });
    }
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.CityPreview = CityPreview;
}
