/**
 * Vue 3 Dashboard Store - Fas 3
 *
 * Central reactive store for the Kubescout dashboard.
 * Uses the same localStorage keys as state-manager.js so the two systems
 * can read/write each other's persisted values without conflict.
 *
 * Storage key format (mirrors main.js):
 *   dashboard.state.modern-cyberpunk-local.v1.{context}
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { detectChanges } from '../utils/serviceDiff.js';

const { ref, reactive, computed, watch } = Vue;

// ---------------------------------------------------------------------------
// Storage key constants — must stay in sync with main.js
// ---------------------------------------------------------------------------
const STORAGE_KEY_PREFIX  = 'dashboard.state.modern-cyberpunk-local.v1';
const LAST_CONTEXT_KEY    = 'dashboard.lastContext.modern-cyberpunk-local.v1';

/**
 * Build the per-context storage key for the context environment tag.
 * Stored separately from the main state blob so it survives filter resets.
 */
function buildTagKey(ctx) {
  return 'dashboard.contextTag.v1.' + (ctx || 'default');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the per-context storage key used by state-manager.js / main.js.
 */
function buildStorageKey(context) {
  return `${STORAGE_KEY_PREFIX}.${context || 'default'}`;
}

/**
 * Safely read JSON from localStorage. Returns null on any error.
 */
function lsRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Safely write a value to localStorage. Silently ignores errors (e.g. private
 * browsing quota exceeded).
 */
function lsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: load persisted filter state for the last-used context
// ---------------------------------------------------------------------------

function loadInitialState() {
  // Use lsRead (JSON.parse) here — lsWrite serialises LAST_CONTEXT_KEY through
  // JSON.stringify, so a raw localStorage.getItem returns the value with extra
  // JSON quotes (e.g. '"eks-dev"' instead of 'eks-dev'), which breaks the
  // buildStorageKey lookup and causes context/namespace to reset on every reload.
  const lastContext = lsRead(LAST_CONTEXT_KEY) || '';
  const saved = lsRead(buildStorageKey(lastContext));

  return {
    context:       saved?.context        ?? lastContext ?? '',
    namespace:     saved?.namespace      ?? '',
    namespaces:    Array.isArray(saved?.namespaces) ? saved.namespaces
                   : (saved?.namespace ? [saved.namespace] : []),
    prefix:        saved?.prefix         ?? 'app-',
    search:        saved?.search         ?? '',
    showBad:       saved?.filterBad      ?? false,
    showWarn:      saved?.filterWarn     ?? false,
    showSingle:    saved?.filterSingle   ?? false,
    showRestarts:  saved?.filterRestarts ?? false,
    minRestarts:   typeof saved?.minRestarts === 'number' ? saved.minRestarts : 1,
    sortField:     saved?.sortField      ?? 'service',
    sortDir:       saved?.sortDir        ?? 'asc',
  };
}

// ---------------------------------------------------------------------------
// Singleton store state (created once, shared across all useDashboardStore()
// calls — standard Vue composable singleton pattern)
// ---------------------------------------------------------------------------

const initial = loadInitialState();

// Filter state — persisted to localStorage
const prefix       = ref(initial.prefix);
const search       = ref(initial.search);
const showBad      = ref(initial.showBad);
const showWarn     = ref(initial.showWarn);
const showSingle   = ref(initial.showSingle);
const showRestarts = ref(initial.showRestarts);
const minRestarts  = ref(initial.minRestarts);
const sortField    = ref(initial.sortField);
const sortDir      = ref(initial.sortDir);

// App state — not individually persisted (context/namespace written as part of
// the full state blob whenever filters save)
const context             = ref(initial.context);
const selectedNamespaces  = ref(initial.namespaces);
// Backward-compat alias: code that reads store.namespace.value still works
const namespace           = computed(() => selectedNamespaces.value[0] ?? '');
const isLoading           = ref(false);
const services            = ref([]);
const availableContexts   = ref([]);
const availableNamespaces = ref([]);
const restartRedThreshold = ref(
  typeof window.RESTART_RED_THRESHOLD === 'number'
    ? window.RESTART_RED_THRESHOLD
    : 3
);

// Context switching loading state — set while fetching namespaces after context change
const isContextSwitching = ref(false);

// ---------------------------------------------------------------------------
// Context tag — persisted per-context, independent of the main filter blob
// Values: 'prod' | 'dev' | ''
// ---------------------------------------------------------------------------
const contextTag = ref(lsRead(buildTagKey(initial.context)) || '');

// ---------------------------------------------------------------------------
// Fas 3: auth error state
// ---------------------------------------------------------------------------
const authError        = ref(false);
const authErrorMessage = ref('');
const isRetrying       = ref(false);

// ---------------------------------------------------------------------------
// Fas 4: confirm-modal state
// ---------------------------------------------------------------------------
const confirmModal = reactive({
  visible:   false,
  title:     '',
  message:   '',
  onConfirm: null,
});

function showConfirm({ title, message, onConfirm }) {
  confirmModal.title     = title     || 'Confirm';
  confirmModal.message   = message   || 'Are you sure?';
  confirmModal.onConfirm = onConfirm || null;
  confirmModal.visible   = true;
}

function hideConfirm() {
  confirmModal.visible   = false;
  confirmModal.onConfirm = null;
}

// ---------------------------------------------------------------------------
// Fas 3: highlight state — serviceName -> Set<fieldName>
// Populated by startAutoRefresh() when fields change between polls.
// Cleared after HIGHLIGHT_DURATION_MS milliseconds.
// ---------------------------------------------------------------------------
const highlightedServices = reactive(new Map());

// Mirrored from incremental-updates.js
const HIGHLIGHT_DURATION_MS         = 2000;
const AUTO_REFRESH_INTERVAL_MS      = 60000;
const COUNTDOWN_TICK_MS             = 1000;

// ---------------------------------------------------------------------------
// Fas 3: countdown state
// ---------------------------------------------------------------------------
const secondsUntilRefresh = ref(60);

// Internal timer handles — stored so stopAutoRefresh() can clear them
let _refreshTimer   = null;
let _countdownTimer = null;
let _nextUpdateTime = null;   // epoch ms of next scheduled refresh

// ---------------------------------------------------------------------------
// Fas 3: previous services snapshot for diff (plain array, not reactive)
// ---------------------------------------------------------------------------
let _previousServices = [];

// ---------------------------------------------------------------------------
// localStorage persistence via watchers
// The state blob shape matches exactly what state-manager.js writes so that
// both systems can restore each other's saved values.
// ---------------------------------------------------------------------------

// When true, watcher-triggered persistState() calls are no-ops.
// Used during context switch to prevent intermediate half-state from being saved.
let _suppressPersist = false;

/**
 * Persist all filter + env state to the per-context key.
 * Called by watchers below whenever any filter-related ref changes.
 */
function persistState() {
  if (_suppressPersist) return;
  const ctx = context.value;
  lsWrite(LAST_CONTEXT_KEY, ctx);
  const key = buildStorageKey(ctx);
  lsWrite(key, {
    context:       ctx,
    namespace:     selectedNamespaces.value[0] ?? '',  // backward compat
    namespaces:    selectedNamespaces.value,
    prefix:        prefix.value,
    search:        search.value,
    filterBad:     showBad.value,
    filterWarn:    showWarn.value,
    filterSingle:  showSingle.value,
    filterRestarts: showRestarts.value,
    minRestarts:   minRestarts.value,
    sortField:     sortField.value,
    sortDir:       sortDir.value,
  });
}

/**
 * Build a state snapshot for explicitly writing to localStorage.
 * Used during context switch to save the old context's state before any
 * refs change, bypassing the watcher-based system.
 */
function _buildStateSnapshot(ctx) {
  return {
    context:        ctx,
    namespace:      selectedNamespaces.value[0] ?? '',  // backward compat
    namespaces:     selectedNamespaces.value,
    prefix:         prefix.value,
    search:         search.value,
    filterBad:      showBad.value,
    filterWarn:     showWarn.value,
    filterSingle:   showSingle.value,
    filterRestarts: showRestarts.value,
    minRestarts:    minRestarts.value,
    sortField:      sortField.value,
    sortDir:        sortDir.value,
  };
}

// Watch each filter ref individually so any change triggers a save.
// We use { immediate: false } (the default) to avoid a redundant write on init.

// Prefix changes require a backend re-fetch (the API filters by prefix server-side).
// Debounce to avoid a fetch on every keystroke.
// If a fetch is already in progress when the debounce fires, wait for it to
// complete and then re-fetch with the updated prefix instead of dropping it.
let _prefixFetchTimer = null;
watch(prefix, () => {
  persistState();
  if (_suppressPersist) return; // skip fetch during context switch bulk-update
  clearTimeout(_prefixFetchTimer);
  _prefixFetchTimer = setTimeout(() => {
    if (isLoading.value) {
      // A fetch is in progress — watch for it to finish, then re-fetch once.
      const stop = watch(isLoading, (loading) => {
        if (!loading) {
          stop();
          fetchServices().catch(err => console.error('[Vue Store] Prefix fetch (deferred) failed:', err));
        }
      });
    } else {
      fetchServices().catch(err => console.error('[Vue Store] Prefix fetch failed:', err));
    }
  }, 400);
});

watch(search,       persistState);
watch(showBad,      persistState);
watch(showWarn,     persistState);
watch(showSingle,   persistState);
watch(showRestarts, persistState);
watch(minRestarts,  persistState);
watch(sortField,    persistState);
watch(sortDir,      persistState);
watch(context,            persistState);
watch(selectedNamespaces, persistState, { deep: true });

// Persist contextTag immediately when it changes (keyed per-context)
watch(contextTag, (tag) => {
  lsWrite(buildTagKey(context.value), tag);
});

// ---------------------------------------------------------------------------
// Status helper (mirrors main.js statusFor + incremental-updates.js
// getStatusForService — kept in sync manually)
// ---------------------------------------------------------------------------

function statusFor(item) {
  const readyCount    = Number(item.readyCount   ?? 0);
  const podCount      = Number(item.podCount     ?? 0);
  const restartCount  = Number(item.restartCount ?? 0);
  const restartReasons = item.restartReasons || {};
  const keys = Object.keys(restartReasons).map(k => String(k).toLowerCase());

  const hasOOMOrError = keys.includes('oomkilled') || keys.includes('error');
  const hasCompleted  = keys.includes('completed');
  const isBad  = (readyCount < podCount && restartCount > 0) || hasOOMOrError;
  const isWarn = !isBad && (hasCompleted || restartCount >= restartRedThreshold.value);

  if (isBad)  return { cls: 'row-bad',  pill: 'status-bad',  label: 'Bad' };
  if (isWarn) return { cls: 'row-warn', pill: 'status-warn', label: 'Warning' };
  return        { cls: '',             pill: 'status-ok',   label: 'Healthy' };
}

// ---------------------------------------------------------------------------
// Computed: filteredServices
// Mirrors applyFilters + applySearch + applySort from main.js
// ---------------------------------------------------------------------------

const filteredServices = computed(() => {
  let items = services.value;

  // 1. Apply prefix filter (comma-separated list)
  const prefixList = prefix.value
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  if (prefixList.length > 0) {
    items = items.filter(item =>
      prefixList.some(p => item.serviceName && item.serviceName.startsWith(p))
    );
  }

  // 2. Apply checkbox filters
  const hasActiveFilters = showBad.value || showWarn.value || showSingle.value || showRestarts.value;
  if (hasActiveFilters) {
    items = items.filter(item => {
      const status = statusFor(item);
      let matches = false;
      if (showBad.value      && status.cls === 'row-bad')                       matches = true;
      if (showWarn.value     && status.cls === 'row-warn')                      matches = true;
      if (showSingle.value   && item.podCount === 1)                            matches = true;
      if (showRestarts.value && item.restartCount >= (minRestarts.value || 1))  matches = true;
      return matches;
    });
  }

  // 3. Apply search (comma-separated OR logic)
  const terms = search.value
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length > 0) {
    items = items.filter(item => {
      const name = item.serviceName ? item.serviceName.toLowerCase() : '';
      return terms.some(term => name.includes(term));
    });
  }

  // 4. Apply sort
  const field = sortField.value;
  const dir   = sortDir.value;
  const sorted = [...items];
  sorted.sort((a, b) => {
    let aVal, bVal;
    if (field === 'pods') {
      aVal = a.podCount;           bVal = b.podCount;
    } else if (field === 'restarts') {
      aVal = a.restartCount;       bVal = b.restartCount;
    } else if (field === 'deployed') {
      aVal = a.deployedAtEpochSeconds || 0; bVal = b.deployedAtEpochSeconds || 0;
    } else {
      aVal = a.serviceName || '';  bVal = b.serviceName || '';
    }
    if (aVal < bVal) return dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return dir === 'asc' ?  1 : -1;
    return 0;
  });

  return sorted;
});

