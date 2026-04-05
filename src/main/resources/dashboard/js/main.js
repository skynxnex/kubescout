/**
 * Dashboard - Main Entry Point (Local Mode)
 * Multi-theme dashboard with live updates
 * Uses /services-local and /service-pods-local endpoints
 */

console.log('[Dashboard] JavaScript loaded');

// Import from dashboard modules
import { initTheme } from './modules/theme.js';
import { animateRowExpansion, rotateChevron } from './modules/animations.js';
import {
  renderServiceRow,
  renderPodDetails,
  renderExpandButton,
  renderServiceDetailsTabs,
  renderScaleControls
} from './modules/ui-components.js';
import {
  startIncrementalUpdates,
  stopIncrementalUpdates,
  initializeServiceList
} from './modules/incremental-updates.js';
import { initMatrixRain, stopMatrixRain, isMatrixRainActive } from './modules/matrix-rain.js';
import { initAutumnLeaves, stopAutumnLeaves, isAutumnLeavesActive } from './modules/autumn-leaves.js';
import { initStarfield, stopStarfield, isStarfieldActive } from './modules/starfield.js';
import { initAiHelp } from './modules/ai-help.js';
import { fmtCpuVal, fmtMemVal, fmtAge } from './modules/formatters.js';
import {
  escapeHtml,
  formatTimestamp,
  showNotification,
  showToast,
  copyToClipboard,
  showConfirmModal,
  handleTabAuthError,
  attachCopyHandlers,
  loadEndpointsTab,
  loadEventsTab,
  attachEventsHandlers,
  showPodLogsModal,
  showServiceLogsModal,
  attachPodLogsHandlers,
  attachLogViewerHandlers,
  loadConfigsTab,
  attachConfigsHandlers,
  extractImageTag,
  showRollbackModal,
  attachRollbackHandlers,
  loadDeploymentHistoryTab,
  performRestart,
  showRestartModal,
  initScaleControls,
  performScaleDeployment,
  attachPodShellHandlers
} from './modules/feature-handlers.js';

// Import state management
import {
  saveState as saveStateToStorage,
  loadState as loadStateFromStorage,
  resetState as resetStateToDefaults
} from './state-manager.js';

// Configuration
const STORAGE_KEY_PREFIX = 'dashboard.state.modern-cyberpunk-local.v1';
const STORAGE_UI_KEY_PREFIX = 'dashboard.ui.modern-cyberpunk-local.v1';
const LAST_CONTEXT_KEY = 'dashboard.lastContext.modern-cyberpunk-local.v1';
const THEME_STORAGE_KEY = 'dashboard.theme.v1';
const FLOATING_REFRESH_SCROLL_THRESHOLD_PX = 200;

// State
let isLoading = false;
let searchDebounceTimer = null;
let lastLoadedServices = [];
let isFirstLoad = true;
let availableNamespaces = [];
let availableContexts = [];
let currentContext = '';
let authRetryTimer = null;
let authRetryCount = 0;
let authRetryFn = null;
const MAX_AUTH_RETRIES = 20;

// Data cache for service details
const serviceDataCache = {
  endpoints: new Map(),
  events: new Map(),
  configs: new Map(),
  logs: new Map()
};

// Get context-specific storage keys
function getStorageKey() {
  const contextEl = document.getElementById('contextInput');
  const context = contextEl?.value?.trim() || currentContext || 'default';
  return `${STORAGE_KEY_PREFIX}.${context}`;
}

function getStorageUIKey() {
  const contextEl = document.getElementById('contextInput');
  const context = contextEl?.value?.trim() || currentContext || 'default';
  return `${STORAGE_UI_KEY_PREFIX}.${context}`;
}

/**
 * Save last used context globally (not per-context)
 */
function saveLastUsedContext(context) {
  try {
    localStorage.setItem(LAST_CONTEXT_KEY, context);
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to save last context:', error);
  }
}

/**
 * Get last used context
 */
function getLastUsedContext() {
  try {
    return localStorage.getItem(LAST_CONTEXT_KEY);
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to get last context:', error);
    return null;
  }
}

// Get configuration from global window object (set by template)
const RESTART_RED_THRESHOLD = window.RESTART_RED_THRESHOLD || 3;
const PRESETS = window.PRESETS || {};
const IS_LOCAL_MODE = window.IS_LOCAL_MODE || false;

// Humio configuration
const HUMIO_BASE_URL = window.HUMIO_BASE_URL || 'https://cloud.humio.com';
const HUMIO_REPO = window.HUMIO_REPO || '';
const HUMIO_TZ = window.HUMIO_TZ || 'Europe/Stockholm';
const HUMIO_START = window.HUMIO_START || '7d';
const HUMIO_NAMESPACE = window.HUMIO_NAMESPACE || '';

console.log('[Modern Cyberpunk] Config:', { RESTART_RED_THRESHOLD, PRESETS, IS_LOCAL_MODE });

// ==============================================
// Utility Functions
// ==============================================

/**
 * Format deployment timestamp
 */
function fmtDeploy(item) {
  if (!item.deployedAtEpochSeconds) return '';
  try {
    const d = new Date(item.deployedAtEpochSeconds * 1000);
    return d.toLocaleString();
  } catch (e) {
    return '';
  }
}

