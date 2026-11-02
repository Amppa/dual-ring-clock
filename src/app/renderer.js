/**
 * TimeMapper - Mobile App UI Renderer
 */

import { State } from "../shared/state.js";
import { MapPreview } from "../shared/map-preview.js";
import { TimelinePreview } from "../shared/timeline-preview.js";

export const Renderer = {
  _mapRefs: null,
  _timelineRefs: null,

  getMapRefs() {
    if (!this._mapRefs) {
      this._mapRefs = MapPreview.collectRefs(document);
    }
    return this._mapRefs;
  },

  getTimelineRefs() {
    if (!this._timelineRefs) {
      this._timelineRefs = TimelinePreview.collectRefs(document);
    }
    return this._timelineRefs;
  },

  renderMapImmediate() {
    MapPreview.renderPinsImmediate(this.getMapRefs(), () => this.render());
  },

  renderMapDeferred() {
    const refs = this.getMapRefs();
    MapPreview.mountDeferredPins(refs);
    MapPreview.renderNightDecorations(refs, State.selectedOffsetHours);
  },

  renderRows() {
    TimelinePreview.renderRows(this.getTimelineRefs());
  },

  renderNightArea(offsetHours = 0, skipPinsUpdate = false) {
    MapPreview.renderNightArea(this.getMapRefs(), offsetHours, skipPinsUpdate);
  },

  applyVisibilitySettings() {
    MapPreview.applyVisibility(this.getMapRefs());
  },

  render() {
    State.makeBaseHours();
    this.renderMapImmediate();
    this.renderRows();
    const timelineRefs = this.getTimelineRefs();
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
    TimelinePreview.renderNowLine(this.getTimelineRefs());
  },

  renderScrubLine() {
    TimelinePreview.renderScrubLine(this.getTimelineRefs());
  },

  renderIntervals() {
    TimelinePreview.renderIntervals(this.getTimelineRefs());
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.Renderer = Renderer;
}