// ---------------------------------------------------------------------------
// Fas 3: actions
// ---------------------------------------------------------------------------

/**
 * Build the API URL for fetching services.
 * Mirrors the URL-building logic in loadData() / fetchServiceList() in main.js.
 *
 * Uses:
 *   window.IS_LOCAL_MODE  — true when running against local kubeconfig
 *   store.context.value   — kubeconfig context name (local mode only)
 *   store.namespace.value — Kubernetes namespace
 *   store.prefix.value    — comma-separated service name prefixes
 */
function buildServicesUrl() {
  const isLocal   = window.IS_LOCAL_MODE || false;
  const endpoint  = isLocal ? '/services-local' : '/services';
  const params    = new URLSearchParams();

  if (isLocal && context.value) {
    params.append('context', context.value);
  }

  const namespacesToUse = isLocal
    ? selectedNamespaces.value
    : (window.IN_CLUSTER_NAMESPACE ? [window.IN_CLUSTER_NAMESPACE] : []);
  namespacesToUse.forEach(ns => params.append('namespace', ns));

  // Parse comma-separated prefixes; fall back to 'app-'
  const prefixList = prefix.value
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  if (prefixList.length > 0) {
    prefixList.forEach(p => params.append('prefix', p));
  } else {
    params.append('prefix', 'app-');
  }

  return `${endpoint}?${params.toString()}`;
}