/**
 * Format HPA info
 */
function fmtHpa(item) {
  const min = item.hpaMinReplicas;
  const max = item.hpaMaxReplicas;
  const cur = item.hpaCurrentReplicas;
  const des = item.hpaDesiredReplicas;
  if (min == null && max == null && cur == null && des == null) return '';

  let main = '';
  if (cur != null && des != null) main = String(cur) + '/' + String(des);
  else if (cur != null) main = String(cur);
  else if (des != null) main = String(des);

  let range = '';
  if (min != null || max != null) {
    range = '(' + (min != null ? String(min) : '') + '-' + (max != null ? String(max) : '') + ')';
  }
  return [main, range].filter(Boolean).join(' ');
}

/**
 * Calculate service status
 */
function statusFor(item) {
  const readyCount = Number(item.readyCount ?? 0);
  const podCount = Number(item.podCount ?? 0);
  const restartCount = Number(item.restartCount ?? 0);
  const restartReasons = item.restartReasons || {};
  const keys = Object.keys(restartReasons).map(k => String(k).toLowerCase());

  const hasOOMOrError = keys.includes('oomkilled') || keys.includes('error');
  const hasCompleted = keys.includes('completed');
  const isBad = (readyCount < podCount && restartCount > 0) || hasOOMOrError;
  const isWarn = !isBad && (hasCompleted || restartCount >= RESTART_RED_THRESHOLD);

  if (isBad) return { cls: 'row-bad', pill: 'status-bad', label: 'Bad' };
  if (isWarn) return { cls: 'row-warn', pill: 'status-warn', label: 'Warning' };
  return { cls: '', pill: 'status-ok', label: 'Healthy' };
}

/**
 * Track which service details are open
 */
const openServiceDetails = new Set();

/**
 * Check if service details are open
 */
function isDetailsOpen(serviceName) {
  return openServiceDetails.has(serviceName);
}

/**
 * Save UI state (expanded services)
 */
function saveUIState() {
  try {
    const uiState = {
      openServices: Array.from(openServiceDetails)
    };
    localStorage.setItem(getStorageUIKey(), JSON.stringify(uiState));
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to save UI state:', error);
  }
}

/**
 * Load UI state (expanded services)
 */
function loadUIState() {
  try {
    const savedData = localStorage.getItem(getStorageUIKey());
    if (!savedData) return;

    const uiState = JSON.parse(savedData);
    if (uiState.openServices && Array.isArray(uiState.openServices)) {
      openServiceDetails.clear();
      uiState.openServices.forEach(serviceName => openServiceDetails.add(serviceName));
      console.log('[Modern Cyberpunk] Loaded UI state:', openServiceDetails);
    }
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to load UI state:', error);
  }
}

/**
 * Save state to localStorage
 */
function saveState() {
  saveStateToStorage(getStorageKey());

  // Also save this as the last used context
  const contextEl = document.getElementById('contextInput');
  const context = contextEl?.value?.trim();
  if (context) {
    saveLastUsedContext(context);
  }
}

/**
 * Load state from localStorage
 */
function loadState() {
  loadStateFromStorage(getStorageKey());
  updateFilterChipsVisualState();
}

/**
 * Update filter chips visual state
 */
function updateFilterChipsVisualState() {
  const chips = [
    { chip: 'filterBadChip', input: 'filterBad' },
    { chip: 'filterWarnChip', input: 'filterWarn' },
    { chip: 'filterSingleChip', input: 'filterSingle' },
    { chip: 'filterRestartsChip', input: 'filterRestarts' }
  ];

  chips.forEach(({ chip, input }) => {
    const chipEl = document.getElementById(chip);
    const inputEl = document.getElementById(input);
    if (chipEl && inputEl) {
      chipEl.classList.toggle('active', inputEl.checked);
    }
  });
}

/**
 * Set default values
 */
function setDefault() {
  resetStateToDefaults();
  updateFilterChipsVisualState();
  saveState();
  loadData();
}

/**
 * Update restart filter enabled state
 */
function updateRestartFilterEnabled() {
  const checkbox = document.getElementById('filterRestarts');
  const input = document.getElementById('minRestartsInput');
  if (checkbox && input) {
    input.disabled = !checkbox.checked;
  }
  updateFilterChipsVisualState();
}

// ==============================================
// Data Loading
// ==============================================

/**
 * Fetch available contexts
 */
async function fetchContexts() {
  try {
    const endpoint = IS_LOCAL_MODE ? '/contexts-local' : '/contexts';
    const response = await fetch(endpoint);

    if (!response.ok) {
      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        console.error('[Modern Cyberpunk] Auth error when fetching contexts:', response.status);
        handleAuthError(initLocalMode);
        return [];
      }

      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (authRetryTimer) {
      clearTimeout(authRetryTimer);
      authRetryTimer = null;
      authRetryCount = 0;
      authRetryFn = null;
    }
    availableContexts = data.contexts || [];

    console.log('[Modern Cyberpunk] Available contexts:', availableContexts);

    const contextSelect = document.getElementById('contextInput');
    if (contextSelect) {
      // Populate dropdown with available contexts
      contextSelect.innerHTML = availableContexts.map(ctx =>
        `<option value="${ctx}">${ctx}</option>`
      ).join('');

      // Try to restore last used context
      const lastContext = getLastUsedContext();
      console.log('[Modern Cyberpunk] Last used context from storage:', lastContext);

      if (lastContext && availableContexts.includes(lastContext)) {
        contextSelect.value = lastContext;
        console.log('[Modern Cyberpunk] ✅ Restored last used context:', lastContext);
      } else {
        console.log('[Modern Cyberpunk] ⚠️ Could not restore context. Last:', lastContext, 'Available:', availableContexts);
      }

      // Set current context to the selected value
      currentContext = contextSelect.value;
      console.log('[Modern Cyberpunk] Current context set to:', currentContext);

      // Save this as the last used context (ensure it's persisted)
      saveLastUsedContext(currentContext);
    }

    return availableContexts;
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to fetch contexts:', error);
    showNotification('Failed to fetch contexts: ' + error.message, 'error');
    return [];
  }
}

