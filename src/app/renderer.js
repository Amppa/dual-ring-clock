/**
 * TimeMapper - Mobile App UI Renderer
 */

import { State } from "../shared/state.js";
import { TimeUtils, TimelineUtils } from "../shared/utils.js";
import { MapPreview } from "../shared/map-preview.js";
import { TimelinePreview } from "../shared/timeline-preview.js";

export const Renderer = {
  renderNowText() {
    const el = document.getElementById("nowText");
    if (!el) return;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}/${month}/${day}`;
    const timeStr = TimeUtils.formatTime(now, localZone);
    el.innerHTML = `<span class="now-time">${timeStr}</span><span class="now-date">${dateStr}</span>`;
  },

  renderMapImmediate() {
    MapPreview.renderPinsImmediate(MapPreview.collectRefs(document), () => Renderer.render());
  },

  renderMapDeferred() {
    const refs = MapPreview.collectRefs(document);
    MapPreview.mountDeferredPins(refs);
    MapPreview.renderNightDecorations(refs, State.selectedOffsetHours);
  },

  renderRows() {
    TimelinePreview.renderRows(TimelinePreview.collectRefs(document));
  },

  renderNightArea(offsetHours = 0, skipPinsUpdate = false) {
    MapPreview.renderNightArea(MapPreview.collectRefs(document), offsetHours, skipPinsUpdate);
  },

  applyVisibilitySettings() {
    MapPreview.applyVisibility(MapPreview.collectRefs(document));
  },

  render() {
    State.makeBaseHours();
    this.renderNowText();
    this.renderMapImmediate();
    this.renderRows();
    const timelineRefs = TimelinePreview.collectRefs(document);
    TimelinePreview.renderNowLine(timelineRefs);
    TimelinePreview.renderScrubLine(timelineRefs);
    this.renderNightArea(State.selectedOffsetHours, true);
    this.applyVisibilitySettings();

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => this.renderMapDeferred(), { timeout: 1000 });
    } else {
      setTimeout(() => this.renderMapDeferred(), 0);
    }
  },

  renderNowLine() {
    TimelinePreview.renderNowLine(TimelinePreview.collectRefs(document));
  },

  renderScrubLine() {
    TimelinePreview.renderScrubLine(TimelinePreview.collectRefs(document));
  },

  renderIntervals() {
    TimelinePreview.renderIntervals(TimelinePreview.collectRefs(document));
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.Renderer = Renderer;
}