/**
 * Fetch the full service list from the API and update store.services.
 * Handles auth errors (401/403) by setting authError state.
 * All other errors are re-thrown so callers can decide how to handle them.
 */
async function fetchServices() {
  if (isLoading.value) return;

  isLoading.value = true;
  authError.value = false;

  try {
    const url      = buildServicesUrl();
    console.log('[Vue Store] Fetching services from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authError.value        = true;
        authErrorMessage.value =
          'AWS SSO session expired. Run "aws sso login" in your terminal — the page will recover automatically, or click Retry.';
        console.error('[Vue Store] Auth error:', response.status);
        return;
      }

      // Non-auth error — try to extract message
      let msg = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body.message) msg = body.message;
      } catch { /* ignore parse errors */ }

      throw new Error(msg);
    }

    const data            = await response.json();
    const newServices     = data.services || [];

    // Compute diff against previous snapshot and schedule highlights
    if (_previousServices.length > 0) {
      const diff = detectChanges(_previousServices, newServices);
      _applyHighlights(diff.updated);
    }

    _previousServices = newServices;
    services.value    = newServices;

    console.log('[Vue Store] Services loaded:', newServices.length);
  } finally {
    isLoading.value  = false;
    isRetrying.value = false;
  }
}

/**
 * Apply highlight state for changed services.
 * Each changed service gets an entry in highlightedServices (Map<name, Set<field>>).
 * The entry is removed after HIGHLIGHT_DURATION_MS.
 *
 * @param {Array<{ old, new, fieldChanges }>} updatedList
 */
