/**
 * ProblematicPodCard — Fas 7
 *
 * Renders a single problematic pod as a card.
 * Mirrors renderPodCard() in modules/ui-components.js using the same
 * CSS classes (.pod-card, .pod-card-header, .pod-card-body, etc.) so
 * the output is visually identical to the vanilla JS version.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { fmtCpuVal, fmtMemVal, fmtAge, buildHumioPodLogsUrl } from '../modules/formatters.js';
import { getPodStatus } from './serviceUtils.js';

const { defineComponent, computed, h } = Vue;

// ---------------------------------------------------------------------------
// Sub-renderers (return vnode arrays/nodes)
// ---------------------------------------------------------------------------

/** Status phase badge — mirrors renderPodPhaseBadge() */
function phaseBadgeNode(status) {
  const phase = (status || 'Unknown').toLowerCase();
  let cls = 'pod-phase-badge';
  if (phase === 'running')   cls += ' phase-running';
  else if (phase === 'pending') cls += ' phase-pending';
  else if (phase === 'failed')  cls += ' phase-bad';
  else if (phase === 'succeeded') cls += ' phase-ok';

  return h('span', { class: cls }, status || 'Unknown');
}

/** Restart reason tag — mirrors renderPodRestartReason() */
function restartReasonNode(pod) {
  const reasons = pod.restartReasons || {};
  const keys = Object.keys(reasons);
  if (keys.length === 0) return null;

  return h('span', { class: 'restart-reason-tag', title: keys.join(', ') },
    ` (${keys.join(', ')})`
  );
}

/**
 * Resource bar — mirrors renderResourceBar().
 * usage / request / limit are numeric (may be null).
 */
function resourceBarNode(label, usage, request, limit, fmtFn) {
  const hasData = usage != null || request != null || limit != null;
  if (!hasData) return null;

  const pct = (request && request > 0 && usage != null)
    ? Math.min(100, Math.round((usage / request) * 100))
    : null;

  const usageTxt   = fmtFn(usage)   || '–';
  const requestTxt = fmtFn(request) || '–';
  const limitTxt   = fmtFn(limit)   || '–';

  let barClass = 'resource-bar-fill';
  if (pct != null) {
    if (pct >= 90) barClass += ' resource-critical';
    else if (pct >= 70) barClass += ' resource-high';
  }

  return h('div', { class: 'resource-bar-row' }, [
    h('div', { class: 'resource-bar-label' }, label),
    h('div', { class: 'resource-bar-track' }, [
      pct != null
        ? h('div', { class: barClass, style: `width: ${pct}%` })
        : null,
    ]),
    h('div', { class: 'resource-bar-values' },
      `${usageTxt} / ${requestTxt} (lim: ${limitTxt})`
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProblematicPodCard = defineComponent({
  name: 'ProblematicPodCard',

  props: {
    pod: {
      type: Object,
      required: true,
    },
    /** Service name derived from pod name by the parent (strip last 2 segments). */
    serviceName: {
      type: String,
      default: '',
    },
    namespace: {
      type: String,
      default: '',
    },
  },

  setup(props) {
    const status = computed(() => getPodStatus(props.pod));

    const statusClass = computed(() => {
      if (status.value === 'bad')  return 'pod-card pod-card--bad';
      if (status.value === 'warn') return 'pod-card pod-card--warn';
      return 'pod-card';
    });

    const created = computed(() =>
      props.pod.createdAtEpochSeconds
        ? new Date(props.pod.createdAtEpochSeconds * 1000)
        : null
    );

    const logsUrl = computed(() =>
      buildHumioPodLogsUrl(props.pod.podName || '', props.serviceName, props.namespace)
    );

    const ageText = computed(() =>
      created.value ? fmtAge(created.value) : 'n/a'
    );

    return () => {
      const pod = props.pod;
      const podName = pod.podName || '';

      // Header row
      const headerNode = h('div', { class: 'pod-card-header' }, [
        // Pod name as Humio log link
        h('div', { class: 'pod-card-name' },
          h('a', {
            href: logsUrl.value,
            class: 'pod-link',
            target: '_blank',
            rel: 'noopener',
            title: 'View logs in Humio',
          }, podName)
        ),
        // Actions + phase badge
        h('div', { class: 'pod-card-actions' }, [
          // Logs button (visual only in Vue layer — vanilla JS handles interaction)
          h('button', {
            class: 'pod-logs-btn',
            'data-pod': podName,
            title: 'View logs',
            type: 'button',
          },
            h('svg', {
              width: '14', height: '14', viewBox: '0 0 24 24',
              fill: 'none', stroke: 'currentColor',
              'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            }, [
              h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
              h('polyline', { points: '14 2 14 8 20 8' }),
              h('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
              h('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
              h('line', { x1: '10', y1: '9',  x2: '8', y2: '9'  }),
            ])
          ),
          phaseBadgeNode(pod.status),
        ]),
      ]);

      // Service name row (extra context for problematic pods view)
      const serviceNameNode = props.serviceName
        ? h('div', { class: 'pod-service-label' }, [
            h('span', { class: 'metadata-label' }, 'Service'),
            h('span', { class: 'metadata-value' }, props.serviceName),
          ])
        : null;

      // Resource bars
      const cpuBar = resourceBarNode(
        'CPU',
        pod.cpuUsageMilliCores,
        pod.cpuRequestMilliCores,
        pod.cpuLimitMilliCores,
        fmtCpuVal
      );
      const memBar = resourceBarNode(
        'Memory',
        pod.memoryUsageBytes,
        pod.memoryRequestBytes,
        pod.memoryLimitBytes,
        fmtMemVal
      );

      // Metadata grid
      const metaNode = h('div', { class: 'pod-metadata' }, [
        h('div', { class: 'pod-metadata-item' }, [
          h('div', { class: 'metadata-label' }, 'Node'),
          h('div', { class: 'metadata-value' }, pod.nodeName || 'n/a'),
        ]),
        h('div', { class: 'pod-metadata-item' }, [
          h('div', { class: 'metadata-label' }, 'IP'),
          h('div', { class: 'metadata-value' }, pod.podIp || 'n/a'),
        ]),
        h('div', { class: 'pod-metadata-item' }, [
          h('div', { class: 'metadata-label' }, 'Age'),
          h('div', {
            class: 'metadata-value pod-age-value',
            ...(created.value ? { 'data-created-epoch': pod.createdAtEpochSeconds * 1000 } : {}),
          }, ageText.value),
        ]),
        h('div', { class: 'pod-metadata-item' }, [
          h('div', { class: 'metadata-label' }, 'Restarts'),
          h('div', { class: 'metadata-value' }, [
            String(pod.restarts ?? '0'),
            restartReasonNode(pod),
          ]),
        ]),
      ]);

      const bodyNode = h('div', { class: 'pod-card-body' }, [
        serviceNameNode,
        cpuBar,
        memBar,
        metaNode,
      ]);

      return h('div', {
        class: statusClass.value,
        'data-pod-name': podName,
      }, [headerNode, bodyNode]);
    };
  },
});

export default ProblematicPodCard;
