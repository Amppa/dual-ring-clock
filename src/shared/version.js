const APP_VERSION = "0.2.4";

export const TimeMapperVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `TimeMapper v${APP_VERSION}`;
  }
};