function _applyHighlights(updatedList) {
  updatedList.forEach(change => {
    const name   = (change.new.namespace || '') + '/' + change.new.serviceName;
    const fields = new Set(change.fieldChanges.map(fc => fc.field));

    // Merge with any existing highlights for this service
    const existing = highlightedServices.get(name);
    const merged   = existing ? new Set([...existing, ...fields]) : fields;
    highlightedServices.set(name, merged);

    // Schedule removal
    setTimeout(() => {
      highlightedServices.delete(name);
    }, HIGHLIGHT_DURATION_MS);
  });
}

/**
 * Start the auto-refresh cycle:
 *   - Runs fetchServices() every AUTO_REFRESH_INTERVAL_MS milliseconds
 *   - Updates secondsUntilRefresh every second (countdown)
 */
function startAutoRefresh() {
  stopAutoRefresh(); // clear any previous timers

  _nextUpdateTime = Date.now() + AUTO_REFRESH_INTERVAL_MS;
  secondsUntilRefresh.value = Math.round(AUTO_REFRESH_INTERVAL_MS / 1000);

  // Countdown ticker
  _countdownTimer = setInterval(() => {
    if (!_nextUpdateTime) return;
    const ms = Math.max(0, _nextUpdateTime - Date.now());
    secondsUntilRefresh.value = Math.ceil(ms / 1000);
  }, COUNTDOWN_TICK_MS);

  // Refresh trigger
  _refreshTimer = setInterval(async () => {
    try {
      await fetchServices();
    } catch (err) {
      console.error('[Vue Store] Auto-refresh fetch failed:', err);
    }
    // Reset countdown for next cycle (only if still running)
    if (_refreshTimer) {
      _nextUpdateTime           = Date.now() + AUTO_REFRESH_INTERVAL_MS;
      secondsUntilRefresh.value = Math.round(AUTO_REFRESH_INTERVAL_MS / 1000);
    }
  }, AUTO_REFRESH_INTERVAL_MS);
}

