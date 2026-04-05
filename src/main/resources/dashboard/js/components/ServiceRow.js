/**
 * Vue 3 Component: ServiceRow
 * Renders a single <tr> row in the service table.
 * When isExpanded is true, also renders a second <tr> with ServiceDetailsTabs.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, computed, h } = Vue;

import { statusFor } from './serviceUtils.js';
import { ServiceDetailsTabs } from './ServiceDetailsTabs.js';

// SVG icons — SAFE: hardcoded, never interpolated with user data
const ICON_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const ICON_RESTART = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
const ICON_LOGS = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';

const ICON_BAD = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
const ICON_WARN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_OK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
const ICON_SINGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="13" x2="12" y2="21"/></svg>';

/**
 * Format deployment timestamp — mirrors fmtDeploy() in main.js.
 */
function fmtDeploy(item) {
  if (!item.deployedAtEpochSeconds) return '';
  try {
    return new Date(item.deployedAtEpochSeconds * 1000).toLocaleString();
  } catch (e) {
    return '';
  }
}

/**
 * Format HPA info — mirrors fmtHpa() in main.js.
 */
function fmtHpa(item) {
  const { hpaMinReplicas: min, hpaMaxReplicas: max, hpaCurrentReplicas: cur, hpaDesiredReplicas: des } = item;
  if (min == null && max == null && cur == null && des == null) return '';

  let main = '';
  if (cur != null && des != null) main = `${cur}/${des}`;
  else if (cur != null) main = String(cur);
  else if (des != null) main = String(des);

  let range = '';
  if (min != null || max != null) {
    range = `(${min != null ? min : ''}-${max != null ? max : ''})`;
  }
  return [main, range].filter(Boolean).join(' ');
}

