/**
 * Vue 3 App — Fas 8 (migration complete)
 *
 * Connects the reactive store to real Kubernetes data.
 * Renders the full dashboard in #vue-root (inside .dashboard-container,
 * directly after the static header).
 */

import { ServiceTable }     from './components/ServiceTable.js';
import { FilterControls }   from './components/FilterControls.js';
import { AuthError }        from './components/AuthError.js';
import { LegendModal }      from './components/LegendModal.js';
import { ConfirmModal }     from './components/ConfirmModal.js';
import { ServiceLogsModal } from './components/ServiceLogsModal.js';
import { ShellModal }       from './components/ShellModal.js';
import { ThemeAnimations }  from './components/ThemeAnimations.js';
import { useDashboardStore } from './stores/dashboardStore.js';
import { useThemeStore }     from './stores/themeStore.js';
import { performRestart }    from './modules/deployment-handlers.js';
import { showNotification }  from './modules/formatters.js';

const { createApp, onMounted, onBeforeUnmount, ref, reactive, h } = Vue;

// ---------------------------------------------------------------------------
// Root Vue App
// ---------------------------------------------------------------------------

const app = createApp({
  components: { ServiceTable, FilterControls, AuthError, LegendModal, ConfirmModal, ServiceLogsModal, ShellModal, ThemeAnimations },

  setup() {
    const store = useDashboardStore();
    const themeStore = useThemeStore();

    // Legend modal visibility (local to this component)
    const legendModalVisible = ref(false);

    // Expose legend modal opener on window so the static HTML button can call it
    window.__openLegendModal = () => { legendModalVisible.value = true; };

    // -----------------------------------------------------------------------
    // Service logs modal state
    // -----------------------------------------------------------------------
    const serviceLogsModal = reactive({
      visible:     false,
      serviceName: '',
      namespace:   '',
      context:     '',
    });

    // -----------------------------------------------------------------------
    // Shell modal state (for shells opened from the service row)
    // Note: per-pod shells from the expanded Pods tab are handled inside
    // ServiceDetailsTabs directly. This covers any future top-level shell entry.
    // -----------------------------------------------------------------------
    const vueShellModal = reactive({
      visible:    false,
      podName:    '',
      namespace:  '',
      context:    '',
      containers: [],
    });

    // -----------------------------------------------------------------------
    // Service logs button handler
    // The ServiceRow renders a button with data-action="service-logs".
    // Vue's event delegation doesn't reach main.js's tbody listener, so we
    // catch clicks on #vue-root and open our Vue modal instead.
    // -----------------------------------------------------------------------
    function onVueRootClick(e) {
      // Service logs button
      const logsBtn = e.target.closest('[data-action="service-logs"]');
      if (logsBtn) {
        e.stopPropagation();
        const serviceName = logsBtn.dataset.service || '';
        if (!serviceName) return;
        serviceLogsModal.serviceName = serviceName;
        const svcForLogs = store.services.value.find(s => (s.serviceName || s.name) === serviceName);
        serviceLogsModal.namespace   = (svcForLogs && svcForLogs.namespace) || store.namespace.value;
        serviceLogsModal.context     = store.context.value;
        serviceLogsModal.visible     = true;
        return;
      }

      // Restart (reload) button on service row
      const restartBtn = e.target.closest('[data-action="restart"]');
      if (restartBtn) {
        e.stopPropagation();
        const serviceName = restartBtn.dataset.service || '';
        if (!serviceName) return;
        const svcForRestart = store.services.value.find(s => (s.serviceName || s.name) === serviceName);
        const ns  = (svcForRestart && svcForRestart.namespace) || store.namespace.value;
        const ctx = store.context.value;
        store.showConfirm({
          title:   'Reload Service',
          message: `Restart all pods for "${serviceName}" in namespace "${ns}"? Pods will be replaced one by one.`,
          onConfirm: async () => {
            try {
              await performRestart(serviceName, ns, ctx);
              showNotification('Restart initiated successfully!', 'success');
            } catch (err) {
              showNotification(`Restart failed: ${err.message}`, 'error');
            }
          },
        });
      }
    }

    // -----------------------------------------------------------------------
    // Floating refresh handlers — stable refs so removeEventListener works
    // -----------------------------------------------------------------------

    function _onFloatingScroll() {
      const btn = document.getElementById('floatingRefresh');
      if (!btn) return;
      btn.classList.toggle('visible', window.scrollY > 200);
    }

    function _onFloatingClick() {
      const btn = document.getElementById('floatingRefresh');
      store.fetchServices();
      if (btn) {
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 1000);
      }
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    onMounted(async () => {
      // Apply saved theme immediately at boot: swap CSS and populate badge.
      themeStore.swapThemeCSS(themeStore.currentTheme.value);
      themeStore.updateThemeBadge(themeStore.currentTheme.value);

      // Fix 2: wire the floating refresh button (scroll to show, click to refresh).
      const floatingBtn = document.getElementById('floatingRefresh');
      if (floatingBtn) {
        window.addEventListener('scroll', _onFloatingScroll);
        floatingBtn.addEventListener('click', _onFloatingClick);
      }

      try {
        // Bug 1 & 2: fetch contexts (and their namespaces) before services so
        // the dropdowns are populated on first render.
        await store.fetchContexts();
        if (store.availableContexts.value.length > 0) {
          await store.fetchNamespaces(store.context.value);
        }
        await store.fetchServices();
        store.startAutoRefresh();
      } catch (err) {
        console.error('[Vue App] Initial fetch failed:', err);
      }
    });

    onBeforeUnmount(() => {
      store.stopAutoRefresh();
      delete window.__openLegendModal;
      window.removeEventListener('scroll', _onFloatingScroll);
      const floatingBtn = document.getElementById('floatingRefresh');
      if (floatingBtn) floatingBtn.removeEventListener('click', _onFloatingClick);
    });

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    async function onRetry() {
      store.isRetrying.value = true;
      store.authError.value  = false;
      try {
        await store.fetchServices();
        store.startAutoRefresh();
      } catch (err) {
        console.error('[Vue App] Retry failed:', err);
      }
    }

    function onFiltersChanged(payload) {
      if (payload._action === 'refresh') {
        // Manual refresh requested — re-fetch and restart auto-refresh
        store.stopAutoRefresh();
        store.fetchServices().then(() => {
          store.startAutoRefresh();
        }).catch(err => {
          console.error('[Vue App] Manual refresh failed:', err);
        });
      }
    }

    // -----------------------------------------------------------------------
    // Render function
    // -----------------------------------------------------------------------

    return () => {
      const children = [];

      // ThemeAnimations — headless, controls canvas animations via lifecycle hooks.
      // Receives the current theme from themeStore so it can react to Vue-driven changes.
      children.push(
        h(ThemeAnimations, { theme: themeStore.currentTheme.value })
      );

      // FilterControls — renders .cyber-controls (which has its own margin-bottom via CSS)
      children.push(
        h(FilterControls, {
          availableContexts:   store.availableContexts.value,
          availableNamespaces: store.availableNamespaces.value,
          onFiltersChanged,
        })
      );

      // Auth error state — rendered instead of the table; does NOT early-return
      // so that modals appended below are always in the tree.
      if (store.authError.value) {
        children.push(
          h(AuthError, {
            message:  store.authErrorMessage.value,
            retrying: store.isRetrying.value,
            onRetry,
          })
        );
      } else if (store.isLoading.value && store.services.value.length === 0) {
        // Loading state (first load only — store.services is empty)
        children.push(
          h('div', { class: 'loading-initial' }, [
            h('div', { class: 'cyber-spinner' }),
            h('p', { class: 'loading-title' }, 'Loading services\u2026'),
            h('p', { class: 'loading-subtitle' }, 'Fetching cluster data')
          ])
        );
      } else {
        // Normal state: countdown label + optional loading bar + service table
        const isRefreshing = store.isLoading.value || store.isContextSwitching.value;

        const statusRow = h('div', {
          style: 'display:flex; align-items:center; justify-content:flex-end; min-height:20px; margin-bottom:6px; gap:8px;'
        }, [
          isRefreshing
            ? h('span', {
                style: 'font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;'
              }, [
                h('span', {
                  class: 'cyber-spinner',
                  style: 'width:12px; height:12px; border-width:2px;'
                }),
                store.isContextSwitching.value ? 'Switching context...' : 'Refreshing...'
              ])
            : store.secondsUntilRefresh.value != null
              ? h('span', {
                  style: 'font-size:0.75rem; color:var(--text-muted);'
                }, `Auto-refresh in ${store.secondsUntilRefresh.value}s`)
              : null
        ]);

        children.push(
          h('div', { style: isRefreshing ? 'opacity:0.6; transition:opacity 0.2s;' : 'transition:opacity 0.2s;' }, [
            statusRow,
            h(ServiceTable, {
              key:                 store.context.value,
              services:            store.filteredServices.value,
              highlightedServices: store.highlightedServices,
              secondsUntilRefresh: store.secondsUntilRefresh.value,
              context:             store.context.value,
              namespace:           store.namespace.value,
            })
          ])
        );
      }

      // Bug 3 fix: modals are ALWAYS appended, regardless of auth/loading state.
      // This ensures they can be opened (e.g. via window.__openLegendModal) even
      // during loading or auth-error screens.

      // LegendModal
      children.push(
        h(LegendModal, {
          visible: legendModalVisible.value,
          onClose: () => { legendModalVisible.value = false; }
        })
      );

      // ConfirmModal (driven by store.confirmModal)
      children.push(
        h(ConfirmModal, {
          visible:      store.confirmModal.visible,
          title:        store.confirmModal.title,
          message:      store.confirmModal.message,
          confirmLabel: 'Confirm',
          cancelLabel:  'Cancel',
          dangerous:    true,
          onConfirm: () => {
            if (typeof store.confirmModal.onConfirm === 'function') {
              store.confirmModal.onConfirm();
            }
            store.hideConfirm();
          },
          onCancel: () => store.hideConfirm()
        })
      );

      // ServiceLogsModal — opened when user clicks the logs button in a service row
      children.push(
        h(ServiceLogsModal, {
          visible:     serviceLogsModal.visible,
          serviceName: serviceLogsModal.serviceName,
          namespace:   serviceLogsModal.namespace,
          context:     serviceLogsModal.context,
          onClose:     () => { serviceLogsModal.visible = false; },
        })
      );

      // ShellModal (top-level — reserved for future use; per-pod shell lives in ServiceDetailsTabs)
      children.push(
        h(ShellModal, {
          visible:    vueShellModal.visible,
          podName:    vueShellModal.podName,
          namespace:  vueShellModal.namespace,
          context:    vueShellModal.context,
          containers: vueShellModal.containers,
          onClose:    () => { vueShellModal.visible = false; },
        })
      );

      // Fixed corner badge — shown only when a context tag is set
      const tag = store.contextTag.value;
      if (tag === 'prod' || tag === 'dev') {
        const isProd = tag === 'prod';
        children.push(
          h('div', {
            'aria-label': isProd ? 'Production environment' : 'Development environment',
            style: `
              position: fixed;
              top: 16px;
              right: 16px;
              z-index: 9000;
              padding: 6px 16px;
              border-radius: 6px;
              font-size: 0.85rem;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              pointer-events: none;
              box-shadow: 0 2px 12px rgba(0,0,0,0.4);
              border: 2px solid ${isProd ? '#f44336' : '#4caf50'};
              background: ${isProd ? 'rgba(74,26,26,0.92)' : 'rgba(26,74,26,0.92)'};
              color: ${isProd ? '#f44336' : '#4caf50'};
            `
          }, isProd ? '\u26a0 Production' : '\u25c6 Development')
        );
      }

      return h('div', {
        // Catch service-logs button clicks from ServiceRow (data-action delegation)
        onClick: onVueRootClick,
      }, children);
    };
  }
});

app.mount('#vue-root');
