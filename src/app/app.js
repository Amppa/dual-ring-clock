import { State } from "../shared/state.js";
import { Renderer } from "./renderer.js";
import { I18nUtils } from "../shared/utils.js";
import { TimelinePreview } from "../shared/timeline-preview.js";
import { MapPreview } from "../shared/map-preview.js";
import { SettingsController } from "./settings-controller.js";
import { ClockView } from "./clock.js";

const clockView = document.getElementById("clockView");
const timelineView = document.getElementById("timelineView");
const settingsView = document.getElementById("settingsView");
const views = { clock: clockView, timeline: timelineView, settings: settingsView };
const bottomBar = document.querySelector(".bottom-bar");
const navIndicator = document.querySelector(".bottom-bar-indicator");
const viewButtons = Array.from(document.querySelectorAll(".bottom-bar-item"));
let currentView = "clock";

function syncNavIndicator() {
  if (!bottomBar || !navIndicator) return;
  const active = viewButtons.find((button) => button.classList.contains("is-active"));
  if (!active) return;
  const navRect = bottomBar.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const borderLeft = parseFloat(getComputedStyle(bottomBar).borderLeftWidth) || 0;
  navIndicator.style.width = `${activeRect.width}px`;
  navIndicator.style.transform = `translateX(${activeRect.left - navRect.left - borderLeft}px)`;
}

function applyTheme() {
  if (globalThis.TimeMapperTheme) {
    document.documentElement.dataset.theme =
      TimeMapperTheme.resolve(localStorage.getItem("theme") || "auto");
  }
}

function showView(view) {
  currentView = views[view] ? view : "clock";
  Object.entries(views).forEach(([name, el]) => {
    el.hidden = name !== currentView;
  });

  viewButtons.forEach((button) => {
    const active = button.dataset.view === currentView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  syncNavIndicator();

  if (currentView === "settings") {
    SettingsController.refresh();
  } else if (currentView === "timeline") {
    Renderer.render();
  } else if (currentView === "clock") {
    ClockView.render();
  }
}

function setView(view) {
  if (!views[view] || currentView === view) return;
  history.pushState({ view }, "", location.href);
  showView(view);
}

async function init() {
  await State.init();
  applyTheme();
  I18nUtils.applyAttributes();

  Renderer.render();
  ClockView.init();
  SettingsController.init();

  TimelinePreview.wireScrub(TimelinePreview.collectRefs(document), {
    renderScrubLine: () => Renderer.renderScrubLine(),
    renderNightArea: (offsetHours) => Renderer.renderNightArea(offsetHours)
  });

  MapPreview.wireMapClick(MapPreview.collectRefs(document), () => {
    Renderer.render();
    if (currentView === "settings") SettingsController.renderCities();
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  syncNavIndicator();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => bottomBar?.classList.add("is-ready"));
  });
  window.addEventListener("resize", syncNavIndicator);
  if (typeof ResizeObserver === "function") {
    const navResizeObserver = new ResizeObserver(syncNavIndicator);
    viewButtons.forEach((button) => navResizeObserver.observe(button));
  }

  window.addEventListener("popstate", (event) => {
    showView(event.state?.view || "clock");
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      applyTheme();
      Renderer.render();
      if (currentView === "clock") ClockView.render();
    }
  });

  window.addEventListener("themechange", () => {
    if (currentView === "settings") {
      SettingsController.renderAppearance();
      SettingsController.renderPeriodControls();
    }
    Renderer.render();
  });

  history.replaceState({ view: "clock" }, "", location.href);

  function tickMinute() {
    if (currentView === "timeline") Renderer.render();
    else if (currentView === "clock") ClockView.render();
  }

  function scheduleMinuteTick() {
    const delay = 60 * 1000 - (Date.now() % (60 * 1000));
    setTimeout(() => {
      tickMinute();
      scheduleMinuteTick();
    }, delay);
  }
  scheduleMinuteTick();
}

init();
