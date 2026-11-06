const APP_VERSION = "1.0.0";

export const AppVersion = {
  render(el) {
    if (!el) return;
    el.textContent = `DualRing Clock v${APP_VERSION}`;
  }
};

export const TimeMapperVersion = AppVersion;