/**
 * Stop the auto-refresh cycle and clear all timers.
 */
function stopAutoRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  if (_countdownTimer) {
    clearInterval(_countdownTimer);
    _countdownTimer = null;
  }
  _nextUpdateTime = null;
}

// ---------------------------------------------------------------------------
// Context and namespace fetching
// Mirrors fetchContexts() and fetchNamespaces() from main.js
// ---------------------------------------------------------------------------

/**
 * Fetch the list of available kubeconfig contexts from the API.
 * Populates availableContexts and restores the last-used context if present.
 * No-op in in-cluster mode (IS_LOCAL_MODE is false).
 */
async function fetchContexts() {
  const isLocal = window.IS_LOCAL_MODE || false;
  if (!isLocal) return;

  try {
    const response = await fetch('/contexts-local');
    if (!response.ok) {
      console.error('[Vue Store] fetchContexts HTTP error:', response.status);
      return;
    }
    const data = await response.json();
    const contexts = data.contexts || [];
    availableContexts.value = contexts;
    console.log('[Vue Store] Available contexts:', contexts);

    // Restore last-used context if it still exists in the list.
    // If the current context is not in the list (e.g. first load with empty
    // LAST_CONTEXT_KEY), switch to the first available context while loading
    // its saved state, so we don't overwrite a previously saved custom prefix
    // with the defaults that loadInitialState() fell back to.
    const current = context.value;
    if (current && contexts.includes(current)) {
      // Already on a valid context — nothing to change.
    } else if (contexts.length > 0) {
      const target = contexts[0];
      const saved  = lsRead(buildStorageKey(target));
      _suppressPersist = true;
      try {
        context.value = target;
        contextTag.value = lsRead(buildTagKey(target)) || '';
        if (saved) {
          if (saved.prefix         !== undefined) prefix.value       = saved.prefix;
          if (saved.namespaces !== undefined) selectedNamespaces.value = saved.namespaces;
          else if (saved.namespace !== undefined) selectedNamespaces.value = saved.namespace ? [saved.namespace] : [];
          if (saved.filterBad      !== undefined) showBad.value      = saved.filterBad;
          if (saved.filterWarn     !== undefined) showWarn.value     = saved.filterWarn;
          if (saved.filterSingle   !== undefined) showSingle.value   = saved.filterSingle;
          if (saved.filterRestarts !== undefined) showRestarts.value = saved.filterRestarts;
          if (typeof saved.minRestarts === 'number') minRestarts.value = saved.minRestarts;
          if (saved.sortField      !== undefined) sortField.value    = saved.sortField;
          if (saved.sortDir        !== undefined) sortDir.value      = saved.sortDir;
        }
      } finally {
        _suppressPersist = false;
        persistState();
      }
    }
  } catch (err) {
    console.error('[Vue Store] fetchContexts failed:', err);
  }
}

/**
 * Fetch the list of namespaces available for the given context.
 * Populates availableNamespaces and preserves the currently-selected
 * namespace when it still exists in the new list.
 *
 * @param {string} ctx - kubeconfig context name
 */