/**
 * Fetch namespaces for current context
 */
async function fetchNamespaces(context) {
  try {
    const endpoint = IS_LOCAL_MODE ? '/namespaces-local' : '/namespaces';
    const url = `${endpoint}?context=${encodeURIComponent(context)}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        console.error('[Modern Cyberpunk] Auth error when fetching namespaces:', response.status);
        handleAuthError(initLocalMode);
        return [];
      }

      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (authRetryTimer) {
      clearTimeout(authRetryTimer);
      authRetryTimer = null;
      authRetryCount = 0;
      authRetryFn = null;
    }
    availableNamespaces = data.namespaces || [];

    const namespaceSelect = document.getElementById('namespaceInput');
    if (namespaceSelect) {
      const currentNamespace = namespaceSelect.value;
      namespaceSelect.innerHTML = availableNamespaces.map(ns =>
        `<option value="${ns}">${ns}</option>`
      ).join('');

      // Restore previously selected namespace if it still exists
      if (currentNamespace && availableNamespaces.includes(currentNamespace)) {
        namespaceSelect.value = currentNamespace;
      }
    }

    return availableNamespaces;
  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to fetch namespaces:', error);
    showNotification('Failed to fetch namespaces: ' + error.message, 'error');
    return [];
  }
}

/**
 * Handle context change
 */
async function onContextChange() {
  const contextSelect = document.getElementById('contextInput');
  const newContext = contextSelect?.value;

  if (newContext && newContext !== currentContext) {
    console.log(`[Modern Cyberpunk] Context changed: ${currentContext} → ${newContext}`);

    // Update current context
    currentContext = newContext;

    // Save as last used context
    saveLastUsedContext(newContext);

    // Fetch namespaces for new context
    await fetchNamespaces(newContext);

    // Load state for new context (will restore namespace AND filters for this context)
    loadState();

    // Load UI state (expanded services) for this context
    loadUIState();

    // Update filter chips visual state after loading state
    updateFilterChipsVisualState();

    // Reload data with the new context's saved state
    scheduleLoadData();
  }
}

// ==============================================
// API Helper Functions
// ==============================================

/**
 * Build query string from prefixes, namespace, and context
 */
function toQuery(prefixes, namespace, context) {
  const params = [];

  if (Array.isArray(prefixes) && prefixes.length > 0) {
    prefixes.forEach(p => params.push('prefix=' + encodeURIComponent(p)));
  }

  if (namespace) {
    params.push('namespace=' + encodeURIComponent(namespace));
  }

  if (context) {
    params.push('context=' + encodeURIComponent(context));
  }

  return params.join('&');
}

/**
 * Fetch with automatic retry on failure
 */
function fetchWithRetry(url, retries = 3, timeout = 30000) {
  return fetch(url, { signal: AbortSignal.timeout(timeout) })
    .catch(err => {
      if (retries > 0) {
        return new Promise(resolve => setTimeout(resolve, 1000))
          .then(() => fetchWithRetry(url, retries - 1, timeout));
      }
      throw err;
    });
}

/**
 * Fetch service list (for incremental updates)
 * This only fetches the raw list without client-side filtering
 */
async function fetchServiceList() {
  const raw = document.getElementById('prefixInput').value || 'app-';
  const namespace = IS_LOCAL_MODE
    ? (document.getElementById('namespaceInput')?.value || '')
    : (window.IN_CLUSTER_NAMESPACE || '');
  const context = IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value || '') : '';

  const prefixes = raw.split(',').map(p => p.trim()).filter(Boolean);
  const url = '/services-local?' + toQuery(prefixes, namespace, context);

  const response = await fetchWithRetry(url);

  // Check for auth errors specifically
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const authError = new Error('Authentication failed');
      authError.isAuthError = true;
      authError.statusCode = response.status;
      throw authError;
    }

    const result = await response.json();
    throw new Error(result.message || 'Failed to fetch services');
  }

  const result = await response.json();
  return result.services || [];
}

/**
 * Get current filter state (for incremental updates)
 */
function getCurrentFilters() {
  return {
    showBad: document.getElementById('filterBad').checked,
    showWarn: document.getElementById('filterWarn').checked,
    showSingle: document.getElementById('filterSingle').checked,
    showRestarts: document.getElementById('filterRestarts').checked,
    minRestarts: parseInt(document.getElementById('minRestartsInput')?.value || '1', 10),
    searchQuery: (document.getElementById('searchInput').value || '').trim(),
    sortField: document.getElementById('sortField').value || 'service',
    sortDir: document.getElementById('sortDir').value || 'asc'
  };
}

// ==============================================
// Input Management
// ==============================================

/**
 * Disable/Enable all inputs to prevent race conditions during loading
 */
function disableInputs(disabled) {
  const inputs = [
    'contextInput',
    'namespaceInput',
    'prefixInput',
    'searchInput',
    'filterBad',
    'filterWarn',
    'filterSingle',
    'filterRestarts',
    'minRestartsInput',
    'sortField',
    'sortDir'
  ];

  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = disabled;

      // Also update visual state for filter chips
      if (id.startsWith('filter')) {
        const chipId = id + 'Chip';
        const chip = document.getElementById(chipId);
        if (chip) {
          if (disabled) {
            chip.style.opacity = '0.5';
            chip.style.pointerEvents = 'none';
          } else {
            chip.style.opacity = '';
            chip.style.pointerEvents = '';
          }
        }
      }
    }
  });
}

// ==============================================
// Client-Side Filtering, Search, and Sorting
// ==============================================

/**
 * Apply filters to service list
 * Filters are applied client-side since backend returns all services
 */
function applyFilters(items, showBad, showWarn, showSingle, showRestarts, minRestarts) {
  return items.filter(item => {
    const status = statusFor(item);
    const hasActiveFilters = showBad || showWarn || showSingle || showRestarts;

    if (!hasActiveFilters) return true;

    let matches = false;
    if (showBad && status.cls === 'row-bad') matches = true;
    if (showWarn && status.cls === 'row-warn') matches = true;
    if (showSingle && item.podCount === 1) matches = true;
    if (showRestarts && item.restartCount >= minRestarts) matches = true;

    return matches;
  });
}

/**
 * Apply search query to service list
 */
function applySearch(items, query) {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(item => item.serviceName && item.serviceName.toLowerCase().includes(q));
}

/**
 * Apply sorting to service list
 */
function applySort(items, sortField, sortDir) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'pods') {
      aVal = a.podCount; bVal = b.podCount;
    } else if (sortField === 'restarts') {
      aVal = a.restartCount; bVal = b.restartCount;
    } else if (sortField === 'deployed') {
      aVal = a.deployedAtEpochSeconds || 0; bVal = b.deployedAtEpochSeconds || 0;
    } else {
      aVal = a.serviceName || ''; bVal = b.serviceName || '';
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

/**
 * Schedule data load with debounce
 */
function scheduleLoadData() {
  // Save state immediately when user makes changes
  // This ensures their input is preserved even if the request fails
  saveState();

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = setTimeout(() => {
    loadData();
  }, 300);
}

/**
 * Load data from server
 */
async function loadData() {
  if (isLoading) {
    console.log('[Modern Cyberpunk] Already loading, skipping...');
    return;
  }

  // Save state immediately before loading
  // This ensures user input is preserved even if the request fails
  saveState();

  // Clear service data cache on refresh
  serviceDataCache.endpoints.clear();
  serviceDataCache.events.clear();
  serviceDataCache.configs.clear();
  serviceDataCache.logs.clear();

  isLoading = true;
  const loadingIndicator = document.getElementById('loadingIndicator');
  const refreshButton = document.getElementById('refreshButton');
  const floatingRefresh = document.getElementById('floatingRefresh');

  if (loadingIndicator) loadingIndicator.classList.add('active');
  if (refreshButton) refreshButton.disabled = true;
  if (floatingRefresh) floatingRefresh.classList.add('spinning');

  // Disable all inputs while loading to prevent race conditions
  disableInputs(true);

  try {
    const context = IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value?.trim() || '') : '';
    const namespace = IS_LOCAL_MODE
      ? (document.getElementById('namespaceInput')?.value?.trim() || '')
      : (window.IN_CLUSTER_NAMESPACE || '');
    const prefixValue = document.getElementById('prefixInput')?.value || '';
    const search = document.getElementById('searchInput')?.value || '';
    const filterBad = document.getElementById('filterBad')?.checked || false;
    const filterWarn = document.getElementById('filterWarn')?.checked || false;
    const filterSingle = document.getElementById('filterSingle')?.checked || false;
    const filterRestarts = document.getElementById('filterRestarts')?.checked || false;
    const minRestarts = parseInt(document.getElementById('minRestartsInput')?.value || '1', 10);
    const sortField = document.getElementById('sortField')?.value || 'service';
    const sortDir = document.getElementById('sortDir')?.value || 'asc';

    // Validate required fields for local mode
    if (IS_LOCAL_MODE && !namespace) {
      renderError('Namespace is required to load services');
      return;
    }

    // Parse comma-separated prefixes into array and add multiple prefix params
    const prefixes = prefixValue
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Build query parameters
    // Note: Only send context, namespace, and prefix to backend
    // Filtering, search, and sorting are done client-side
    const params = new URLSearchParams();
    if (context) params.append('context', context);
    if (namespace) params.append('namespace', namespace);

    // Add each prefix as a separate parameter (backend expects getAll("prefix"))
    if (prefixes.length > 0) {
      prefixes.forEach(prefix => params.append('prefix', prefix));
    } else {
      params.append('prefix', 'app-'); // Default fallback
    }

    const endpoint = IS_LOCAL_MODE ? '/services-local' : '/services';
    const url = `${endpoint}?${params.toString()}`;

    console.log('[Modern Cyberpunk] Loading data from:', url);

    const response = await fetch(url);

    if (!response.ok) {
      // Try to parse error response as JSON first
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Keep the default HTTP status message
        }
      }

      console.error('[Modern Cyberpunk] Error response:', errorMessage);

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      throw new Error(errorMessage);
    }

    // Clear auth retry if successful
    if (authRetryTimer) {
      clearTimeout(authRetryTimer);
      authRetryTimer = null;
      authRetryCount = 0;
      authRetryFn = null;
    }

    const data = await response.json();
    console.log('[Modern Cyberpunk] Data loaded:', data);

    // Get all services from backend
    const allItems = data.services || [];

    // Save for incremental updates
    lastLoadedServices = allItems;

    // Re-initialize baseline for incremental updates after each full reload
    initializeServiceList(allItems);

    // Start incremental updates after first successful load
    if (isFirstLoad) {
      isFirstLoad = false;
      // Pass callbacks for service list changes and auth errors
      startIncrementalUpdates(
        fetchServiceList,
        getCurrentFilters,
        () => {
          loadData();
        },
        (authError) => {
          // Handle auth error from incremental update
          const errorMsg = 'AWS authentication required! Token expired during session. Run "aws sso login" in terminal.';
          console.error('[Modern Cyberpunk] Auth error during incremental update:', authError);
          showNotification(errorMsg, 'error', 0);
          renderError(errorMsg + '<br><br>Steps to fix:<br>1. Open terminal<br>2. Run: <code>aws sso login</code> (or <code>aws sso login --profile YOUR_PROFILE</code>)<br>3. Click the "Retry" button below', true);
        }
      );
    }

    // Apply client-side filtering, search, and sorting
    const items = applySort(
      applySearch(
        applyFilters(allItems, filterBad, filterWarn, filterSingle, filterRestarts, minRestarts),
        search
      ),
      sortField,
      sortDir
    );

    console.log(`[Modern Cyberpunk] Filtered ${items.length} / ${allItems.length} services`);

    renderServices(items);
    updateCountInfo(items);

    // Restore expanded services after rendering (don't await to avoid blocking)
    restoreExpandedServices(allItems).catch(err => {
      console.error('[Modern Cyberpunk] Failed to restore expanded services:', err);
    });

  } catch (error) {
    console.error('[Modern Cyberpunk] Failed to load data:', error);
    showNotification(`Failed to load data: ${error.message}`, 'error');
    renderError(error.message);
  } finally {
    isLoading = false;
    if (loadingIndicator) loadingIndicator.classList.remove('active');
    if (refreshButton) refreshButton.disabled = false;

    const floatingRefresh = document.getElementById('floatingRefresh');
    if (floatingRefresh) floatingRefresh.classList.remove('spinning');

    // Re-enable all inputs after loading
    disableInputs(false);
  }
}

/**
 * Handle authentication errors with retry
 */
function handleAuthError(retryFn) {
  if (retryFn) authRetryFn = retryFn;
  authRetryCount++;

  if (authRetryCount <= MAX_AUTH_RETRIES) {
    const retrySeconds = 6;
    console.log(`[Modern Cyberpunk] Auth error, retrying in ${retrySeconds}s (attempt ${authRetryCount}/${MAX_AUTH_RETRIES})...`);

    showNotification(
      `AWS authentication required. Retrying in ${retrySeconds}s (attempt ${authRetryCount}/${MAX_AUTH_RETRIES})...`,
      'warning',
      retrySeconds * 1000
    );

    authRetryTimer = setTimeout(() => {
      (authRetryFn || loadData)();
    }, retrySeconds * 1000);
  } else {
    console.error('[Modern Cyberpunk] Max auth retries exceeded');
    showNotification(
      'AWS authentication failed after multiple retries. Please check your credentials.',
      'error',
      0
    );
    renderError('AWS authentication failed. Please check your credentials and try again.<br><br>Steps to fix:<br>1. Open terminal<br>2. Run: <code>aws sso login</code> (or <code>aws sso login --profile YOUR_PROFILE</code>)<br>3. Click the "Retry" button below', true);
  }
}

/**
 * Render services in table
 */
function renderServices(services) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (!services || services.length === 0) {
    tbody.innerHTML = `
      <tr class="loading-row">
        <td colspan="8">
          <div class="loading-state">
            <span>No services found</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rows = services.map((service, index) => {
    const serviceName = service.serviceName || service.service || '';
    const status = statusFor(service);
    const isOpen = isDetailsOpen(serviceName);

    const mainRow = renderServiceRow(service, status, isOpen, fmtDeploy, fmtHpa);
    return mainRow;
  }).join('');

  tbody.innerHTML = rows;

  // Add click handlers for expandable rows
  services.forEach((service, index) => {
    const serviceName = service.serviceName || service.service || '';
    const row = tbody.querySelector(`tr[data-service-name="${serviceName}"]`);
    if (row && (service.hasPods || service.podCount > 0)) {
      row.classList.add('clickable');
      row.addEventListener('click', (e) => {
        // Don't expand if clicking on a link, expand button, or scale controls
        if (e.target.tagName === 'A' || e.target.closest('a') || e.target.closest('.expand-cell') || e.target.closest('.scale-controls')) {
          return;
        }
        toggleServiceExpansion(service, serviceName);
      });

      // Add click handler for expand button
      const expandBtn = row.querySelector('.expand-cell');
      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Only toggle if not clicking restart or service-logs button
          if (!e.target.closest('.restart-button') && !e.target.closest('.service-logs-btn')) {
            toggleServiceExpansion(service, serviceName);
          }
        });
      }

      // Add click handler for service logs button
      const serviceLogsBtn = row.querySelector('.service-logs-btn');
      if (serviceLogsBtn) {
        serviceLogsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const namespace = IS_LOCAL_MODE
            ? (document.getElementById('namespaceInput')?.value || '')
            : (window.IN_CLUSTER_NAMESPACE || '');
          const context = IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value || '') : '';
          showServiceLogsModal(serviceName, namespace, context);
        });
      }

      // Add click handler for restart button
      const restartBtn = row.querySelector('.restart-button');
      if (restartBtn) {
        restartBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const namespace = IS_LOCAL_MODE
            ? (document.getElementById('namespaceInput')?.value || '')
            : (window.IN_CLUSTER_NAMESPACE || '');
          const context = IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value || '') : '';
          showRestartModal(serviceName, namespace, context, loadData);
        });
      }

      // Wire up scale controls (+/- direct or HPA min/max)
      initScaleControls(row, serviceName, loadData);
    }
  });
}

