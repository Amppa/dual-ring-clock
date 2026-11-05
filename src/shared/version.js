export const APP_VERSION = "0.2.2";

export const TimeMapperVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `TimeMapper v${APP_VERSION}`;
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.TimeMapperVersion = TimeMapperVersion;
}
