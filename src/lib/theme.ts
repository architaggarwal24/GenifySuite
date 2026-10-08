export const THEME_STORAGE_KEY = "genifysuite-theme";

export type Theme = "dark" | "light";

// Runs synchronously in <head>, before hydration, so the correct theme is
// applied before first paint (no flash of the wrong theme). Kept as a
// plain string (rather than a function toString()'d) so minifiers can't
// mangle identifier names inside it.
export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
`;