/**
 * Toggle service expansion to show pod details
 */
async function toggleServiceExpansion(service, serviceName) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  const row = tbody.querySelector(`tr[data-service-name="${serviceName}"]`);
  if (!row) return;

  const existingExpandedRow = tbody.querySelector(`tr.expanded-content[data-service-name="${serviceName}"]`);

  if (existingExpandedRow) {
    // Collapse
    existingExpandedRow.remove();
    row.classList.remove('expanded');
    openServiceDetails.delete(serviceName);
    saveUIState(); // Save state when collapsing

    // Update expand button
    const expandBtn = row.querySelector('.expand-button');
    if (expandBtn) {
      expandBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      `;
    }
    return;
  }

  // Expand
  row.classList.add('expanded');
  openServiceDetails.add(serviceName);

  // Update expand button
  const expandBtn = row.querySelector('.expand-button');
  if (expandBtn) {
    expandBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    `;
  }

  const context = IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value?.trim() || '') : '';
  const namespace = IS_LOCAL_MODE
    ? (document.getElementById('namespaceInput')?.value?.trim() || '')
    : (window.IN_CLUSTER_NAMESPACE || '');

  const expandedRow = document.createElement('tr');
  expandedRow.className = 'expanded-content';
  expandedRow.setAttribute('data-service-name', serviceName);
  expandedRow.innerHTML = `
    <td colspan="8">
      ${renderServiceDetailsTabs(serviceName, namespace)}
    </td>
  `;

  row.after(expandedRow);

  // Setup tab switching
  const tabButtons = expandedRow.querySelectorAll('.tab-button');
  // Mark all tabs as loaded immediately - background loading will populate them
  const loadedTabs = new Set(['pods', 'events', 'configs', 'endpoints', 'deployment']);

  tabButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tabName = btn.dataset.tab;
      const service = btn.dataset.service;

      // Update active tab button
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active tab pane
      const tabPanes = expandedRow.querySelectorAll('.tab-pane');
      tabPanes.forEach(pane => pane.classList.remove('active'));
      const targetPane = expandedRow.querySelector(`#${tabName}-${service}`);
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }

      // Hide other panes
      tabPanes.forEach(pane => {
        if (pane.id !== `${tabName}-${service}`) {
          pane.style.display = 'none';
        }
      });

      // All tabs are pre-loaded in the background - no on-demand loading needed
    });
  });

  // Load pods tab immediately (default active tab)
  const podsPane = expandedRow.querySelector(`#pods-${serviceName}`);
  if (podsPane) {
    loadPodsTab(serviceName, namespace, context, podsPane);
  }

  // Background-load all other tabs in parallel (fire-and-forget)
  const eventsPane = expandedRow.querySelector(`#events-${serviceName}`);
  const configsPane = expandedRow.querySelector(`#configs-${serviceName}`);
  const endpointsPane = expandedRow.querySelector(`#endpoints-${serviceName}`);
  const deploymentsPane = expandedRow.querySelector(`#deployment-${serviceName}`);

  const backgroundLoad = async () => {
    await Promise.allSettled([
      eventsPane ? loadEventsTab(serviceName, namespace, context, eventsPane, serviceDataCache) : Promise.resolve(),
      configsPane ? loadConfigsTab(serviceName, namespace, context, configsPane, serviceDataCache) : Promise.resolve(),
      endpointsPane ? loadEndpointsTab(serviceName, namespace, context, endpointsPane, serviceDataCache) : Promise.resolve(),
      deploymentsPane ? loadDeploymentHistoryTab(serviceName, namespace, context, deploymentsPane) : Promise.resolve(),
    ]);
  };
  backgroundLoad(); // fire-and-forget, no await

  // Save UI state after successfully expanding
  saveUIState();
}