export const ServiceRow = defineComponent({
  name: 'ServiceRow',

  components: { ServiceDetailsTabs },

  props: {
    service: {
      type: Object,
      required: true
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    context: {
      type: String,
      default: ''
    },
    namespace: {
      type: String,
      default: ''
    },
    restartRedThreshold: {
      type: Number,
      default: () => window.RESTART_RED_THRESHOLD || 3
    },
    /**
     * Fas 3: Set of field names that changed since last refresh.
     * Used to apply cell-highlight class on changed cells.
     * Field names from getFieldChanges(): 'podCount', 'readyCount', 'restartCount', 'deployed'.
     * Pass a Set<string> or null for no highlights.
     */
    highlightedFields: {
      type: Object,   // Set<string> — Vue accepts any object for Set
      default: null
    },
    /**
     * Fas 3: Seconds until next auto-refresh. Shown below the status badge.
     * Passed down from ServiceTable which reads store.secondsUntilRefresh.
     */
    secondsUntilRefresh: {
      type: Number,
      default: null
    }
  },

  emits: ['toggle-expand'],

  setup(props, { emit }) {
    const status = computed(() => statusFor(props.service, props.restartRedThreshold));
    const isSinglePod = computed(() => props.service.podCount === 1);

    const rowClasses = computed(() => {
      const classes = [];
      if (status.value.cls) classes.push(status.value.cls);
      if (isSinglePod.value) classes.push('row-single');
      return classes;
    });

    /**
     * Return extra CSS classes for a data cell based on which fields changed.
     * Mirrors the cell-increased / cell-decreased logic in incremental-updates.js.
     *
     * @param {string} field  — the data-field name for the cell
     * @returns {string[]}
     */
    function highlightClassesFor(field) {
      if (!props.highlightedFields || !props.highlightedFields.has(field)) return [];
      // We only know the field changed; direction info is not carried in the Set.
      // Use a generic highlight class so CSS can style it without direction dependency.
      return ['cell-highlight'];
    }

    const statusIconHtml = computed(() => {
      const { cls, pill } = status.value;
      if (cls === 'row-bad' || pill === 'status-bad') return ICON_BAD;
      if (cls === 'row-warn' || pill === 'status-warn') return ICON_WARN;
      return ICON_OK;
    });

    const badgeClass = computed(() => status.value.pill.replace('status-', ''));

    function onToggleExpand() {
      emit('toggle-expand', props.service.serviceName || props.service.name);
    }

    return () => {
      const svc = props.service;
      const name = String(svc.serviceName || svc.name || '');

      // Build Humio URL for the service link — safe since it uses window config + name
      const humioBase = String(window.HUMIO_BASE_URL || '').replace(/\/+$/, '');
      const humioRepo = encodeURIComponent(String(window.HUMIO_REPO || '').trim());
      const humioNs = String(svc.namespace || window.HUMIO_NAMESPACE || '');
      const humioQuery = encodeURIComponent(
        `kubernetes.namespace_name = "${humioNs}"\n| kubernetes.labels.app = "*${name.replaceAll('"', '')}*"`
      );
      const humioUrl = humioBase
        ? `${humioBase}/${humioRepo}/search?query=${humioQuery}&live=false&newestAtBottom=true&widgetType=list-view`
        : '#';

      // Expand button
      const expandBtn = h('button', {
        class: ['expand-button', props.isExpanded ? 'expanded' : ''],
        type: 'button',
        'data-action': 'toggle',
        'data-service': name,
        'aria-expanded': String(props.isExpanded),
        'aria-label': `Expand/Collapse details for ${name}`,
        onClick: onToggleExpand,
        innerHTML: ICON_CHEVRON // SAFE: hardcoded SVG
      });

      // Restart button — data-action lets existing main.js event delegation still work
      const restartBtn = h('button', {
        class: 'restart-button',
        type: 'button',
        'data-action': 'restart',
        'data-service': name,
        'aria-label': `Restart ${name}`,
        title: 'Restart deployment',
        innerHTML: ICON_RESTART // SAFE: hardcoded SVG
      });

      // Service logs button
      const logsBtn = h('button', {
        class: 'pod-logs-btn service-logs-btn',
        type: 'button',
        'data-action': 'service-logs',
        'data-service': name,
        'aria-label': `View logs for all pods of ${name}`,
        title: 'View logs for all pods',
        innerHTML: ICON_LOGS // SAFE: hardcoded SVG
      });

      const expandCell = h('td', { class: 'expand-cell' },
        h('div', { style: 'display: flex; align-items: center; gap: 4px;' }, [expandBtn, restartBtn, logsBtn])
      );

      // Service name as link to Humio
      const serviceLink = h('a', {
        href: humioUrl,
        class: 'service-link',
        target: '_blank',
        rel: 'noopener'
      }, name); // textContent — safe

      const nameCell = h('td', { 'data-field': 'serviceName' }, [serviceLink]);

      // Pod count cell — highlight if podCount changed
      const podCountCell = h('td', {
        'data-field': 'podCount',
        class: highlightClassesFor('podCount')
      },
        h('div', { class: 'pod-count-with-scale' },
          h('span', { class: 'pod-count-value' }, String(svc.podCount ?? ''))
        )
      );

      const hpaCell = h('td', { 'data-field': 'hpa' }, fmtHpa(svc));

      const readyCell = h('td', {
        'data-field': 'readyCount',
        class: highlightClassesFor('readyCount')
      }, String(svc.readyCount ?? ''));

      const restartCell = h('td', {
        'data-field': 'restartCount',
        class: highlightClassesFor('restartCount')
      }, String(svc.restartCount ?? ''));

      const deployedCell = h('td', {
        'data-field': 'deployed',
        class: highlightClassesFor('deployed')
      }, fmtDeploy(svc));

      // Status cell
      const statusBadge = h('span', { class: ['status-badge', badgeClass.value] }, [
        h('span', { innerHTML: statusIconHtml.value }), // SAFE: hardcoded SVG
        h('span', status.value.label)
      ]);
      const singleBadge = isSinglePod.value
        ? h('span', { class: 'status-badge single-pod icon-only', title: 'Single Pod - No redundancy', innerHTML: ICON_SINGLE_SVG }) // SAFE: hardcoded SVG
        : null;

      // Countdown text — injected by ServiceTable from store.secondsUntilRefresh
      const countdownText = props.secondsUntilRefresh != null
        ? (props.secondsUntilRefresh > 0
          ? `updates in ${props.secondsUntilRefresh}s`
          : 'updating...')
        : '';

      const statusCell = h('td', { 'data-field': 'status' },
        h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
          h('div', [statusBadge, singleBadge]),
          h('div', { class: 'service-update-time', style: 'font-size: 11px; color: var(--text-tertiary);' }, countdownText)
        ])
      );

      const mainRow = h('tr', {
        class: rowClasses.value,
        'data-service-name': name,
        'data-last-updated': String(Date.now())
      }, [expandCell, nameCell, podCountCell, hpaCell, readyCell, restartCell, deployedCell, statusCell]);

      // Expanded content row — only rendered when isExpanded is true
      if (!props.isExpanded) {
        return mainRow;
      }

      const expandedRow = h('tr', {
        class: 'expanded-content',
        'data-service-name': name
      }, [
        h('td', { colspan: 8 }, [
          h(ServiceDetailsTabs, {
            service: props.service,
            context: props.context,
            namespace: props.namespace
          })
        ])
      ]);

      // Vue render functions can return arrays of vnodes from a Fragment
      return [mainRow, expandedRow];
    };
  }
});

export default ServiceRow;
