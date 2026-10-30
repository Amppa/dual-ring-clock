export const APP_VERSION = "2.5.2";

export const TimeMapperVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `TimeMapper v${APP_VERSION}`;
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.TimeMapperVersion = TimeMapperVersion;
}
