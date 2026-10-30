// src/shared/theme.js
// Applies the color theme to extension pages (popup/options) before first paint.
(() => {
  const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

  function resolve(theme) {
    if (theme === 'light' || theme === 'dark') return theme;
    return MEDIA.matches ? 'dark' : 'light';
  }

  function apply(theme) {
    const value = theme === 'light' || theme === 'dark' ? theme : 'auto';
    document.documentElement.dataset.theme = resolve(value);
    try {
      localStorage.setItem('theme', value);
    } catch { }
  }

  // Instant pass from synchronous cache
  try {
    apply(localStorage.getItem('theme') || 'auto');
  } catch {
    apply('auto');
  }

  // Follow OS theme changes while in auto mode
  MEDIA.addEventListener('change', () => {
    try {
      if ((localStorage.getItem('theme') || 'auto') === 'auto') {
        apply('auto');
      }
    } catch { }
  });

  // Follow theme updates from options / other extension pages
  window.addEventListener('storage', (e) => {
    if (!e || e.key === 'theme') {
      try {
        apply(localStorage.getItem('theme') || 'auto');
      } catch {
        apply('auto');
      }
    }
  });

  globalThis.TimeMapperTheme = { apply, resolve };
})();
