/**
 * Problematic Pods View - Main Entry Point
 * Shows only pods with bad or warning status, sorted by pod name
 */

console.log('[Problematic Pods] JavaScript loaded');

// Import from dashboard modules
import { initTheme } from './modules/theme.js';
import { renderPodCard } from './modules/ui-components.js';
import { escapeHtml, fmtCpuVal, fmtMemVal, fmtAge } from './modules/formatters.js';
import { initMatrixRain, stopMatrixRain, isMatrixRainActive } from './modules/matrix-rain.js';
import { initAutumnLeaves, stopAutumnLeaves, isAutumnLeavesActive } from './modules/autumn-leaves.js';
import { initStarfield, stopStarfield, isStarfieldActive } from './modules/starfield.js';

// Configuration
const LAST_CONTEXT_KEY = 'dashboard.lastContext.modern-cyberpunk-local.v1';
const THEME_STORAGE_KEY = 'dashboard.theme.v1';
const STORAGE_KEY_PREFIX = 'dashboard.state.problematic-pods.v1';

// State
let isLoading = false;
let currentContext = '';
let availableNamespaces = [];
let availableContexts = [];
let authRetryTimer = null;
let authRetryCount = 0;
const MAX_AUTH_RETRIES = 20;

// Get configuration from global window object (set by template)
const PRESETS = window.PRESETS || {};

/**
 * Save last used context globally (not per-context)
 */
function saveLastUsedContext(context) {
  try {
    localStorage.setItem(LAST_CONTEXT_KEY, context);
  } catch (error) {
    console.error('[Problematic Pods] Failed to save last context:', error);
  }
}

/**
 * Get last used context
 */
function getLastUsedContext() {
  try {
    return localStorage.getItem(LAST_CONTEXT_KEY);
  } catch (error) {
    console.error('[Problematic Pods] Failed to get last context:', error);
    return null;
  }
}

/**
 * Save state to localStorage
 */
function saveState() {
  try {
    const contextEl = document.getElementById('contextInput');
    const namespaceEl = document.getElementById('namespaceInput');
    const context = contextEl?.value?.trim() || currentContext || 'default';

    const state = {
      namespace: namespaceEl?.value || '',
    };

    localStorage.setItem(`${STORAGE_KEY_PREFIX}.${context}`, JSON.stringify(state));
  } catch (error) {
    console.error('[Problematic Pods] Failed to save state:', error);
  }
}

/**
 * Load state from localStorage
 */
