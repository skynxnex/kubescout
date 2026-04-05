/**
 * Vue 3 Component: FilterControls
 * Renders the filter panel (prefix, search, checkboxes, sort).
 *
 * Fas 2: connected to dashboardStore. All inputs are controlled via store
 * refs. Emits 'filters-changed' after any update so parent can react.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { useDashboardStore } from '../stores/dashboardStore.js';
import { ThemeSelector } from './ThemeSelector.js';

const { defineComponent, h, computed } = Vue;

// ---------------------------------------------------------------------------
// Reusable chevron SVG for select elements — SAFE: hardcoded
// Returns a fresh vnode each call — Vue 3 vnodes must not be reused across
// multiple render positions.
// ---------------------------------------------------------------------------
function chevronSvg() {
  return h('div', { class: 'select-icon' },
    h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, h('polyline', { points: '6 9 12 15 18 9' }))
  );
}

// ---------------------------------------------------------------------------
// SelectGroup helper (internal — not exported)
// ---------------------------------------------------------------------------

function SelectGroup({ id, label, options, value, onChange }) {
  const selectEl = h('div', { class: 'select-container' }, [
    h('select', {
      id,
      class: 'cyber-select',
      value,
      onChange
    }, options.map(opt =>
      h('option', { value: opt.value, selected: opt.value === value }, opt.label)
    )),
    chevronSvg()
  ]);

  if (!label) return selectEl;

  return h('div', { class: 'input-group' }, [
    h('label', { for: id }, label),
    selectEl
  ]);
}

// ---------------------------------------------------------------------------
// FilterControls component
// ---------------------------------------------------------------------------

export const FilterControls = defineComponent({
  name: 'FilterControls',

  /**
   * Props received from parent (vue-app.js passes store state as props so the
   * parent can observe filter changes without tight coupling).
   *
   * Fas 2: All filter props are optional — the component reads store directly
   * and uses props only as a documentation contract.
   */
  props: {
    availableContexts:   { type: Array,   default: () => [] },
    availableNamespaces: { type: Array,   default: () => [] },
  },

  emits: ['filters-changed'],

  setup(props, { emit }) {
    const store = useDashboardStore();

    // Derived: context options list
    const contextOptions = computed(() =>
      store.availableContexts.value.length > 0
        ? store.availableContexts.value.map(c => ({ value: c, label: c }))
        : [{ value: '', label: 'Loading...' }]
    );

    // Notify parent after a store ref changes and emit the current filter snapshot
    function notifyChange() {
      emit('filters-changed', {
        prefix:             store.prefix.value,
        search:             store.search.value,
        showBad:            store.showBad.value,
        showWarn:           store.showWarn.value,
        showSingle:         store.showSingle.value,
        showRestarts:       store.showRestarts.value,
        minRestarts:        store.minRestarts.value,
        sortField:          store.sortField.value,
        sortDir:            store.sortDir.value,
        context:            store.context.value,
        selectedNamespaces: store.selectedNamespaces.value,
      });
    }

    // Individual update handlers — each writes to store then emits
    function onContextChange(e) {
      // Delegate to store action: updates context, fetches namespaces, re-fetches services
      store.onContextChange(e.target.value).then(() => notifyChange());
    }

    function onPrefixInput(e) {
      store.prefix.value = e.target.value;
      notifyChange();
    }

    function onSearchInput(e) {
      store.search.value = e.target.value;
      notifyChange();
    }

    function onSearchClear() {
      store.search.value = '';
      notifyChange();
    }

    function onFilterBadChange(e) {
      store.showBad.value = e.target.checked;
      notifyChange();
    }

    function onFilterWarnChange(e) {
      store.showWarn.value = e.target.checked;
      notifyChange();
    }

    function onFilterSingleChange(e) {
      store.showSingle.value = e.target.checked;
      notifyChange();
    }

    function onFilterRestartsChange(e) {
      store.showRestarts.value = e.target.checked;
      notifyChange();
    }

    function onMinRestartsInput(e) {
      const val = parseInt(e.target.value, 10);
      store.minRestarts.value = isNaN(val) ? 1 : Math.max(1, val);
      notifyChange();
    }

    function onSortFieldChange(e) {
      store.sortField.value = e.target.value;
      notifyChange();
    }

    function onSortDirChange(e) {
      store.sortDir.value = e.target.value;
      notifyChange();
    }

    function onRefresh() {
      emit('filters-changed', { _action: 'refresh' });
    }

    function onReset() {
      store.prefix.value       = 'app-';
      store.search.value       = '';
      store.showBad.value      = false;
      store.showWarn.value     = false;
      store.showSingle.value   = false;
      store.showRestarts.value = false;
      store.minRestarts.value  = 1;
      store.sortField.value    = 'service';
      store.sortDir.value      = 'asc';
      notifyChange();
    }

    // -----------------------------------------------------------------------
    // Render function
    // -----------------------------------------------------------------------

    return () => h('div', { class: 'cyber-controls' }, [

      // --- Row 1: Environment ---
      h('div', { class: 'control-section' }, [
        h('div', { class: 'section-label' }, 'ENVIRONMENT'),
        h('div', { class: 'controls-row' }, [
          h(SelectGroup, {
            id: 'vue-contextInput',
            label: 'Context:',
            options: contextOptions.value,
            value: store.context.value,
            onChange: onContextChange
          }),
          h('div', { class: 'input-group' }, [
            h('label', 'Namespaces:'),
            store.isContextSwitching.value
              ? h('span', { class: 'ns-loading' }, 'Loading namespaces...')
              : h('div', null, [
                  // Chips row — selected namespaces
                  h('div', { class: 'ns-chips-container' },
                    store.selectedNamespaces.value.map(ns =>
                      h('span', { class: 'ns-chip', key: ns }, [
                        h('span', ns),
                        h('button', {
                          type: 'button',
                          class: 'ns-chip-remove',
                          'aria-label': 'Remove ' + ns,
                          disabled: store.selectedNamespaces.value.length === 1,
                          onClick: () => {
                            if (store.selectedNamespaces.value.length > 1) {
                              store.selectedNamespaces.value = store.selectedNamespaces.value.filter(n => n !== ns);
                              store.fetchServices();
                            }
                          }
                        }, '\u00d7')
                      ])
                    )
                  ),
                  // Dropdown — only show namespaces not yet selected
                  store.availableNamespaces.value.length === 0
                    ? h('span', { class: 'ns-loading' }, 'Loading...')
                    : h('div', { class: 'select-container' }, [
                        h('select', {
                          class: 'cyber-select ns-add-select',
                          value: '',
                          onChange: (e) => {
                            const ns = e.target.value;
                            if (ns && !store.selectedNamespaces.value.includes(ns)) {
                              store.selectedNamespaces.value = [...store.selectedNamespaces.value, ns];
                              store.fetchServices();
                            }
                            e.target.value = '';
                          }
                        }, [
                          h('option', { value: '', disabled: true }, 'Add namespace...'),
                          ...store.availableNamespaces.value
                            .filter(ns => !store.selectedNamespaces.value.includes(ns))
                            .map(ns => h('option', { value: ns, key: ns }, ns))
                        ]),
                        chevronSvg()
                      ])
                ])
          ]),
          // Theme select — wired to themeStore via ThemeSelector component
          h(ThemeSelector),

          // Environment tag selector — persisted per-context
          h('div', { class: 'input-group', style: 'align-items: center;' }, [
            h('label', 'Env tag:'),
            h('div', { style: 'display: flex; gap: 4px;' }, [
              // "—" none/clear button
              h('button', {
                type: 'button',
                'aria-label': 'Clear environment tag',
                style: store.contextTag.value === ''
                  ? 'background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;'
                  : 'background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;',
                onClick: () => {
                  store.contextTag.value = '';
                }
              }, '\u2014'),
              // "Dev" button
              h('button', {
                type: 'button',
                'aria-label': 'Tag context as development',
                style: store.contextTag.value === 'dev'
                  ? 'background: #1a4a1a; border: 1px solid #4caf50; color: #4caf50; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;'
                  : 'background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;',
                onClick: () => {
                  store.contextTag.value = store.contextTag.value === 'dev' ? '' : 'dev';
                }
              }, 'Dev'),
              // "Prod" button
              h('button', {
                type: 'button',
                'aria-label': 'Tag context as production',
                style: store.contextTag.value === 'prod'
                  ? 'background: #4a1a1a; border: 1px solid #f44336; color: #f44336; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;'
                  : 'background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;',
                onClick: () => {
                  store.contextTag.value = store.contextTag.value === 'prod' ? '' : 'prod';
                }
              }, 'Prod')
            ])
          ])
        ])
      ]),

      // --- Row 2: Filters ---
      h('div', { class: 'control-section' }, [
        h('div', { class: 'section-label' }, 'FILTERS'),
        h('div', { class: 'controls-row' }, [
          // Prefix input
          h('div', { class: 'input-group' }, [
            h('label', { for: 'vue-prefixInput' }, 'Namespace prefix (comma-separated):'),
            h('input', {
              type: 'text',
              id: 'vue-prefixInput',
              class: 'cyber-input',
              value: store.prefix.value,
              onInput: onPrefixInput
            })
          ]),
          // Search input
          h('div', { class: 'search-container' }, [
            h('div', { class: 'search-icon' },
              h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                width: '18',
                height: '18',
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              }, [
                h('circle', { cx: '11', cy: '11', r: '8' }),
                h('path', { d: 'm21 21-4.35-4.35' })
              ])
            ),
            h('input', {
              type: 'text',
              id: 'vue-searchInput',
              class: 'search-input',
              placeholder: 'Search services (comma-separated)...',
              value: store.search.value,
              onInput: onSearchInput
            }),
            h('button', {
              type: 'button',
              class: 'search-clear',
              id: 'vue-searchClear',
              'aria-label': 'Clear search',
              onClick: onSearchClear
            },
              h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                width: '16',
                height: '16',
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              }, [
                h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
              ])
            )
          ])
        ]),

        // Filter chips
        h('div', { class: 'filter-chips' }, [
          h('label', { class: 'filter-chip' + (store.showBad.value ? ' active' : '') }, [
            h('input', {
              type: 'checkbox',
              id: 'vue-filterBad',
              style: 'display:none',
              checked: store.showBad.value,
              onChange: onFilterBadChange
            }),
            h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
              h('circle', { cx: '12', cy: '12', r: '10' }),
              h('line', { x1: '15', y1: '9', x2: '9', y2: '15' }),
              h('line', { x1: '9', y1: '9', x2: '15', y2: '15' })
            ]),
            h('span', 'Bad')
          ]),
          h('label', { class: 'filter-chip' + (store.showWarn.value ? ' active' : '') }, [
            h('input', {
              type: 'checkbox',
              id: 'vue-filterWarn',
              style: 'display:none',
              checked: store.showWarn.value,
              onChange: onFilterWarnChange
            }),
            h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
              h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
              h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
              h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
            ]),
            h('span', 'Warning')
          ]),
          h('label', { class: 'filter-chip' + (store.showSingle.value ? ' active' : '') }, [
            h('input', {
              type: 'checkbox',
              id: 'vue-filterSingle',
              style: 'display:none',
              checked: store.showSingle.value,
              onChange: onFilterSingleChange
            }),
            h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
              h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
              h('circle', { cx: '12', cy: '7', r: '4' }),
              h('line', { x1: '12', y1: '13', x2: '12', y2: '21' })
            ]),
            h('span', 'Single Pod')
          ]),
          h('label', { class: 'filter-chip' + (store.showRestarts.value ? ' active' : '') }, [
            h('input', {
              type: 'checkbox',
              id: 'vue-filterRestarts',
              style: 'display:none',
              checked: store.showRestarts.value,
              onChange: onFilterRestartsChange
            }),
            h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
              h('polyline', { points: '23 4 23 10 17 10' }),
              h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
            ]),
            h('span', 'Restarts \u2265'),
            h('input', {
              type: 'number',
              id: 'vue-minRestartsInput',
              value: store.minRestarts.value,
              min: '1',
              disabled: !store.showRestarts.value,
              style: 'width: 50px; padding: 2px 6px; border: none; background: transparent; color: inherit; font-weight: inherit;',
              onInput: onMinRestartsInput,
              onClick: e => e.stopPropagation()
            })
          ])
        ])
      ]),

      // --- Row 3: Sort & Actions ---
      h('div', { class: 'control-section' }, [
        h('div', { class: 'section-label' }, 'SORT & ACTIONS'),
        h('div', { class: 'controls-row' }, [
          h(SelectGroup, {
            id: 'vue-sortField',
            label: 'Sort:',
            options: [
              { value: 'service',  label: 'Service' },
              { value: 'pods',     label: 'Pods' },
              { value: 'restarts', label: 'Restarts' },
              { value: 'deployed', label: 'Deployed' }
            ],
            value: store.sortField.value,
            onChange: onSortFieldChange
          }),
          h(SelectGroup, {
            id: 'vue-sortDir',
            label: null,
            options: [
              { value: 'asc',  label: 'Ascending' },
              { value: 'desc', label: 'Descending' }
            ],
            value: store.sortDir.value,
            onChange: onSortDirChange
          }),
          h('div', { class: 'refresh-controls' },
            h('button', {
              type: 'button',
              class: 'cyber-button cyber-button-primary',
              id: 'vue-refreshButton',
              onClick: onRefresh
            }, [
              h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                h('polyline', { points: '23 4 23 10 17 10' }),
                h('polyline', { points: '1 20 1 14 7 14' }),
                h('path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' })
              ]),
              ' Refresh'
            ])
          ),
          h('button', {
            type: 'button',
            class: 'cyber-button',
            id: 'vue-resetButton',
            onClick: onReset
          }, 'Reset')
        ])
      ])
    ]);
  }
});

export default FilterControls;
