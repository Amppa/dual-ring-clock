const APP_VERSION = "0.2.3";

export const TimeMapperVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `TimeMapper v${APP_VERSION}`;
  }
};
