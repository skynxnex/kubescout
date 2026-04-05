/**
 * ProblematicPodsView — Fas 7
 *
 * Main rendering component for the problematic pods page.
 * Receives pre-fetched data as props and renders the pod grid,
 * loading state, and error state.
 *
 * Props:
 *   pods      - Array of pod objects from /problematic-pods-local
 *   isLoading - Boolean, true while the first load is in progress
 *   error     - String | null — error message to display
 *   namespace - String — current namespace (passed through to pod cards)
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { ProblematicPodCard } from './ProblematicPodCard.js';
import { getPodStatus } from './serviceUtils.js';

const { defineComponent, computed, h } = Vue;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive service name from pod name (strip last 2 segments: hash + random). */
function deriveServiceName(podName) {
  const segments = (podName || '').split('-');
  return segments.length > 2 ? segments.slice(0, -2).join('-') : podName;
}

// ---------------------------------------------------------------------------
// Empty state node
// ---------------------------------------------------------------------------

function emptyStateNode() {
  return h('div', {
    style: 'text-align: center; padding: 40px; color: var(--text-secondary);',
  }, [
    h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '48', height: '48',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: 'margin-bottom: 16px; opacity: 0.5; display: block; margin-left: auto; margin-right: auto;',
    }, [
      h('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
      h('polyline', { points: '22 4 12 14.01 9 11.01' }),
    ]),
    h('p', { style: 'font-size: 18px; margin-bottom: 8px;' }, 'No problematic pods'),
    h('p', { style: 'font-size: 14px; opacity: 0.7;' }, 'All pods running as expected!'),
  ]);
}

// ---------------------------------------------------------------------------
// Loading state node
// ---------------------------------------------------------------------------

function loadingStateNode() {
  return h('div', { class: 'loading-state' }, [
    h('div', { class: 'cyber-spinner' }),
    h('span', {}, 'Loading problematic pods...'),
  ]);
}

// ---------------------------------------------------------------------------
// Error state node
// ---------------------------------------------------------------------------

function errorStateNode(message) {
  return h('div', {
    style: 'text-align: center; padding: 40px; color: var(--text-secondary);',
  }, [
    h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '48', height: '48',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'var(--accent-red)',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: 'margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;',
    }, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('line', { x1: '12', y1: '8', x2: '12', y2: '12' }),
      h('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' }),
    ]),
    h('p', { style: 'font-size: 18px; margin-bottom: 8px; color: var(--accent-red);' }, 'Failed to load pods'),
    h('p', { style: 'font-size: 14px; margin-bottom: 0;' }, message),
  ]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProblematicPodsView = defineComponent({
  name: 'ProblematicPodsView',

  components: { ProblematicPodCard },

  props: {
    pods: {
      type: Array,
      default: () => [],
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: null,
    },
    namespace: {
      type: String,
      default: '',
    },
  },

  setup(props) {
    const badCount  = computed(() => props.pods.filter(p => getPodStatus(p) === 'bad').length);
    const warnCount = computed(() => props.pods.filter(p => getPodStatus(p) === 'warn').length);

    return () => {
      // Loading (initial)
      if (props.isLoading && props.pods.length === 0) {
        return h('div', { class: 'vue-problematic-view' }, loadingStateNode());
      }

      // Error
      if (props.error) {
        return h('div', { class: 'vue-problematic-view' }, errorStateNode(props.error));
      }

      // Empty
      if (!props.pods || props.pods.length === 0) {
        return h('div', { class: 'vue-problematic-view' }, emptyStateNode());
      }

      // Summary bar
      const summaryParts = [];
      if (badCount.value > 0) {
        summaryParts.push(
          h('span', { style: 'color: var(--accent-red); font-weight: 600;' },
            `${badCount.value} BAD`
          )
        );
      }
      if (warnCount.value > 0) {
        summaryParts.push(
          h('span', { style: 'color: var(--accent-yellow); font-weight: 600;' },
            `${warnCount.value} WARNING`
          )
        );
      }

      const summaryNode = h('div', {
        class: 'vue-pod-summary',
        style: 'margin-bottom: 16px; font-size: 0.875rem; color: var(--text-secondary);',
      }, [
        `Found ${props.pods.length} problematic pod${props.pods.length !== 1 ? 's' : ''}: `,
        ...summaryParts.reduce((acc, node, i) => {
          if (i > 0) acc.push(', ');
          acc.push(node);
          return acc;
        }, []),
      ]);

      // Refreshing indicator (subsequent refreshes — pods already visible)
      const refreshingNode = props.isLoading
        ? h('div', {
            style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 0.8125rem; color: var(--text-muted);',
          }, [
            h('div', { class: 'cyber-spinner', style: 'width: 14px; height: 14px; border-width: 2px;' }),
            'Refreshing...',
          ])
        : null;

      // Pod grid
      const podCards = props.pods.map(pod =>
        h(ProblematicPodCard, {
          key: pod.podName,
          pod,
          serviceName: deriveServiceName(pod.podName),
          namespace: props.namespace,
        })
      );

      const gridNode = h('div', { class: 'pod-details-container' }, podCards);

      return h('div', { class: 'vue-problematic-view' }, [
        summaryNode,
        refreshingNode,
        gridNode,
      ]);
    };
  },
});

export default ProblematicPodsView;