/**
 * Load pods tab content
 */
async function loadPodsTab(serviceName, namespace, context, targetPane) {
  try {
    targetPane.innerHTML = `
      <div class="loading-state">
        <div class="cyber-spinner"></div>
        <span>Loading pods...</span>
      </div>
    `;

    if (!serviceName) {
      throw new Error('Service name is required');
    }
    if (IS_LOCAL_MODE && !namespace) {
      throw new Error('Namespace is required for local mode');
    }

    const params = new URLSearchParams();
    if (context) params.append('context', context);
    params.append('namespace', namespace);
    params.append('service', serviceName);

    const endpoint = IS_LOCAL_MODE ? '/service-pods-local' : '/service-pods';
    const url = `${endpoint}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const pods = data.pods || [];

    const formatters = { fmtCpuVal, fmtMemVal, fmtAge };
    targetPane.innerHTML = renderPodDetails(pods, serviceName, data.namespace, formatters);

    // Attach pod logs button handlers
    attachPodLogsHandlers(targetPane, namespace, context);
    attachPodShellHandlers(targetPane, namespace, context);
  } catch (error) {
    console.error('[Dashboard] Failed to load pods:', error);
    targetPane.innerHTML = `
      <div class="loading-state">
        <span style="color: var(--color-danger);">Failed to load pods: ${error.message}</span>
      </div>
    `;
  }
}


// Feature handlers (Endpoints, Events, Logs, Configs, Scale, Rollback, Restart)
// are imported from ./modules/feature-handlers.js

/**
 * Restore expanded services from UI state
 */
async function restoreExpandedServices(services) {
  if (openServiceDetails.size === 0) return;

  console.log('[Modern Cyberpunk] Restoring expanded services:', Array.from(openServiceDetails));

  // Find services that should be expanded
  const servicesToExpand = services.filter(service => {
    const serviceName = service.serviceName || service.service || '';
    return openServiceDetails.has(serviceName);
  });

  // Expand them (stagger to avoid overwhelming the UI)
  for (const service of servicesToExpand) {
    const serviceName = service.serviceName || service.service || '';
    // Use a small delay to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 50));
    await toggleServiceExpansion(service, serviceName);
  }
}

/**
 * Update count info
 */
function updateCountInfo(services) {
  const countInfo = document.getElementById('countInfo');
  if (!countInfo) return;

  const total = services.length;
  const bad = services.filter(s => s.isBad).length;
  const warn = services.filter(s => s.isWarn && !s.isBad).length;
  const single = services.filter(s => s.isSingle && !s.isBad && !s.isWarn).length;

  countInfo.textContent = `Showing ${total} services`;
  if (bad > 0 || warn > 0 || single > 0) {
    const parts = [];
    if (bad > 0) parts.push(`${bad} bad`);
    if (warn > 0) parts.push(`${warn} warning`);
    if (single > 0) parts.push(`${single} single pod`);
    countInfo.textContent += ` (${parts.join(', ')})`;
  }
}

/**
 * Render error state
 */
function renderError(message, showRetryButton = false) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  const retryButtonHtml = showRetryButton ? `
    <button
      class="cyber-button"
      onclick="window.location.reload()"
      style="margin-top: var(--space-lg); padding: var(--space-md) var(--space-xl);">
      🔄 Retry after aws sso login
    </button>
  ` : '';

  tbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="8">
        <div class="loading-state" style="padding: var(--space-xl); text-align: center;">
          <div style="font-size: 48px; margin-bottom: var(--space-md);">⚠️</div>
          <div style="color: var(--color-danger); font-size: 1.1rem; font-weight: 600; margin-bottom: var(--space-md); line-height: 1.6;">
            ${message}
          </div>
          ${retryButtonHtml}
        </div>
      </td>
    </tr>
  `;
}

// ==============================================
// Floating Refresh Button
// ==============================================

function initFloatingRefresh() {
  const floatingRefresh = document.getElementById('floatingRefresh');
  if (!floatingRefresh) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > FLOATING_REFRESH_SCROLL_THRESHOLD_PX) {
      floatingRefresh.classList.add('visible');
    } else {
      floatingRefresh.classList.remove('visible');
    }
  });

  floatingRefresh.addEventListener('click', () => {
    loadData();
    floatingRefresh.classList.add('spinning');
    setTimeout(() => floatingRefresh.classList.remove('spinning'), 1000);
  });
}

