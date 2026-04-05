/**
 * Modern Dashboard - Theme Management
 * Handles theme persistence
 */

const THEME_STORAGE_KEY = 'dashboard.theme.v1';

/**
 * Initialize theme from localStorage or system preference
 */
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  // Remove no-transition class after initial theme is set
  setTimeout(() => {
    document.body.classList.remove('no-transition');
  }, 100);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Set theme (light or dark)
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Get current theme
 * @returns {string} 'light' or 'dark'
 */
export function getCurrentTheme() {
  return document.body.dataset.theme || 'light';
}
