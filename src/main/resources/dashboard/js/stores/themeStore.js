/**
 * Theme Store — Fas 6
 *
 * Singleton composable store for the 6 visual themes.
 * Uses the same localStorage key as main.js (THEME_STORAGE_KEY = 'dashboard.theme.v1')
 * so vanilla JS and Vue always read/write the same persisted value.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { ref } = Vue;

// ---------------------------------------------------------------------------
// Constants — must stay in sync with main.js
// ---------------------------------------------------------------------------

const THEME_STORAGE_KEY = 'dashboard.theme.v1';

const VALID_THEMES = ['cyberpunk', 'summer', 'starwars', 'matrix', 'autumn', 'crimson'];

// Must stay in sync with THEME_ICONS in main.js
const THEME_ICONS = {
  cyberpunk: '🤖',
  summer:    '☀️',
  starwars:  '⭐',
  matrix:    '💚',
  autumn:    '🍂',
  crimson:   '🔴',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readThemeFromStorage() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && VALID_THEMES.includes(saved)) return saved;
  } catch {
    // ignore — localStorage unavailable
  }
  return 'cyberpunk';
}

function writeThemeToStorage(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Singleton state — created once, shared across all useThemeStore() calls
// ---------------------------------------------------------------------------

const currentTheme = ref(readThemeFromStorage());

// ---------------------------------------------------------------------------
// CSS swap helper
// Mirrors updateThemeCSS() / swapThemeCSS() from ThemeSelector.js so that
// the boot path in vue-app.js can apply the saved theme without importing
// the full ThemeSelector component.
// ---------------------------------------------------------------------------

/**
 * Swap the active theme CSS link and set the data-theme attribute on <body>.
 * Safe to call before Vue mounts — works purely on the DOM.
 *
 * @param {string} theme - one of VALID_THEMES
 */
function swapThemeCSS(theme) {
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  const themeLink = Array.from(links).find(link => link.href.includes('/css/themes/'));
  if (themeLink) {
    const newHref = themeLink.href.replace(/\/themes\/[^/?]+\.css/, `/themes/${theme}.css`);
    if (themeLink.href !== newHref) {
      themeLink.href = newHref;
      console.log(`[ThemeStore] CSS swapped to ${theme}`);
    }
  } else {
    console.warn('[ThemeStore] Could not find theme CSS link');
  }
  document.body.setAttribute('data-theme', theme);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Update the #themeBadge element with the emoji for the given theme.
 * Mirrors updateThemeBadge() in main.js.
 *
 * @param {string} theme - one of VALID_THEMES
 */
function updateThemeBadge(theme) {
  const badge = document.getElementById('themeBadge');
  if (!badge) return;
  badge.textContent = THEME_ICONS[theme] || '🎨';
}

/**
 * Persist a new theme choice, update reactive state, and swap the CSS link.
 * Callers no longer need to call swapThemeCSS separately.
 *
 * @param {string} themeName - one of VALID_THEMES
 */
function setTheme(themeName) {
  if (!VALID_THEMES.includes(themeName)) return;
  currentTheme.value = themeName;
  writeThemeToStorage(themeName);
  swapThemeCSS(themeName);
  updateThemeBadge(themeName);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function useThemeStore() {
  return {
    currentTheme,
    setTheme,
    swapThemeCSS,
    updateThemeBadge,
    VALID_THEMES,
    THEME_STORAGE_KEY,
  };
}
