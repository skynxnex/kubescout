/**
 * ThemeAnimations — Fas 6
 *
 * Headless Vue component that controls canvas/DOM animations
 * in response to theme changes. The animation modules themselves
 * are NOT modified — this component is the lifecycle bridge.
 *
 * Animations that require a canvas:
 *   matrix   -> initMatrixRain / stopMatrixRain
 *   starwars -> initStarfield  / stopStarfield
 *   autumn   -> initAutumnLeaves / stopAutumnLeaves
 *
 * All animation modules check prefers-reduced-motion internally,
 * so we never need to duplicate that check here.
 *
 * CDN-Vue pattern: defineComponent from global window.Vue.
 */

import { initMatrixRain,   stopMatrixRain,   isMatrixRainActive  } from '../modules/matrix-rain.js';
import { initStarfield,    stopStarfield,    isStarfieldActive   } from '../modules/starfield.js';
import { initAutumnLeaves, stopAutumnLeaves, isAutumnLeavesActive } from '../modules/autumn-leaves.js';

const { defineComponent, watch, onMounted, onBeforeUnmount } = Vue;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Stop whichever animations are currently running.
 * Safe to call even when nothing is running.
 */
function stopAllAnimations() {
  if (isMatrixRainActive())   stopMatrixRain();
  if (isAutumnLeavesActive()) stopAutumnLeaves();
  if (isStarfieldActive())    stopStarfield();
}

/**
 * Start the animation that belongs to a theme.
 * Themes without a canvas animation (cyberpunk, summer, crimson) do nothing.
 */
function startAnimationForTheme(theme) {
  if (theme === 'matrix')   initMatrixRain();
  if (theme === 'autumn')   initAutumnLeaves();
  if (theme === 'starwars') initStarfield();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ThemeAnimations = defineComponent({
  name: 'ThemeAnimations',

  props: {
    /** Current theme name, e.g. 'matrix', 'cyberpunk' */
    theme: {
      type: String,
      required: true,
    },
  },

  setup(props) {
    // On mount: start the animation for the initial theme (restored from
    // localStorage on page load). The vanilla JS initThemeSelector() also
    // calls handleThemeAnimations() on DOMContentLoaded, so we guard with a
    // small delay to avoid double-init races.
    onMounted(() => {
      // Allow vanilla JS DOMContentLoaded handlers to run first, then
      // check whether an animation is already running before starting one.
      setTimeout(() => {
        const alreadyRunning =
          isMatrixRainActive() || isAutumnLeavesActive() || isStarfieldActive();

        if (!alreadyRunning) {
          startAnimationForTheme(props.theme);
        }
      }, 150);
    });

    // Watch for theme changes driven by the Vue ThemeSelector.
    // Stop the previous animation and start the new one immediately.
    watch(
      () => props.theme,
      (newTheme, oldTheme) => {
        if (newTheme === oldTheme) return;
        console.log(`[ThemeAnimations] Theme changed: ${oldTheme} -> ${newTheme}`);
        stopAllAnimations();
        startAnimationForTheme(newTheme);
      }
    );

    onBeforeUnmount(() => {
      stopAllAnimations();
    });

    // Render nothing — this is a behaviour-only component
    return () => null;
  },
});
