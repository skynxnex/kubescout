/**
 * Vue 3 App — Problematic Pods Page
 *
 * Mounts to #vue-problematic-root in problematic-pods.html.
 * Primary renderer for the problematic pods view.
 *
 * Responsibilities:
 *   - Read namespace/context from the shared DOM selects (populated by problematic-pods.js)
 *   - Fetch /problematic-pods-local at mount and every 60 seconds
 *   - Render ProblematicPodsView
 *   - Mount ThemeAnimations and ThemeSelector via useThemeStore
 *     (same localStorage key as vanilla JS → consistent theme across pages)
 */

import { ProblematicPodsView } from './components/ProblematicPodsView.js';
import { ThemeAnimations }     from './components/ThemeAnimations.js';
import { ThemeSelector }       from './components/ThemeSelector.js';
import { useThemeStore }       from './stores/themeStore.js';

const { createApp, ref, onMounted, onBeforeUnmount, h } = Vue;

// ---------------------------------------------------------------------------
// Auto-refresh interval (ms) — matches vanilla JS implementation
// ---------------------------------------------------------------------------
const REFRESH_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Read selector values from the vanilla JS DOM elements.
// The Vue app intentionally does NOT own these selects — it reads the
// values set by the vanilla JS initialisation.
// ---------------------------------------------------------------------------

function getSelectedContext() {
  return document.getElementById('contextInput')?.value?.trim() || '';
}

function getSelectedNamespace() {
  return document.getElementById('namespaceInput')?.value?.trim() || '';
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

const ProblematicPodsApp = {
  components: { ProblematicPodsView, ThemeAnimations, ThemeSelector },

  setup() {
    console.log('[Problematic Pods Vue] Fas 7 initializing, Vue version:', Vue.version);

    const themeStore  = useThemeStore();
    const pods        = ref([]);
    const isLoading   = ref(false);
    const error       = ref(null);
    const namespace   = ref('');

    let refreshTimer = null;

    // -----------------------------------------------------------------------
    // Fetch
    // -----------------------------------------------------------------------

    async function fetchPods() {
      const ctx = getSelectedContext();
      const ns  = getSelectedNamespace();

      if (!ns) {
        // Namespace not yet selected — wait for vanilla JS to populate the select
        return;
      }

      namespace.value = ns;
      isLoading.value = true;
      error.value     = null;

      try {
        const url = `/problematic-pods-local?namespace=${encodeURIComponent(ns)}&context=${encodeURIComponent(ctx)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        pods.value  = data.pods || [];
        namespace.value = ns; // refresh after fetch in case user changed it
      } catch (err) {
        console.error('[Problematic Pods Vue] Fetch failed:', err);
        error.value = err.message || 'Unknown error';
      } finally {
        isLoading.value = false;
      }
    }

    // -----------------------------------------------------------------------
    // Auto-refresh
    // -----------------------------------------------------------------------

    function startAutoRefresh() {
      stopAutoRefresh();
      refreshTimer = setInterval(fetchPods, REFRESH_INTERVAL_MS);
      console.log(`[Problematic Pods Vue] Auto-refresh started (every ${REFRESH_INTERVAL_MS / 1000}s)`);
    }

    function stopAutoRefresh() {
      if (refreshTimer !== null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    onMounted(async () => {
      console.log('[Problematic Pods Vue] Mounted');

      // The vanilla JS DOMContentLoaded initialisation loads contexts and
      // namespaces asynchronously. Wait a short tick before the first fetch
      // so the selects are populated. The 60s auto-refresh handles subsequent
      // updates without any further synchronisation needed.
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchPods();
      startAutoRefresh();
    });

    onBeforeUnmount(() => {
      stopAutoRefresh();
    });

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return () => {
      const children = [];

      // ThemeAnimations — headless, manages canvas animations on theme change
      children.push(
        h(ThemeAnimations, { theme: themeStore.currentTheme.value })
      );

      // ThemeSelector row
      children.push(
        h('div', {
          style: 'margin-bottom: 16px; display: flex; justify-content: flex-end;',
        }, [
          h(ThemeSelector),
        ])
      );

      // Main pod view
      children.push(
        h(ProblematicPodsView, {
          pods:      pods.value,
          isLoading: isLoading.value,
          error:     error.value,
          namespace: namespace.value,
        })
      );

      return h('div', {
        id: 'vue-problematic-inner',
        style: 'padding: 0 0 48px;',
      }, children);
    };
  },
};

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const app = createApp(ProblematicPodsApp);
app.mount('#vue-problematic-root');

console.log('[Problematic Pods Vue] App mounted to #vue-problematic-root');
