import { State } from "../shared/state.js";
import { Renderer } from "./renderer.js";
import { I18nUtils } from "../shared/utils.js";
import { TimelinePreview } from "../shared/timeline-preview.js";
import { MapPreview } from "../shared/map-preview.js";
import { SettingsController } from "./settings-controller.js";

const homeView = document.getElementById("homeView");
const settingsView = document.getElementById("settingsView");
const bottomBar = document.querySelector(".bottom-bar");
const navIndicator = document.querySelector(".bottom-bar-indicator");
const viewButtons = Array.from(document.querySelectorAll(".bottom-bar-item"));
let currentView = "home";

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
  currentView = view;
  const isSettings = view === "settings";
  homeView.hidden = isSettings;
  settingsView.hidden = !isSettings;

  viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  syncNavIndicator();

  if (isSettings) {
    SettingsController.refresh();
  } else {
    Renderer.render();
  }
}

function openSettings() {
  if (currentView === "settings") return;
  history.pushState({ view: "settings" }, "", location.href);
  showView("settings");
}

function closeSettings() {
  if (currentView !== "settings") return;
  history.back();
}

async function init() {
  await State.init();
  applyTheme();
  I18nUtils.applyAttributes();

  Renderer.render();
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
      if (button.dataset.view === "settings") openSettings();
      else closeSettings();
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
    showView(event.state?.view === "settings" ? "settings" : "home");
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      applyTheme();
      Renderer.render();
    }
  });

  window.addEventListener("themechange", () => {
    if (currentView === "settings") {
      SettingsController.renderAppearance();
      SettingsController.renderPeriodControls();
    }
    Renderer.render();
  });

  history.replaceState({ view: "home" }, "", location.href);

  // Minute ticker for current time & now-line
  setInterval(() => {
    if (currentView === "home") Renderer.render();
  }, 60 * 1000);
}

init();
