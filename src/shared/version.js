const APP_VERSION = "0.2.5";

export const AppVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `DualRing Clock v${APP_VERSION}`;
  }
};

export const TimeMapperVersion = AppVersion;