// ==============================================
// Search Clear Button
// ==============================================

function initSearchClear() {
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  if (!searchInput || !searchClear) return;

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    scheduleLoadData();
  });
}

// ==============================================
// Theme Selector
// ==============================================

/**
 * Theme icon mapping
 */
const THEME_ICONS = {
  cyberpunk: '🤖',
  summer: '☀️',
  starwars: '⭐',
  matrix: '💚',
  autumn: '🍂',
  crimson: '🔴'
};

/**
 * Get currently selected theme from localStorage
 */
function getCurrentTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'cyberpunk';
  } catch (error) {
    console.error('[Theme] Failed to get theme:', error);
    return 'cyberpunk';
  }
}

/**
 * Save selected theme to localStorage
 */
function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error('[Theme] Failed to save theme:', error);
  }
}

/**
 * Update the theme CSS link in the document
 */
function updateThemeCSS(theme) {
  // Find the theme CSS link (the second stylesheet link)
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  const themeLink = Array.from(links).find(link => link.href.includes('/css/themes/'));

  if (themeLink) {
    const currentHref = themeLink.href;
    const newHref = currentHref.replace(/\/themes\/[^/]+\.css/, `/themes/${theme}.css`);
    themeLink.href = newHref;
    console.log(`[Theme] Updated CSS from ${currentHref} to ${newHref}`);
  } else {
    console.warn('[Theme] Could not find theme CSS link to update');
  }
}

