/**
 * TimeMapper - Shared City List Preview Module
 */

import { State } from "./state.js";
import { CONFIG } from "./config.js";
import { MapUtils, TimeUtils, I18nUtils, EscapeUtils } from "./utils.js";

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
   * Collect the nodes this module renders into. `root` is `document` in the
   * popup or the mount element built by each page.
   */
  collectRefs(root) {
    const q = (sel) => root.querySelector(sel);
    return {
      currentCitiesList: q("#currentCitiesList"),
      searchCityInput: q("#searchCityInput"),
      searchCityBtn: q("#searchCityBtn"),
      searchStatus: q("#searchStatus"),
      searchResultsList: q("#searchResultsList"),
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
    if (refs.currentCitiesList) {
      refs.currentCitiesList.classList.remove("is-dragging-active");
    }
    document.querySelectorAll(".current-city-card").forEach((c) => {
      c.classList.remove("drag-over-top", "drag-over-bottom", "is-dragging");
      c.style.transform = "";
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
        if (currentId.startsWith("custom-") || State.customCities.some((c) => c.id === currentId)) {
          State.customCities = State.customCities.filter((c) => c.id !== currentId);
          State.saveCustomCities();
        }
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

    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);

    activePointerDrag = {
      pointerId: e.pointerId,
      id,
      card,
      handle,
      refs,
      onReorder,
      startY: e.clientY,
      lastY: e.clientY,
      targetId: null,
      placeAfter: false
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
    drag.card.style.transform = `translateY(${e.clientY - drag.startY}px)`;
    CityPreview._updateDropTarget();
  },

  _onPointerDragEnd(e) {
    const drag = activePointerDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    CityPreview._finishPointerDrag(e.type === "pointercancel");
  },

  _updateDropTarget() {
    const drag = activePointerDrag;
    if (!drag || !drag.refs.currentCitiesList) return;

    const cards = Array.from(drag.refs.currentCitiesList.querySelectorAll(".current-city-card"))
      .filter((card) => card !== drag.card);

    let target = null;
    let placeAfter = true;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (drag.lastY < rect.top + rect.height / 2) {
        target = card;
        placeAfter = false;
        break;
      }
      target = card;
      placeAfter = true;
    }

    cards.forEach((card) => card.classList.remove("drag-over-top", "drag-over-bottom"));
    drag.targetId = target ? target.dataset.id : null;
    drag.placeAfter = placeAfter;

    if (target) {
      target.classList.add(placeAfter ? "drag-over-bottom" : "drag-over-top");
    }
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
        if (window.scrollY !== before) {
          drag.startY -= delta;
          drag.card.style.transform = `translateY(${drag.lastY - drag.startY}px)`;
          CityPreview._updateDropTarget();
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
      drag.handle.releasePointerCapture(drag.pointerId);
    }

    const { refs, onReorder, id, targetId, placeAfter } = drag;
    const firstRects = new Map();
    if (refs.currentCitiesList) {
      refs.currentCitiesList.querySelectorAll(".current-city-card").forEach((card) => {
        firstRects.set(card.dataset.id, card.getBoundingClientRect());
      });
    }

    CityPreview.clearCardDragState(refs);

    if (cancelled || !targetId || targetId === id) return;

    const next = reorderIds(State.selectedIds, id, targetId, placeAfter);
    if (next === State.selectedIds) return;

    State.selectedIds = next;
    State.saveSelection();

    CityPreview.isReordering = true;
    CityPreview.renderCurrentCitiesList(refs, onReorder);

    if (refs.currentCitiesList) {
      const DURATION = 250;
      refs.currentCitiesList.querySelectorAll(".current-city-card").forEach((card) => {
        const first = firstRects.get(card.dataset.id);
        if (!first) return;
        const deltaY = first.top - card.getBoundingClientRect().top;
        if (deltaY !== 0 && typeof card.animate === "function") {
          card.animate(
            [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
            { duration: DURATION, easing: "cubic-bezier(0.2, 0, 0, 1)" }
          );
        }
      });
      setTimeout(() => {
        CityPreview.isReordering = false;
      }, DURATION + 50);
    }

    if (typeof onReorder === "function") onReorder();
  },

  /**
   * One quiet line under the search row. Empty message hides it, so the
   * healthy state shows nothing at all.
   */
  setSearchStatus(refs, message, isError = false) {
    if (!refs.searchStatus) return;
    refs.searchStatus.textContent = message || "";
    refs.searchStatus.hidden = !message;
    refs.searchStatus.classList.toggle("is-error", !!message && isError);
  },

  /**
   * Wire the add-city search (Open-Meteo geocoding API).
   * `onCityAdded` is called after a city is added so the page can repaint.
   */
  wireCitySearch(refs, onCityAdded) {
    if (!refs.searchCityBtn) return;

    document.addEventListener("click", (e) => {
      if (refs.searchResultsList && !refs.searchResultsList.contains(e.target) && e.target !== refs.searchCityInput && e.target !== refs.searchCityBtn) {
        refs.searchResultsList.hidden = true;
      }
    });

    const triggerSearch = () => {
      const query = refs.searchCityInput.value.trim();
      if (!query) return;

      refs.searchCityBtn.textContent = "⏳";
      refs.searchCityBtn.style.pointerEvents = "none";
      CityPreview.setSearchStatus(refs, "");
      refs.searchResultsList.hidden = true;
      refs.searchResultsList.innerHTML = "";

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.results && data.results.length > 0) {
            refs.searchResultsList.innerHTML = "";
            data.results.forEach((result) => {
              const card = document.createElement("div");
              card.className = "search-result-card";

              const locationParts = [];
              if (result.country) locationParts.push(result.country);
              if (result.admin1) locationParts.push(result.admin1);
              const subtitleText = locationParts.length > 0 ? ` (${locationParts.join(", ")})` : "";

              const lng = result.longitude || 0;
              const lat = result.latitude || 0;

              card.innerHTML = `
                <div class="search-result-info">
                  <div class="search-result-name-row">
                    <span class="search-result-name">${EscapeUtils.html(result.name)}</span>
                    <span class="search-result-country">${EscapeUtils.html(subtitleText)}</span>
                  </div>
                  <div class="search-result-details">${EscapeUtils.html(result.timezone || "UTC")} (Lng: ${lng.toFixed(1)}, Lat: ${lat.toFixed(1)})</div>
                </div>
              `;

              card.addEventListener("click", (evt) => {
                evt.stopPropagation();

                if (State.selectedIds.length >= State.cityLimit) {
                  CityPreview.setSearchStatus(refs, I18nUtils.getTranslation("cityLimitReached"), true);
                  return;
                }

                const newCity = {
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name: result.name,
                  zone: result.timezone || "UTC",
                  x: MathUtils.clamp(MapUtils.lngToX(lng), 0, 100),
                  y: MathUtils.clamp(MapUtils.latToY(lat), 0, 100),
                  lng: lng,
                  lat: lat
                };

                State.customCities = [...State.customCities, newCity];
                State.saveCustomCities();
                State.toggleCity(newCity.id);
                if (onCityAdded) onCityAdded();

                refs.searchCityInput.value = "";
                refs.searchResultsList.hidden = true;
                refs.searchResultsList.innerHTML = "";
              });

              refs.searchResultsList.append(card);
            });
            refs.searchResultsList.hidden = false;
          } else {
            CityPreview.setSearchStatus(refs, I18nUtils.getTranslation("cityNotFound"), true);
          }
        })
        .catch((err) => {
          console.error(err);
          CityPreview.setSearchStatus(refs, I18nUtils.getTranslation("searchNetworkError"), true);
        })
        .finally(() => {
          refs.searchCityBtn.textContent = I18nUtils.getTranslation("searchBtn") || "Search";
          refs.searchCityBtn.style.pointerEvents = "auto";
        });
    };

    refs.searchCityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerSearch();
    });

    refs.searchCityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        triggerSearch();
      }
    });
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
