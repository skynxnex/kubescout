/**
 * Vue 3 Component: StatusBadge
 * Renders the status indicator badge for a service.
 * Mirrors renderStatusBadge() + renderSinglePodBadge() in ui-components.js.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, computed, h } = Vue;

import { statusFor } from './serviceUtils.js';

// SVG markup strings — identical to ui-components.js
// SAFE: hardcoded, never interpolated with user data
const ICON_BAD = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
const ICON_WARN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_OK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
const ICON_SINGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="13" x2="12" y2="21"/></svg>';

export const StatusBadge = defineComponent({
  name: 'StatusBadge',

  props: {
    service: {
      type: Object,
      required: true
    },
    /**
     * Pre-computed status { cls, pill, label }. Derived from service if omitted.
     */
    status: {
      type: Object,
      default: null
    },
    restartRedThreshold: {
      type: Number,
      default: () => window.RESTART_RED_THRESHOLD || 3
    }
  },

  setup(props) {
    const resolvedStatus = computed(() =>
      props.status || statusFor(props.service, props.restartRedThreshold)
    );

    // SAFE: hardcoded SVG, chosen by internal logic, never user data
    const iconHtml = computed(() => {
      const { cls, pill } = resolvedStatus.value;
      if (cls === 'row-bad' || pill === 'status-bad') return ICON_BAD;
      if (cls === 'row-warn' || pill === 'status-warn') return ICON_WARN;
      return ICON_OK;
    });

    // Strip 'status-' prefix for CSS class — matches ui-components.js logic
    const badgeClass = computed(() => resolvedStatus.value.pill.replace('status-', ''));

    const isSinglePod = computed(() => props.service.podCount === 1);

    return () => {
      const statusBadge = h(
        'span',
        { class: ['status-badge', badgeClass.value] },
        [
          h('span', { innerHTML: iconHtml.value }), // SAFE: hardcoded SVG
          h('span', resolvedStatus.value.label)
        ]
      );

      const singlePodBadge = isSinglePod.value
        ? h('span', {
          class: 'status-badge single-pod icon-only',
          title: 'Single Pod - No redundancy',
          innerHTML: ICON_SINGLE_SVG // SAFE: hardcoded SVG
        })
        : null;

      return h('div', { style: 'display: flex; align-items: center; gap: 4px; flex-wrap: wrap;' }, [
        statusBadge,
        singlePodBadge
      ]);
    };
  }
});

export default StatusBadge;