/**
 * Update the theme badge icon
 */
function updateThemeBadge(theme) {
  const badge = document.getElementById('themeBadge');
  if (badge) {
    badge.textContent = THEME_ICONS[theme] || '🎨';
    console.log(`[Theme] Updated badge to: ${THEME_ICONS[theme] || '🎨'}`);
  }
}

/**
 * Handle theme-specific animations
 */
function handleThemeAnimations(theme) {
  // Stop all theme animations
  if (isMatrixRainActive()) {
    stopMatrixRain();
    console.log('[Theme] Stopped Matrix rain animation');
  }
  if (isAutumnLeavesActive()) {
    stopAutumnLeaves();
    console.log('[Theme] Stopped Autumn leaves animation');
  }
  if (isStarfieldActive()) {
    stopStarfield();
    console.log('[Theme] Stopped Starfield animation');
  }

  // Start theme-specific animation
  if (theme === 'matrix') {
    initMatrixRain();
    console.log('[Theme] Started Matrix rain animation');
  } else if (theme === 'autumn') {
    initAutumnLeaves();
    console.log('[Theme] Started Autumn leaves animation');
  } else if (theme === 'starwars') {
    initStarfield();
    console.log('[Theme] Started Starfield animation');
  }
}

/**
 * Initialize theme selector on page load
 */