function loadState() {
  try {
    const contextEl = document.getElementById('contextInput');
    const context = contextEl?.value?.trim() || currentContext || 'default';
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}.${context}`);

    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('[Problematic Pods] Failed to load state:', error);
  }
  return null;
}

// ==============================================
// Utility Functions
// ==============================================

// fmtCpuVal, fmtMemVal, fmtAge, escapeHtml are imported from ./modules/formatters.js

/**
 * Determine pod status (bad, warn, or ok)
 */
function getPodStatus(pod) {
  const phase = (pod.status || '').toLowerCase();
  const restarts = pod.restarts || 0;
  const restartReasons = pod.restartReasons || {};
  const restartReasonKeys = Object.keys(restartReasons).map(k => k.toLowerCase());
  const ready = pod.ready || '0/0';

  // Parse ready status (e.g., "1/1" -> both are 1, "0/1" -> ready is 0)
  const isReady = ready.split('/').length === 2
    ? (() => {
        const parts = ready.split('/');
        const readyCount = parseInt(parts[0]) || 0;
        const totalCount = parseInt(parts[1]) || 0;
        return readyCount === totalCount && totalCount > 0;
      })()
    : false;

  // BAD conditions
  const isBad = phase === 'failed' ||
                restartReasonKeys.includes('oomkilled') ||
                restartReasonKeys.includes('error') ||
                (restarts > 0 && !isReady);

  // WARNING conditions (only if not bad)
  const isWarning = !isBad && (
                restarts >= 3 ||
                restartReasonKeys.includes('completed')
  );

  if (isBad) return 'bad';
  if (isWarning) return 'warn';
  return 'ok';
}

// ==============================================
// API Functions
// ==============================================

/**
 * Load contexts from backend
 */
async function loadContexts() {
  try {
    const response = await fetch('/contexts-local');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    availableContexts = data.contexts || [];

    const contextEl = document.getElementById('contextInput');
    if (contextEl) {
      contextEl.innerHTML = '';
      availableContexts.forEach(ctx => {
        const option = document.createElement('option');
        option.value = ctx;
        option.textContent = ctx;
        contextEl.appendChild(option);
      });

      // Set last used context or first available
      const lastContext = getLastUsedContext();
      if (lastContext && availableContexts.includes(lastContext)) {
        contextEl.value = lastContext;
        currentContext = lastContext;
      } else if (availableContexts.length > 0) {
        contextEl.value = availableContexts[0];
        currentContext = availableContexts[0];
      }
    }
  } catch (error) {
    console.error('[Problematic Pods] Failed to load contexts:', error);
    showNotification('Failed to load contexts: ' + error.message, 'error');
  }
}

/**
 * Load namespaces for selected context
 */
async function loadNamespaces() {
  const contextEl = document.getElementById('contextInput');
  const context = contextEl?.value || '';

  try {
    const url = context ? `/namespaces-local?context=${encodeURIComponent(context)}` : '/namespaces-local';
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        const errorData = await response.json();
        showAuthError(errorData.message || 'Unauthorized');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    availableNamespaces = data.namespaces || [];

    const namespaceEl = document.getElementById('namespaceInput');
    if (namespaceEl) {
      namespaceEl.innerHTML = '';
      availableNamespaces.forEach(ns => {
        const option = document.createElement('option');
        option.value = ns;
        option.textContent = ns;
        namespaceEl.appendChild(option);
      });

      // Try to restore saved namespace for this context
      const saved = loadState();
      if (saved?.namespace && availableNamespaces.includes(saved.namespace)) {
        namespaceEl.value = saved.namespace;
      } else if (availableNamespaces.length > 0) {
        namespaceEl.value = availableNamespaces[0];
      }
    }

    clearAuthError();
  } catch (error) {
    console.error('[Problematic Pods] Failed to load namespaces:', error);
    showNotification('Failed to load namespaces: ' + error.message, 'error');
  }
}

/**
 * Load problematic pods from backend
 */
async function loadProblematicPods() {
  if (isLoading) return;

  const namespaceEl = document.getElementById('namespaceInput');
  const contextEl = document.getElementById('contextInput');
  const namespace = namespaceEl?.value || '';
  const context = contextEl?.value || '';

  if (!namespace) {
    showNotification('Please select a namespace', 'warn');
    return;
  }

  isLoading = true;
  showLoading(true);
  saveState();

  try {
    const url = `/problematic-pods-local?namespace=${encodeURIComponent(namespace)}&context=${encodeURIComponent(context)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        const errorData = await response.json();
        showAuthError(errorData.message || 'Unauthorized');
        isLoading = false;
        showLoading(false);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const pods = data.pods || [];

    renderPods(pods);
    clearAuthError();

  } catch (error) {
    console.error('[Problematic Pods] Failed to load pods:', error);
    showNotification('Failed to load pods: ' + error.message, 'error');
    document.getElementById('podsGrid').innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <p>Failed to load pods: ${escapeHtml(error.message)}</p>
      </div>
    `;
  } finally {
    isLoading = false;
    showLoading(false);
  }
}

/**
 * Render pods grid
 */
function renderPods(pods) {
  const grid = document.getElementById('podsGrid');
  const countInfo = document.getElementById('countInfo');

  if (!pods || pods.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style="font-size: 18px; margin-bottom: 8px;">No problematic pods</p>
        <p style="font-size: 14px; opacity: 0.7;">All pods running as expected!</p>
      </div>
    `;
    countInfo.textContent = 'No problematic pods found';
    return;
  }

  // Count by status
  const badCount = pods.filter(p => getPodStatus(p) === 'bad').length;
  const warnCount = pods.filter(p => getPodStatus(p) === 'warn').length;

  // Render pod cards
  const formatters = { fmtCpuVal, fmtMemVal, fmtAge };
  const cardsHtml = pods
    .map(pod => {
      // Extract service name from pod name (assumes format: service-name-xxx-yyy)
      const serviceName = pod.podName.split('-').slice(0, -2).join('-') || pod.podName;
      const namespace = document.getElementById('namespaceInput')?.value || '';
      return renderPodCard(pod, serviceName, namespace, formatters);
    })
    .join('');

  grid.innerHTML = cardsHtml;

  // Update count info with color coding
  const parts = [];
  if (badCount > 0) {
    parts.push(`<span style="color: var(--accent-red); font-weight: 600;">${badCount} BAD</span>`);
  }
  if (warnCount > 0) {
    parts.push(`<span style="color: var(--accent-yellow); font-weight: 600;">${warnCount} WARNING</span>`);
  }

  countInfo.innerHTML = `Found ${pods.length} problematic pod${pods.length !== 1 ? 's' : ''}: ${parts.join(', ')}`;

  // Re-initialize Lucide icons for dynamically added content
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

/**
 * Show auth error with retry functionality
 */
function showAuthError(message) {
  const grid = document.getElementById('podsGrid');
  grid.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style="font-size: 18px; margin-bottom: 8px; color: var(--accent-red);">Authentication Error</p>
      <p style="font-size: 14px; margin-bottom: 16px;">${escapeHtml(message)}</p>
      <button onclick="retryLoad()" class="cyber-button cyber-button-primary">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Retry
      </button>
    </div>
  `;

  showNotification(message, 'error');
}

/**
 * Clear auth error and stop retry timer
 */
function clearAuthError() {
  if (authRetryTimer) {
    clearTimeout(authRetryTimer);
    authRetryTimer = null;
  }
  authRetryCount = 0;
}

/**
 * Retry loading (called from retry button)
 */
window.retryLoad = function() {
  clearAuthError();
  loadProblematicPods();
};

/**
 * Handle context change
 */
window.onContextChange = async function() {
  const contextEl = document.getElementById('contextInput');
  const context = contextEl?.value || '';

  if (context) {
    currentContext = context;
    saveLastUsedContext(context);
    await loadNamespaces();
    await loadProblematicPods();
  }
};

/**
 * Handle theme change
 */
window.onThemeChange = function() {
  const themeSelect = document.getElementById('themeSelect');
  const theme = themeSelect?.value || 'cyberpunk';

  // Save theme preference
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error('[Problematic Pods] Failed to save theme:', error);
  }

  // Apply theme
  document.body.setAttribute('data-theme', theme);

  // Load theme-specific CSS
  const themeLink = document.querySelector('link[href*="/css/themes/"]');
  if (themeLink) {
    themeLink.href = `/dashboard/css/themes/${theme}.css`;
  }

  // Handle theme-specific effects
  stopMatrixRain();
  stopAutumnLeaves();
  stopStarfield();

  if (theme === 'matrix') {
    initMatrixRain();
  } else if (theme === 'autumn') {
    initAutumnLeaves();
  } else if (theme === 'starwars') {
    initStarfield();
  }

  // Update theme badge
  initTheme();
};

// ==============================================
// Initialization
// ==============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Problematic Pods] Initializing...');

  // Initialize theme
  initTheme();

  // Load saved theme
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      const themeSelect = document.getElementById('themeSelect');
      if (themeSelect) {
        themeSelect.value = savedTheme;
        window.onThemeChange();
      }
    }
  } catch (error) {
    console.error('[Problematic Pods] Failed to load saved theme:', error);
  }

  // Setup floating refresh button
  const floatingRefresh = document.getElementById('floatingRefresh');
  if (floatingRefresh) {
    floatingRefresh.addEventListener('click', () => {
      loadProblematicPods();
    });
  }

  // Load contexts and namespaces
  await loadContexts();
  await loadNamespaces();

  // Load pods
  await loadProblematicPods();

  console.log('[Problematic Pods] Initialization complete');
});
