/**
 * Vue 3 Component: ServiceDetailsTabs
 * Renders the expanded tab panel below a service row.
 *
 * Tabs: Pods | Events | Configs | Endpoints | Deployment
 * (Logs and Shell are Fas 5 — omitted here.)
 *
 * Props:
 *   service   {Object} — full service data object from the store
 *   context   {String} — kubeconfig context name (local mode)
 *   namespace {String} — Kubernetes namespace
 *
 * Data loading strategy:
 *   - All tabs fire in parallel on mount (background-load pattern from main.js).
 *   - Results are cached per (context, namespace, serviceName) key.
 *   - Tab switching never re-fetches already-loaded data.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { escapeHtml, fmtCpuVal, fmtMemVal, fmtAge } from '../modules/formatters.js';
import { apiEndpoint } from '../utils/sharedUtils.js';
import { renderPodDetails } from '../modules/ui-components.js';
import { renderPodEventsTimeline } from '../modules/ui-components.js';
import { renderServiceConfigs, renderConfigMapViewer, renderSecretViewer } from '../modules/ui-components.js';
import { renderServiceEndpoints } from '../modules/ui-components.js';
import { renderDeploymentHistory } from '../modules/ui-components.js';
import { attachConfigsHandlers } from '../modules/config-handlers.js';
import { showRollbackModal, performRestart } from '../modules/deployment-handlers.js';
import { showNotification } from '../modules/formatters.js';
import { PodLogsModal } from './PodLogsModal.js';
import { ShellModal } from './ShellModal.js';
import { useDashboardStore } from '../stores/dashboardStore.js';

const { defineComponent, ref, reactive, onMounted, h, Teleport } = Vue;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Per-component cache to avoid re-fetching when user switches tabs.
// Structure: Map<cacheKey, string|null>
// null = loading, string = rendered HTML or error sentinel
function makeCache() {
  return {
    pods:       new Map(),
    events:     new Map(),
    configs:    new Map(),
    endpoints:  new Map(),
    deployment: new Map(),
  };
}

// Shared module-level cache so that collapsing and re-expanding a row within
// the same page load does not re-fetch.
const _globalCache = makeCache();

// ---------------------------------------------------------------------------
// Loading spinner HTML — SAFE: hardcoded
// ---------------------------------------------------------------------------
function loadingHtml(label) {
  return `<div class="loading-state"><div class="cyber-spinner"></div><span>${label}</span></div>`;
}

function errorHtml(message) {
  return `<div class="loading-state"><span style="color: var(--color-danger);">${escapeHtml(message)}</span></div>`;
}

function authErrorHtml() {
  return `
    <div class="loading-state">
      <span style="color: var(--color-danger);">AWS authentication required! Token has expired.</span>
      <br><br>
      <p>Steps to fix:</p>
      <ol style="text-align: left; margin: 10px 0;">
        <li>Open terminal</li>
        <li>Run: <code>aws sso login</code></li>
        <li>Click the "Retry" button below</li>
      </ol>
      <button class="modal-btn modal-btn-primary" onclick="location.reload()">Retry</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Tab definitions — order matches renderServiceDetailsTabs() in ui-components.js
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'pods',       label: 'Pods',        icon: '📦' },
  { id: 'events',     label: 'Events',      icon: '📋' },
  { id: 'configs',    label: 'Configs',     icon: '⚙️'  },
  { id: 'endpoints',  label: 'Endpoints',   icon: '🔗' },
  { id: 'deployment', label: 'Deployments', icon: '🕐' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ServiceDetailsTabs = defineComponent({
  name: 'ServiceDetailsTabs',

  props: {
    service: {
      type: Object,
      required: true
    },
    context: {
      type: String,
      default: ''
    },
    namespace: {
      type: String,
      default: ''
    }
  },

  setup(props) {
    const activeTab = ref('pods');

    // Per-tab HTML content (null = not yet loaded, string = content)
    const tabContent = reactive({
      pods:       null,
      events:     null,
      configs:    null,
      endpoints:  null,
      deployment: null,
    });

    // Track loading state per tab so we can show spinners before content
    const tabLoading = reactive({
      pods:       true,
      events:     true,
      configs:    true,
      endpoints:  true,
      deployment: true,
    });

    // ---------------------------------------------------------------------------
    // Fas 5: Pod Logs modal state
    // ---------------------------------------------------------------------------
    const podLogsModal = reactive({
      visible:    false,
      podName:    '',
      namespace:  '',
      context:    '',
      containers: [],
    });

    // ---------------------------------------------------------------------------
    // Fas 5: Shell modal state
    // ---------------------------------------------------------------------------
    const shellModal = reactive({
      visible:    false,
      podName:    '',
      namespace:  '',
      context:    '',
      containers: [],
    });

    // ---------------------------------------------------------------------------
    // Restart — delegates to the store's global ConfirmModal (already rendered
    // at the app root level and proven to work).
    // ---------------------------------------------------------------------------
    const store = useDashboardStore();

    function openRestartConfirm() {
      store.showConfirm({
        title:     'Reload Service',
        message:   `Restart all pods for "${serviceName()}" in namespace "${props.namespace}"? Pods will be replaced one by one.`,
        onConfirm: async () => {
          try {
            await performRestart(serviceName(), props.namespace, props.context);
            showNotification('Restart initiated successfully!', 'success');
          } catch (err) {
            showNotification(`Restart failed: ${err.message}`, 'error');
          }
        },
      });
    }

    // ---------------------------------------------------------------------------
    // Fas 5: Fetch container list for a pod (used by both modals)
    // ---------------------------------------------------------------------------
    async function fetchContainers(podName) {
      try {
        const params = new URLSearchParams({ namespace: props.namespace, pod: podName });
        if (props.context) params.append('context', props.context);
        const res = await fetch(`${apiEndpoint('pod-containers')}?${params}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('[ServiceDetailsTabs] Could not fetch container list for pod:', podName, e);
      }
      return [];
    }

    // ---------------------------------------------------------------------------
    // Fas 5: Open Pod Logs modal
    // ---------------------------------------------------------------------------
    async function openPodLogs(podName) {
      const containers = await fetchContainers(podName);
      podLogsModal.podName    = podName;
      podLogsModal.namespace  = props.namespace;
      podLogsModal.context    = props.context;
      podLogsModal.containers = containers;
      podLogsModal.visible    = true;
    }

    // ---------------------------------------------------------------------------
    // Fas 5: Open Shell modal
    // ---------------------------------------------------------------------------
    async function openShell(podName) {
      const containers = await fetchContainers(podName);
      shellModal.podName    = podName;
      shellModal.namespace  = props.namespace;
      shellModal.context    = props.context;
      shellModal.containers = containers;
      shellModal.visible    = true;
    }

    // ---------------------------------------------------------------------------
    // Fetch helpers — each returns HTML string, never throws
    // ---------------------------------------------------------------------------

    const serviceName = () => props.service.serviceName || props.service.name || '';
    const cacheKey = () => `${props.context}-${props.namespace}-${serviceName()}`;

    async function fetchPods() {
      const key = cacheKey();
      if (_globalCache.pods.has(key)) return _globalCache.pods.get(key);

      const params = new URLSearchParams();
      if (props.context) params.append('context', props.context);
      params.append('namespace', props.namespace);
      params.append('service', serviceName());

      const endpoint = window.IS_LOCAL_MODE ? '/service-pods-local' : '/service-pods';
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return authErrorHtml();
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const pods = data.pods || [];
      const formatters = { fmtCpuVal, fmtMemVal, fmtAge };
      const html = renderPodDetails(pods, serviceName(), data.namespace || props.namespace, formatters);
      _globalCache.pods.set(key, html);
      return html;
    }

    async function fetchEvents() {
      const key = cacheKey();
      if (_globalCache.events.has(key)) return _globalCache.events.get(key);

      const params = new URLSearchParams();
      if (props.context) params.append('context', props.context);
      params.append('namespace', props.namespace);
      params.append('service', serviceName());

      const response = await fetch(`${apiEndpoint('pod-events')}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return authErrorHtml();
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const html = renderPodEventsTimeline(data.events || []);
      _globalCache.events.set(key, html);
      return html;
    }

    async function fetchConfigs() {
      const key = cacheKey();
      if (_globalCache.configs.has(key)) return _globalCache.configs.get(key);

      const params = new URLSearchParams();
      if (props.context) params.append('context', props.context);
      params.append('namespace', props.namespace);
      params.append('service', serviceName());

      const response = await fetch(`${apiEndpoint('service-configs')}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return authErrorHtml();
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const html = renderServiceConfigs(data);
      _globalCache.configs.set(key, html);
      return html;
    }

    async function fetchEndpoints() {
      const key = cacheKey();
      if (_globalCache.endpoints.has(key)) return _globalCache.endpoints.get(key);

      const params = new URLSearchParams();
      if (props.context) params.append('context', props.context);
      params.append('namespace', props.namespace);
      params.append('service', serviceName());

      const response = await fetch(`${apiEndpoint('service-endpoints')}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return authErrorHtml();
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const html = renderServiceEndpoints(data);
      _globalCache.endpoints.set(key, html);
      return html;
    }

    async function fetchDeployment() {
      const key = cacheKey();
      if (_globalCache.deployment.has(key)) return _globalCache.deployment.get(key);

      const params = new URLSearchParams();
      if (props.context) params.append('context', props.context);
      params.append('namespace', props.namespace);
      params.append('deployment', serviceName());

      const response = await fetch(`${apiEndpoint('deployment-history')}?${params.toString()}`);
      if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body.message) msg = body.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = await response.json();
      const html = renderDeploymentHistory(data, serviceName(), props.namespace);
      _globalCache.deployment.set(key, html);
      return html;
    }

    // ---------------------------------------------------------------------------
    // Event delegation — replaces onVnodeMounted + attachHandlersForTab.
    //
    // onClick on the pane wrapper catches all button clicks via e.target.closest().
    // onChange on the pane wrapper catches checkbox/select changes.
    //
    // Configs tab: attachConfigsHandlers wires stateful per-row closures (decode,
    // copy with decodedValue cache). We attach it lazily on first interaction and
    // guard with a data attribute to avoid double-attachment.
    // ---------------------------------------------------------------------------

    function handleTabClick(e, tabId) {
      // --- Pods tab ---
      if (tabId === 'pods') {
        const logsBtn = e.target.closest('.pod-logs-btn');
        if (logsBtn) {
          e.stopPropagation();
          openPodLogs(logsBtn.dataset.pod);
          return;
        }
        const shellBtn = e.target.closest('.pod-shell-btn');
        if (shellBtn) {
          e.stopPropagation();
          openShell(shellBtn.dataset.pod);
          return;
        }
        return;
      }

      // --- Events tab ---
      if (tabId === 'events') {
        const showAllBtn = e.target.closest('.show-all-events-btn');
        if (showAllBtn) {
          const pane = showAllBtn.closest('.tab-pane');
          if (pane) {
            pane.querySelectorAll('.event-item.hidden').forEach(item => item.classList.remove('hidden'));
          }
          showAllBtn.style.display = 'none';
          return;
        }
        return;
      }

      // --- Configs tab ---
      // attachConfigsHandlers uses stateful per-row closures (decode, copy with
      // decodedValue cache) that must be wired once against live DOM nodes.
      // Attach on first click, then immediately re-fire on the clicked button so
      // the first click is not silently consumed.
      if (tabId === 'configs') {
        const pane = e.currentTarget;
        if (!pane.dataset.handlersAttached) {
          pane.dataset.handlersAttached = '1';
          attachConfigsHandlers(pane, props.namespace, props.context);
          // Re-trigger the button that was just clicked so the native listener fires.
          const btn = e.target.closest('.expand-configmap-btn, .view-secret-btn, [data-copy]');
          if (btn) btn.click();
        }
        return;
      }

      // --- Endpoints tab ---
      if (tabId === 'endpoints') {
        const copyBtn = e.target.closest('[data-copy]');
        if (copyBtn) {
          e.stopPropagation();
          navigator.clipboard.writeText(copyBtn.dataset.copy).catch(() => {});
          return;
        }
        return;
      }

      // --- Deployment tab ---
      if (tabId === 'deployment') {
        // Rollback button — handle directly so it fires on the first click.
        // (Lazy-attach pattern consumed the first click before listeners were wired.)
        const rollbackBtn = e.target.closest('.rollback-btn');
        if (rollbackBtn) {
          e.stopPropagation();
          const onSuccess = () => setTimeout(() => _globalCache.deployment.delete(cacheKey()), 2000);
          const revision = parseInt(rollbackBtn.dataset.revision, 10);
          const image = rollbackBtn.dataset.image;
          showRollbackModal(serviceName(), props.namespace, revision, image, props.context, onSuccess);
          return;
        }

        return;
      }
    }

    // onChange handles the Events tab warning-only checkbox (change event, not click).
    function handleTabChange(e, tabId) {
      if (tabId === 'events') {
        const checkbox = e.target.closest('.warning-only-checkbox');
        if (checkbox) {
          const pane = checkbox.closest('.tab-pane');
          if (!pane) return;
          const events = pane.querySelectorAll('.event-item');
          events.forEach(item => {
            if (checkbox.checked) {
              item.style.display = item.classList.contains('event-warning') ? '' : 'none';
            } else {
              item.style.display = '';
            }
          });
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Load a single tab and update reactive state
    // ---------------------------------------------------------------------------

    async function loadTab(tabId) {
      tabLoading[tabId] = true;
      tabContent[tabId] = null;

      try {
        let html;
        if (tabId === 'pods')       html = await fetchPods();
        else if (tabId === 'events')     html = await fetchEvents();
        else if (tabId === 'configs')    html = await fetchConfigs();
        else if (tabId === 'endpoints')  html = await fetchEndpoints();
        else if (tabId === 'deployment') html = await fetchDeployment();
        else html = '';

        tabContent[tabId] = html;
      } catch (err) {
        console.error(`[ServiceDetailsTabs] Failed to load tab "${tabId}":`, err);
        tabContent[tabId] = errorHtml(`Failed to load ${tabId}: ${err.message}`);
      } finally {
        tabLoading[tabId] = false;
      }
    }

    // ---------------------------------------------------------------------------
    // On mount: load all tabs in parallel (same strategy as main.js)
    // ---------------------------------------------------------------------------

    onMounted(() => {
      Promise.allSettled(
        TABS.map(tab => loadTab(tab.id))
      );
    });

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return () => {
      // Tab buttons row
      const tabButtons = TABS.map(tab =>
        h('button', {
          class: ['tab-button', activeTab.value === tab.id ? 'active' : ''],
          type: 'button',
          'data-tab': tab.id,
          onClick: () => { activeTab.value = tab.id; }
        }, [
          h('span', { class: 'tab-icon' }, tab.icon),
          h('span', {}, tab.label)
        ])
      );

      // Tab panes
      const tabPanes = TABS.map(tab => {
        const isActive = activeTab.value === tab.id;
        const content = tabContent[tab.id];
        const loading = tabLoading[tab.id];

        let paneChild;
        if (loading && content === null) {
          // Still loading
          paneChild = h('div', {
            innerHTML: loadingHtml(`Loading ${tab.label.toLowerCase()}...`) // SAFE: hardcoded
          });
        } else if (tab.id === 'deployment') {
          // Deployment tab: render restart button as a real Vue element so its
          // onClick fires directly without going through innerHTML event delegation.
          paneChild = h('div', {}, [
            h('div', { class: 'deployment-tab-header' }, [
              h('button', {
                type: 'button',
                class: 'cyber-button cyber-button-warning',
                onClick: openRestartConfirm
              }, '↺ Reload Service')
            ]),
            h('div', {
              innerHTML: content || '', // SAFE: rendered by trusted render functions
              onClick: (e) => handleTabClick(e, tab.id),
            }),
          ]);
        } else {
          // Content ready (may be error HTML).
          // Event delegation: a single onClick/onChange on the wrapper catches all
          // descendant interactions. e.target.closest() handles clicks on icons/spans
          // inside buttons correctly.
          paneChild = h('div', {
            innerHTML: content || '', // SAFE: rendered by trusted render functions
            onClick:   (e) => handleTabClick(e, tab.id),
            onChange:  (e) => handleTabChange(e, tab.id),
          });
        }

        return h('div', {
          class: ['tab-pane', isActive ? 'active' : ''],
          id: `vue-${tab.id}-${serviceName()}`,
          style: isActive ? '' : 'display: none;'
        }, [paneChild]);
      });

      // Fas 5: Pod Logs modal (teleports to body via portal pattern)
      const podLogsMdl = h(PodLogsModal, {
        visible:    podLogsModal.visible,
        podName:    podLogsModal.podName,
        namespace:  podLogsModal.namespace,
        context:    podLogsModal.context,
        containers: podLogsModal.containers,
        onClose:    () => { podLogsModal.visible = false; },
      });

      // Fas 5: Shell modal
      const shellMdl = h(ShellModal, {
        visible:    shellModal.visible,
        podName:    shellModal.podName,
        namespace:  shellModal.namespace,
        context:    shellModal.context,
        containers: shellModal.containers,
        onClose:    () => { shellModal.visible = false; },
      });

      return h('div', { class: 'service-details-tabs' }, [
        h('div', { class: 'tab-buttons' }, tabButtons),
        h('div', { class: 'tab-content' }, tabPanes),
        h(Teleport, { to: 'body' }, { default: () => [podLogsMdl] }),
        h(Teleport, { to: 'body' }, { default: () => [shellMdl] }),
      ]);
    };
  }
});

export default ServiceDetailsTabs;