function initThemeSelector() {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) return;

  const currentTheme = getCurrentTheme();
  themeSelect.value = currentTheme;

  // Update CSS if theme is not the default one loaded in HTML
  if (currentTheme !== 'cyberpunk') {
    updateThemeCSS(currentTheme);
  }

  // Update theme badge
  updateThemeBadge(currentTheme);

  // Handle theme-specific animations (e.g., Matrix rain)
  handleThemeAnimations(currentTheme);

  console.log(`[Theme] Initialized with theme: ${currentTheme}`);
}

/**
 * Handle theme change from dropdown
 * Called from HTML onchange event
 */
function onThemeChange() {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) return;

  const newTheme = themeSelect.value;
  console.log(`[Theme] Changing theme to: ${newTheme}`);

  saveTheme(newTheme);

  // Reload page to apply new theme CSS
  window.location.reload();
}

// ==============================================
// Initialization
// ==============================================

/**
 * Full init sequence for local mode (reusable for auth retry recovery)
 */
async function initLocalMode() {
  await fetchContexts();
  loadState();
  if (currentContext) {
    await fetchNamespaces(currentContext);
  }
  const namespaceInput = document.getElementById('namespaceInput');
  if (namespaceInput && availableNamespaces.length > 0) {
    const currentNamespace = namespaceInput.value;
    if (!currentNamespace || !availableNamespaces.includes(currentNamespace)) {
      namespaceInput.value = availableNamespaces[0];
      saveState();
    }
  }
  loadUIState();
  updateFilterChipsVisualState();
  if (!authRetryTimer) {
    await loadData();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Modern Cyberpunk] Initializing dashboard...');

  // In-cluster mode: hide context/namespace selectors (not needed without kubeconfig)
  if (!IS_LOCAL_MODE) {
    document.querySelectorAll('.local-mode-only').forEach(el => { el.style.display = 'none'; });
  }

  // Initialize theme
  initTheme();

  // Initialize AI help (event delegation, single listener on document)
  initAiHelp();

  // Initialize theme selector
  initThemeSelector();

  // Initialize floating refresh button
  initFloatingRefresh();

  // Initialize search clear button
  initSearchClear();

  // Initialize filter chips visual state
  updateFilterChipsVisualState();

  // Add event listeners for filter chips
  ['filterBad', 'filterWarn', 'filterSingle', 'filterRestarts'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', updateFilterChipsVisualState);
    }
  });

  if (IS_LOCAL_MODE) {
    // Local mode: fetch contexts/namespaces from kubeconfig and restore saved state
    await initLocalMode();
  } else {
    // In-cluster mode: namespace is fixed, no context switching needed
    console.log('[Modern Cyberpunk] In-cluster mode, namespace:', window.IN_CLUSTER_NAMESPACE);
    loadUIState();

    // Load initial data with restored state (local mode handled inside initLocalMode)
    await loadData();
  }

  // Remove no-transition class after initial render
  setTimeout(() => {
    document.body.classList.remove('no-transition');
  }, 100);

  console.log('[Modern Cyberpunk] Dashboard initialized successfully');
});

// Export functions for global access (for inline onclick handlers)
window.loadData = loadData;
window.setDefault = setDefault;
window.scheduleLoadData = scheduleLoadData;
window.updateRestartFilterEnabled = updateRestartFilterEnabled;
window.onContextChange = onContextChange;
window.onThemeChange = onThemeChange;
