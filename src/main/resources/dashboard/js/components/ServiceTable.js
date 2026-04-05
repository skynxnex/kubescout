/**
 * Vue 3 Component: ServiceTable
 * Renders the complete service table: header + rows via ServiceRow.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { ServiceRow } from './ServiceRow.js';

const { defineComponent, ref, h } = Vue;

export const ServiceTable = defineComponent({
  name: 'ServiceTable',

  components: { ServiceRow },

  props: {
    services: {
      type: Array,
      required: true
    },
    restartRedThreshold: {
      type: Number,
      default: () => window.RESTART_RED_THRESHOLD || 3
    },
    /**
     * Fas 3: Map<serviceName, Set<fieldName>> of highlighted cells.
     * Sourced from store.highlightedServices.
     */
    highlightedServices: {
      type: Object,   // Map<string, Set<string>>
      default: () => new Map()
    },
    /**
     * Fas 3: Seconds until next auto-refresh for countdown display.
     * Sourced from store.secondsUntilRefresh.
     */
    secondsUntilRefresh: {
      type: Number,
      default: null
    },
    /**
     * Fas 4: kubeconfig context — forwarded to ServiceDetailsTabs.
     */
    context: {
      type: String,
      default: ''
    },
    /**
     * Fas 4: Kubernetes namespace — forwarded to ServiceDetailsTabs.
     */
    namespace: {
      type: String,
      default: ''
    }
  },

  setup(props) {
    // Track which service rows are expanded by name
    const expandedServices = ref(new Set());

    function onToggleExpand(serviceName) {
      const next = new Set(expandedServices.value);
      if (next.has(serviceName)) {
        next.delete(serviceName);
      } else {
        next.add(serviceName);
      }
      expandedServices.value = next;
    }

    return () => {
      const thead = h('thead', {},
        h('tr', {}, [
          h('th', { style: 'width: 40px;' }),
          h('th', 'Service'),
          h('th', { title: 'Antal pods' }, 'Pods'),
          h('th', { title: 'HPA: current/desired (min-max)' }, 'HPA'),
          h('th', { title: 'Antal ready pods' }, 'Ready'),
          h('th', { title: 'Totala restarts' }, 'Restarts'),
          h('th', { title: 'Deployment timestamp' }, 'Deployed'),
          h('th', { title: 'Overall status' }, 'Status')
        ])
      );

      const rows = props.services.map((svc, idx) => {
        const key  = svc.serviceName || svc.name || `svc-${idx}`;
        const name = svc.serviceName || svc.name;
        return h(ServiceRow, {
          key,
          service: svc,
          isExpanded: expandedServices.value.has(name),
          restartRedThreshold: props.restartRedThreshold,
          highlightedFields: props.highlightedServices.get(name) || null,
          secondsUntilRefresh: props.secondsUntilRefresh,
          context: props.context,
          namespace: props.namespace,
          onToggleExpand
        });
      });

      const emptyRow = props.services.length === 0
        ? h('tr', { class: 'loading-row' },
          h('td', { colspan: 8 },
            h('div', { class: 'loading-state' }, 'No services to display.')
          )
        )
        : null;

      const tbody = h('tbody', {}, emptyRow ? [emptyRow] : rows);

      return h('div', { class: 'modern-table-container' },
        h('table', { class: 'modern-table' }, [thead, tbody])
      );
    };
  }
});

export default ServiceTable;