async function fetchNamespaces(ctx) {
  const isLocal = window.IS_LOCAL_MODE || false;
  if (!isLocal || !ctx) return;

  try {
    const url = `/namespaces-local?context=${encodeURIComponent(ctx)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Vue Store] fetchNamespaces HTTP error:', response.status);
      return;
    }
    const data = await response.json();
    const namespaces = data.namespaces || [];
    availableNamespaces.value = namespaces;
    console.log('[Vue Store] Available namespaces for', ctx, ':', namespaces);

    // Preserve selected namespaces that are still valid, otherwise pick first
    const stillValid = selectedNamespaces.value.filter(ns => namespaces.includes(ns));
    if (stillValid.length > 0) {
      selectedNamespaces.value = stillValid;
    } else if (namespaces.length > 0) {
      selectedNamespaces.value = [namespaces[0]];
    }
  } catch (err) {
    console.error('[Vue Store] fetchNamespaces failed:', err);
  }
}

/**
 * Handle a context change from the UI:
 *   1. Update context ref
 *   2. Fetch namespaces for the new context
 *   3. Re-fetch services with the new context/namespace
 *
 * @param {string} newContext - the newly selected context name
 */
async function onContextChange(newContext) {
  if (!newContext || newContext === context.value) return;
  const oldContext = context.value;

  // Suppress watcher-driven saves during the bulk state swap so we never
  // write a half-switched state to either context's storage key.
  _suppressPersist = true;
  try {
    // 1. Explicitly save the old context's current state before changing anything.
    lsWrite(buildStorageKey(oldContext), _buildStateSnapshot(oldContext));

    // 2. Load saved state for the new context and restore all refs.
    const saved = lsRead(buildStorageKey(newContext));
    context.value = newContext;
    contextTag.value = lsRead(buildTagKey(newContext)) || '';
    search.value = '';
    if (saved) {
      if (saved.prefix         !== undefined) prefix.value       = saved.prefix;
      if (saved.namespaces !== undefined) selectedNamespaces.value = saved.namespaces;
      else if (saved.namespace !== undefined) selectedNamespaces.value = saved.namespace ? [saved.namespace] : [];
      if (saved.filterBad      !== undefined) showBad.value      = saved.filterBad;
      if (saved.filterWarn     !== undefined) showWarn.value     = saved.filterWarn;
      if (saved.filterSingle   !== undefined) showSingle.value   = saved.filterSingle;
      if (saved.filterRestarts !== undefined) showRestarts.value = saved.filterRestarts;
      if (typeof saved.minRestarts === 'number') minRestarts.value = saved.minRestarts;
      if (saved.sortField      !== undefined) sortField.value    = saved.sortField;
      if (saved.sortDir        !== undefined) sortDir.value      = saved.sortDir;
    }
  } finally {
    _suppressPersist = false;
    // 3. Now write the fully-restored new state to the new context's key.
    persistState();
  }

  // Stop the running auto-refresh cycle so the countdown resets cleanly
  // after the new context's services have loaded.
  stopAutoRefresh();

  isContextSwitching.value = true;
  try {
    await fetchNamespaces(newContext);
  } finally {
    isContextSwitching.value = false;
  }
  await fetchServices();

  // Restart auto-refresh with a fresh 60 s countdown.
  startAutoRefresh();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the singleton store. Safe to call multiple times — always the same
 * reactive state object is returned.
 */
export function useDashboardStore() {
  return {
    // Filter state
    prefix,
    search,
    showBad,
    showWarn,
    showSingle,
    showRestarts,
    minRestarts,
    sortField,
    sortDir,

    // App state
    context,
    namespace,
    selectedNamespaces,
    isLoading,
    services,
    availableContexts,
    availableNamespaces,
    restartRedThreshold,

    // Context switching
    isContextSwitching,

    // Fas 3: auth error
    authError,
    authErrorMessage,
    isRetrying,

    // Fas 3: highlights & countdown
    highlightedServices,
    secondsUntilRefresh,

    // Derived
    filteredServices,

    // Fas 3: actions
    fetchServices,
    fetchContexts,
    fetchNamespaces,
    onContextChange,
    startAutoRefresh,
    stopAutoRefresh,

    // Fas 4: confirm modal
    confirmModal,
    showConfirm,
    hideConfirm,

    // Helpers exposed so callers can build storage keys if needed
    buildStorageKey,

    // Context environment tag ('prod' | 'dev' | '')
    contextTag,
  };
}
