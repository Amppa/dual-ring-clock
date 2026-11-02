/**
 * TimeMapper - Shared City List Preview Module
 */

import { State } from "./state.js";
import { CONFIG } from "./config.js";
import { MathUtils, MapUtils, TimeUtils, I18nUtils, EscapeUtils } from "./utils.js";

/**
 * Transient pointer-drag bookkeeping. These hold DOM nodes, so they stay in
 * module scope instead of the persisted State singleton.
 */
let activePointerDrag = null;
let autoScrollRaf = null;

/**
 * Return a new order with `id` moved before/after `targetId`.
 * Returns the original array when the move is a no-op or ids are unknown.
 */
export function reorderIds(ids, id, targetId, placeAfter) {
  const from = ids.indexOf(id);
  const targetIndex = ids.indexOf(targetId);
  if (from === -1 || targetIndex === -1 || id === targetId) return ids;

  const list = [...ids];
  list.splice(from, 1);
  let insertIndex = targetIndex + (placeAfter ? 1 : 0);
  if (from < insertIndex) insertIndex -= 1;
  if (insertIndex === from) return ids;
  list.splice(insertIndex, 0, id);
  return list;
}

export const CityPreview = {
  isReordering: false,
  /**
   * Collect the nodes this module renders into.
   */
  collectRefs(root) {
    const q = (sel) => root.querySelector(sel);
    return {
      currentCitiesList: q("#currentCitiesList"),
      clearAllButton: q("#clearAllButton"),
      resetButton: q("#resetButton"),
    };
  },

  /** Clear drag state on every city card. */
  clearCardDragState(refs) {
    document.removeEventListener("pointermove", CityPreview._onPointerDragMove);
    document.removeEventListener("pointerup", CityPreview._onPointerDragEnd);
    document.removeEventListener("pointercancel", CityPreview._onPointerDragEnd);
    if (autoScrollRaf !== null) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
    if (refs?.currentCitiesList) {
      refs.currentCitiesList.classList.remove("is-dragging-active");
    }
    document.querySelectorAll(".current-city-card").forEach((c) => {
      c.classList.remove("drag-over-top", "drag-over-bottom", "is-dragging");
      c.style.transform = "";
      c.style.transition = "";
    });
    activePointerDrag = null;
    State.draggingId = null;
  },

  /**
   * Render the current-cities list from State.
   * `onReorder` is invoked after a drag-reorder so the page can repaint
   * dependent UI (timeline rows, map previews, ...).
   */
  renderCurrentCitiesList(refs, onReorder) {
    if (!refs.currentCitiesList) return;
    if (activePointerDrag) CityPreview.clearCardDragState(refs);
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
        CityPreview.beginPointerDrag(e, card, id, refs, onReorder);
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

  beginPointerDrag(e, card, id, refs, onReorder) {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (activePointerDrag) return;

    const cards = Array.from(refs.currentCitiesList?.querySelectorAll(".current-city-card") || []);
    const startIndex = cards.indexOf(card);
    if (startIndex === -1 || cards.length <= 1) return;

    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);

    const slotHeight = cards.length > 1
      ? (cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top)
      : (card.offsetHeight + 6);

    activePointerDrag = {
      pointerId: e.pointerId,
      id,
      card,
      handle,
      refs,
      onReorder,
      startY: e.clientY,
      lastY: e.clientY,
      cards,
      startIndex,
      targetIndex: startIndex,
      slotHeight,
    };

    State.draggingId = id;
    card.classList.add("is-dragging");
    refs.currentCitiesList?.classList.add("is-dragging-active");

    document.addEventListener("pointermove", CityPreview._onPointerDragMove);
    document.addEventListener("pointerup", CityPreview._onPointerDragEnd);
    document.addEventListener("pointercancel", CityPreview._onPointerDragEnd);
    CityPreview._startAutoScroll();
  },

  _onPointerDragMove(e) {
    const drag = activePointerDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (e.cancelable) e.preventDefault();

    drag.lastY = e.clientY;
    const deltaY = e.clientY - drag.startY;
    drag.card.style.transform = `translateY(${deltaY}px)`;

    const offsetSlots = Math.round(deltaY / drag.slotHeight);
    const targetIndex = Math.max(0, Math.min(drag.cards.length - 1, drag.startIndex + offsetSlots));

    if (targetIndex !== drag.targetIndex) {
      drag.targetIndex = targetIndex;
      CityPreview._updateSiblingDisplacements();
    }
  },

  _onPointerDragEnd(e) {
    const drag = activePointerDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    CityPreview._finishPointerDrag(e.type === "pointercancel");
  },

  _updateSiblingDisplacements() {
    const drag = activePointerDrag;
    if (!drag) return;

    const { cards, startIndex, targetIndex, slotHeight } = drag;
    cards.forEach((c, i) => {
      if (i === startIndex) return;

      let shift = 0;
      if (startIndex < targetIndex) {
        if (i > startIndex && i <= targetIndex) {
          shift = -slotHeight;
        }
      } else if (startIndex > targetIndex) {
        if (i >= targetIndex && i < startIndex) {
          shift = slotHeight;
        }
      }
      c.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  },

  _startAutoScroll() {
    if (autoScrollRaf !== null) return;

    const EDGE = 72;
    const MAX_STEP = 16;
    const tick = () => {
      const drag = activePointerDrag;
      if (!drag) {
        autoScrollRaf = null;
        return;
      }

      const y = drag.lastY;
      let delta = 0;
      if (y < EDGE) {
        delta = -Math.ceil(((EDGE - y) / EDGE) * MAX_STEP);
      } else if (y > window.innerHeight - EDGE) {
        delta = Math.ceil(((y - (window.innerHeight - EDGE)) / EDGE) * MAX_STEP);
      }

      if (delta !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        const scrolled = window.scrollY - before;
        if (scrolled !== 0) {
          drag.startY -= scrolled;
          const deltaY = drag.lastY - drag.startY;
          drag.card.style.transform = `translateY(${deltaY}px)`;
          const offsetSlots = Math.round(deltaY / drag.slotHeight);
          const targetIndex = Math.max(0, Math.min(drag.cards.length - 1, drag.startIndex + offsetSlots));
          if (targetIndex !== drag.targetIndex) {
            drag.targetIndex = targetIndex;
            CityPreview._updateSiblingDisplacements();
          }
        }
      }

      autoScrollRaf = requestAnimationFrame(tick);
    };

    autoScrollRaf = requestAnimationFrame(tick);
  },

  _finishPointerDrag(cancelled) {
    const drag = activePointerDrag;
    if (!drag) return;

    document.removeEventListener("pointermove", CityPreview._onPointerDragMove);
    document.removeEventListener("pointerup", CityPreview._onPointerDragEnd);
    document.removeEventListener("pointercancel", CityPreview._onPointerDragEnd);
    if (autoScrollRaf !== null) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
    if (drag.handle?.hasPointerCapture?.(drag.pointerId)) {
      try {
        drag.handle.releasePointerCapture(drag.pointerId);
      } catch (_) {}
    }

    const { refs, onReorder, card, startIndex, targetIndex, slotHeight } = drag;

    if (cancelled || targetIndex === startIndex) {
      card.style.transition = "transform 0.15s ease-out";
      card.style.transform = "";
      setTimeout(() => {
        CityPreview.clearCardDragState(refs);
      }, 150);
      return;
    }

    const finalShift = (targetIndex - startIndex) * slotHeight;
    card.style.transition = "transform 0.15s cubic-bezier(0.2, 0, 0, 1)";
    card.style.transform = `translateY(${finalShift}px)`;

    setTimeout(() => {
      CityPreview.clearCardDragState(refs);

      const next = [...State.selectedIds];
      const [removed] = next.splice(startIndex, 1);
      next.splice(targetIndex, 0, removed);

      State.selectedIds = next;
      State.saveSelection();

      CityPreview.isReordering = true;
      CityPreview.renderCurrentCitiesList(refs, onReorder);
      CityPreview.isReordering = false;

      if (typeof onReorder === "function") onReorder();
    }, 150);
  },

  /**
   * Wire clear / reset buttons.
   * `onReset` is called after the selection is reset.
   */
  wireResetButtons(refs, onReset) {
    if (refs.clearAllButton) {
      refs.clearAllButton.addEventListener("click", () => {
        State.selectedIds = [];
        State.customCities = [];
        State.saveSelection();
        State.saveCustomCities();
        if (onReset) onReset();
      });
    }

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
