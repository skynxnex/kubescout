/**
 * ThemeSelector — Fas 6
 *
 * Vue dropdown for switching between the 6 visual themes.
 * This is a separate element from the vanilla JS #themeSelect — both can
 * coexist without conflict because:
 *   - Vanilla JS #themeSelect calls onThemeChange() which does a full page reload.
 *   - This component swaps the CSS link in-place and dispatches to themeStore
 *     WITHOUT reloading — giving an instant, smooth switch in the Vue layer.
 *   - Both read/write the same localStorage key so the choice is always consistent.
 *
 * CDN-Vue pattern: defineComponent from global window.Vue.
 */

import { useThemeStore } from '../stores/themeStore.js';

const { defineComponent, h } = Vue;

// ---------------------------------------------------------------------------
// Theme metadata
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'summer',    label: 'Summer'    },
  { value: 'starwars',  label: 'Star Wars' },
  { value: 'matrix',    label: 'Matrix'    },
  { value: 'autumn',    label: 'Autumn'    },
  { value: 'crimson',   label: 'Crimson'   },
];

// CSS swap is now owned by themeStore.swapThemeCSS — no local copy needed.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ThemeSelector = defineComponent({
  name: 'ThemeSelector',

  setup() {
    const store = useThemeStore();

    function onChange(e) {
      const newTheme = e.target.value;
      // store.setTheme() now handles both state + CSS swap
      store.setTheme(newTheme);
      // Also sync the vanilla JS #themeSelect so it stays consistent
      // (does NOT trigger onThemeChange — we manage the change ourselves)
      const vanillaSelect = document.getElementById('themeSelect');
      if (vanillaSelect && vanillaSelect.value !== newTheme) {
        vanillaSelect.value = newTheme;
      }
    }

    return () =>
      h('div', { class: 'input-group' }, [
        h('label', { for: 'vueThemeSelect' }, 'Theme:'),
        h('div', { class: 'select-container' }, [
          h('select', {
            id: 'vueThemeSelect',
            class: 'cyber-select',
            value: store.currentTheme.value,
            onChange,
          },
            THEME_OPTIONS.map(opt =>
              h('option', {
                value: opt.value,
                selected: opt.value === store.currentTheme.value,
              }, opt.label)
            )
          ),
          h('div', { class: 'select-icon' },
            h('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              width: '16', height: '16',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
            },
              h('polyline', { points: '6 9 12 15 18 9' })
            )
          ),
        ]),
      ]);
  },
});
