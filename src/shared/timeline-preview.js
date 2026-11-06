/**
 * TimeMapper - Shared Timeline Rendering Module
 */

import { State } from "./state.js";
import { CONFIG } from "./config.js";
import { MathUtils, PeriodUtils, TimeUtils, I18nUtils, EscapeUtils, TimelineUtils } from "./utils.js";

export const TimelinePreview = {
  /**
   * Collect the nodes this module renders into.
   */
  collectRefs(root) {
    const q = (sel) => root.querySelector(sel);
    return {
      timelinePanel: q(".timeline-panel"),
      timelineTrackOverlay: q("#timelineTrackOverlay"),
      timelineRows: q("#timelineRows"),
      timelineIntervalsContainer: q("#timelineIntervalsContainer"),
      nowLine: q("#nowLine"),
      scrubLinesContainer: q("#scrubLinesContainer"),
    };
  },

  renderRows(refs) {
    if (!refs.timelineRows) return;
    refs.timelineRows.innerHTML = "";

    const rowsFrag = document.createDocumentFragment();

    State.selectedIds.forEach((id) => {
      const city = State.findCity(id);
      if (!city) return;
      const row = document.createElement("article");
      row.className = "timeline-row";

      const label = document.createElement("div");
      label.className = "city-label";

      const cityName = I18nUtils.getCityName(city);
      const labelText = document.createElement("div");
      labelText.className = "city-label-text";
      labelText.innerHTML = `<span class="city-name">${EscapeUtils.html(cityName)}</span><span class="city-time">${TimeUtils.utcOffsetText(new Date(), city.zone)} · ${TimeUtils.formatTime(new Date(), city.zone)}</span>`;

      label.append(labelText);

      const hours = document.createElement("div");
      hours.className = "hours";

      // Calculate offset difference in hours relative to the first (reference) city
      const firstCity = State.selectedIds.length > 0 ? State.findCity(State.selectedIds[0]) : null;
      const refZone = firstCity ? firstCity.zone : Intl.DateTimeFormat().resolvedOptions().timeZone;
      const refOffset = TimeUtils.getOffsetMinutes(State.baseHours[0], refZone);
      const cityOffset = TimeUtils.getOffsetMinutes(State.baseHours[0], city.zone);
      const diffHours = (cityOffset - refOffset) / 60;
      const I = Math.floor(diffHours);
      const F = diffHours - I;

      // Render 25 cells if there's a fractional hour offset, otherwise 24
      const numCells = F > 0 ? 25 : 24;
      const hoursFrag = document.createDocumentFragment();

      const startDate = new Date(State.baseHours[0].getTime() - F * 3600000);
      const startHour = TimeUtils.hourInZone(startDate, city.zone);
      let currentDateStr = TimeUtils.dateInZone(startDate, city.zone);

      for (let index = 0; index < numCells; index++) {
        const cityHour = (startHour + index) % 24;
        const cell = document.createElement("div");
        cell.className = "hour-cell";
        cell.dataset.index = String(index);
        const hourStr = String(cityHour).padStart(2, "0");
        const hourLabel = document.createElement("span");
        hourLabel.className = "hour-label";
        hourLabel.textContent = hourStr;
        cell.append(hourLabel);
        cell.title = `${cityName} ${hourStr}:00`;

        // Show date badge at the transition of the day (00:00) OR at the very first cell (index 0)
        if (cityHour === 0 || index === 0) {
          if (cityHour === 0 && index > 0) {
            const cellDate = new Date(startDate.getTime() + index * 3600000);
            currentDateStr = TimeUtils.dateInZone(cellDate, city.zone);
          }
          const dateBadge = document.createElement("span");
          dateBadge.className = "date-badge";
          dateBadge.textContent = currentDateStr;
          cell.appendChild(dateBadge);
        }

        const styleInfo = PeriodUtils.getHourStyle(cityHour);
        cell.style.backgroundColor = styleInfo.color;
        cell.style.color = styleInfo.fontColor;

        if (index === 0) {
          cell.style.marginLeft = `calc(-${F} * 100% / 24)`;
        }

        hoursFrag.append(cell);
      }

      hours.append(hoursFrag);
      row.append(label, hours);
      rowsFrag.append(row);
    });

    refs.timelineRows.append(rowsFrag);
  },

  renderNowLine(refs) {
    if (!refs.nowLine) return;
    const fraction = TimelineUtils.getNowFraction();
    refs.nowLine.style.display = "";
    refs.nowLine.style.left = `${(fraction * 100).toFixed(4)}%`;

    let topKnob = refs.nowLine.querySelector(".now-knob-top");
    if (!topKnob) {
      refs.nowLine.innerHTML = `
        <div class="timeline-knob now-knob-top"><span class="knob-icon">📍</span><span class="knob-time"></span></div>
        <div class="timeline-knob-bottom now-knob-bottom"></div>
      `;
      topKnob = refs.nowLine.querySelector(".now-knob-top");
    }
    const timeEl = topKnob.querySelector(".knob-time");
    if (timeEl) {
      timeEl.textContent = TimelineUtils.formatFractionTime(fraction);
    }
    this.renderIntervals(refs);
  },

  renderScrubLine(refs) {
    if (!refs.scrubLinesContainer) return;

    const draggingScrubId = refs.scrubLinesContainer.querySelector(".scrub-line-group.is-dragging")?.dataset.id;
    refs.scrubLinesContainer.innerHTML = "";
    const scrubFrag = document.createDocumentFragment();

    State.scrubs.forEach((scrub) => {
      const isDragging = (scrub.id === draggingScrubId);

      // Create line group
      const group = document.createElement("div");
      group.className = "scrub-line-group";
      if (isDragging) group.classList.add("is-dragging");
      group.dataset.id = scrub.id;
      group.style.left = `${(scrub.fraction * 100).toFixed(4)}%`;

      // Create dashed vertical line
      const line = document.createElement("div");
      line.className = "timeline-vline scrub-line";
      if (isDragging) {
        line.classList.add("is-dragging");
      }

      // Create drag handle
      const handle = document.createElement("div");
      handle.className = "scrub-handle";
      if (isDragging) {
        handle.classList.add("is-dragging");
      }
      handle.setAttribute("aria-label", I18nUtils.getTranslation("dragScrubAria"));

      // Top knob with time and delete button [ HH:mm × ]
      const topKnob = document.createElement("div");
      topKnob.className = "timeline-knob scrub-knob-top";
      if (isDragging) topKnob.classList.add("is-dragging");

      const timeSpan = document.createElement("span");
      timeSpan.className = "knob-time";
      timeSpan.textContent = TimelineUtils.formatFractionTime(scrub.fraction);

      const removeTitle = I18nUtils.getTranslation("removeScrubLine");

      const resetBtn = document.createElement("button");
      resetBtn.className = "scrub-reset-btn";
      resetBtn.type = "button";
      resetBtn.title = removeTitle;
      resetBtn.setAttribute("aria-label", removeTitle);
      resetBtn.textContent = "×";

      topKnob.appendChild(timeSpan);
      topKnob.appendChild(resetBtn);

      // Bottom knob
      const bottomKnob = document.createElement("div");
      bottomKnob.className = "timeline-knob-bottom scrub-knob-bottom";
      if (isDragging) bottomKnob.classList.add("is-dragging");

      group.appendChild(line);
      group.appendChild(handle);
      group.appendChild(topKnob);
      group.appendChild(bottomKnob);

      scrubFrag.appendChild(group);
    });

    refs.scrubLinesContainer.appendChild(scrubFrag);
    this.renderIntervals(refs);
  },

  /**
   * Render interval indicators between adjacent markers (Scrub lines + Now line).
   * Values rounded to nearest 0.5h (e.g. 0.5h, 1h, 1.5h, 2h).
   */
  renderIntervals(refs) {
    if (!refs || !refs.timelineIntervalsContainer || !refs.timelinePanel) return;
    const container = refs.timelineIntervalsContainer;
    container.innerHTML = "";

    const markers = [];

    // 1. Now Line (if visible/laid out)
    const nowFraction = TimelineUtils.getNowFraction();
    markers.push({ type: "now", fraction: nowFraction });

    // 2. User scrub lines
    if (Array.isArray(State.scrubs)) {
      State.scrubs.forEach((scrub) => {
        markers.push({ type: "scrub", id: scrub.id, fraction: scrub.fraction });
      });
    }

    if (markers.length < 2) return;

    // Sort left to right by fraction
    markers.sort((a, b) => a.fraction - b.fraction);

    for (let i = 0; i < markers.length - 1; i++) {
      const m1 = markers[i];
      const m2 = markers[i + 1];

      const diffHours = (m2.fraction - m1.fraction) * 24;
      const roundedHours = Math.round(diffHours * 2) / 2;

      let text;
      if (diffHours === 0) {
        text = "0h";
      } else if (diffHours < 0.25) {
        text = "<0.5h";
      } else {
        text = `${roundedHours}h`;
      }

      const span = document.createElement("div");
      span.className = "timeline-interval-span";
      span.style.left = `${(m1.fraction * 100).toFixed(4)}%`;
      span.style.width = `${Math.max(0, (m2.fraction - m1.fraction) * 100).toFixed(4)}%`;

      const pill = document.createElement("div");
      pill.className = "timeline-interval-pill";
      pill.textContent = text;

      span.appendChild(pill);
      container.appendChild(span);
    }
  },

  /**
   * Click-to-add / drag / remove scrub lines.
   * `api.renderScrubLine()` repaints scrub markers,
   * `api.renderNightArea(offsetHours)` follows with the night ref curve.
   */
  wireScrub(refs, api) {
    if (!refs.scrubLinesContainer || !refs.timelinePanel) return;
    let isDragging = false;
    let activeDragScrubId = null;
    let activePointerId = null;
    let cachedOverlayRect = null;

    const getOverlay = () =>
      refs.timelineTrackOverlay ||
      refs.timelinePanel.querySelector(".timeline-track-overlay") ||
      refs.timelinePanel;

    const calcFraction = (clientX) => {
      if (!cachedOverlayRect || cachedOverlayRect.width <= 0) return 0;
      const raw = MathUtils.clamp((clientX - cachedOverlayRect.left) / cachedOverlayRect.width, 0, 1);
      return TimelineUtils.snapToFiveMinutes(raw);
    };

    // --- Interaction 1 & 2: Click/Drag timeline to add or drag scrub-line ---
    refs.timelinePanel.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".scrub-reset-btn")) return; // Let close button handler work

      const handle = e.target.closest(".scrub-handle, .scrub-knob-top, .scrub-knob-bottom");
      const hoursGrid = e.target.closest(".hours");
      const overlayEl = e.target.closest(".timeline-track-overlay");
      const cityLabel = e.target.closest(".app-mobile .city-label");
      if (!handle && !hoursGrid && !overlayEl && !cityLabel) return;

      const overlay = getOverlay();
      cachedOverlayRect = overlay.getBoundingClientRect();

      let targetScrubId = null;
      let fraction = null;

      if (handle) {
        // Drag existing scrub line
        const group = handle.closest(".scrub-line-group");
        if (!group) return;
        targetScrubId = group.dataset.id;

        const scrub = State.scrubs.find(s => s.id === targetScrubId);
        if (scrub) {
          fraction = scrub.fraction;
        }
      } else {
        // Press to create a new scrub-line and start dragging immediately
        if (State.scrubs && State.scrubs.length >= CONFIG.maxScrubs) {
          return;
        }

        fraction = calcFraction(e.clientX);

        const newScrub = {
          id: `scrub_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          fraction: fraction
        };
        State.scrubs.push(newScrub);
        targetScrubId = newScrub.id;

        // Render the newly created scrub line
        State.activeScrubId = targetScrubId;
        api.renderScrubLine();
      }

      if (targetScrubId) {
        activeDragScrubId = targetScrubId;
        State.activeScrubId = targetScrubId;
        isDragging = true;
        activePointerId = e.pointerId;

        // Apply dragging visual styles
        refs.scrubLinesContainer.querySelectorAll(".scrub-line-group, .scrub-line, .scrub-handle, .scrub-knob-top, .scrub-knob-bottom").forEach((el) => {
          el.classList.remove("is-dragging");
        });

        const group = refs.timelinePanel.querySelector(`.scrub-line-group[data-id="${targetScrubId}"]`);
        if (group) {
          group.classList.add("is-dragging");
          const lineEl = group.querySelector(".scrub-line");
          const handleEl = group.querySelector(".scrub-handle");
          const knobEl = group.querySelector(".scrub-knob-top");
          const bottomEl = group.querySelector(".scrub-knob-bottom");
          if (lineEl) lineEl.classList.add("is-dragging");
          if (handleEl) handleEl.classList.add("is-dragging");
          if (knobEl) knobEl.classList.add("is-dragging");
          if (bottomEl) bottomEl.classList.add("is-dragging");
        }

        e.preventDefault();
        refs.timelinePanel.setPointerCapture?.(e.pointerId);
      }
    });

    let dragRafId = null;
    let pendingClientX = null;

    document.addEventListener("pointermove", (e) => {
      if (!isDragging || !activeDragScrubId || e.pointerId !== activePointerId) return;
      pendingClientX = e.clientX;
      if (dragRafId !== null) return;

      dragRafId = requestAnimationFrame(() => {
        dragRafId = null;
        if (!isDragging || !activeDragScrubId || pendingClientX === null) return;

        const fraction = calcFraction(pendingClientX);

        // Update fraction in state
        const scrub = State.scrubs.find(s => s.id === activeDragScrubId);
        if (scrub && scrub.fraction !== fraction) {
          scrub.fraction = fraction;

          // Update position of group element directly for performance
          const group = refs.timelinePanel.querySelector(`.scrub-line-group[data-id="${activeDragScrubId}"]`);
          if (group) {
            group.style.left = `${(fraction * 100).toFixed(4)}%`;
            const timeEl = group.querySelector(".knob-time");
            if (timeEl) {
              timeEl.textContent = TimelineUtils.formatFractionTime(fraction);
            }
          }

          // Live-update map timeline, ref lines, and intervals
          api.renderNightArea(State.selectedOffsetHours);
          this.renderIntervals(refs);
        }
      });
    });

    const stopDragging = (e) => {
      if (e.pointerId !== activePointerId) return;
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      pendingClientX = null;
      if (isDragging) {
        isDragging = false;
        activeDragScrubId = null;
        cachedOverlayRect = null;
        if (refs.scrubLinesContainer) {
          refs.scrubLinesContainer.querySelectorAll(".scrub-line-group, .scrub-line, .scrub-handle, .scrub-knob-top, .scrub-knob-bottom").forEach((el) => {
            el.classList.remove("is-dragging");
          });
        }
      }
      if (refs.timelinePanel.hasPointerCapture?.(e.pointerId)) {
        refs.timelinePanel.releasePointerCapture(e.pointerId);
      }
      activePointerId = null;
    };

    document.addEventListener("pointerup", stopDragging);
    document.addEventListener("pointercancel", stopDragging);

    // --- Interaction 3: Click [x] to remove scrub-line (Event Delegation) ---
    refs.timelinePanel.addEventListener("click", (e) => {
      const btn = e.target.closest(".scrub-reset-btn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const group = btn.closest(".scrub-line-group");
      if (!group) return;

      const scrubId = group.dataset.id;

      // Remove from State
      State.scrubs = State.scrubs.filter(s => s.id !== scrubId);

      // Re-assign activeScrubId if the removed one was active
      if (State.activeScrubId === scrubId) {
        if (State.scrubs.length > 0) {
          State.activeScrubId = State.scrubs[State.scrubs.length - 1].id;
        } else {
          State.activeScrubId = null;
        }
      }

      // Redraw UI
      api.renderScrubLine();
      api.renderNightArea(State.selectedOffsetHours);
    });
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.TimelinePreview = TimelinePreview;
}
