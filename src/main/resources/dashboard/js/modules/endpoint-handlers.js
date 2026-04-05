/**
 * Endpoint Handlers - Service endpoints and pod events tabs
 * Handles: loadEndpointsTab, loadEventsTab, attachEventsHandlers
 */

import {
  renderServiceEndpoints,
  renderPodEventsTimeline
} from './ui-components.js';
import { escapeHtml } from './formatters.js';

// ==============================================
// API Endpoint Helper (local to this module)
// ==============================================

function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

// ==============================================
// Shared helpers (local)
// ==============================================

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('[Endpoints] Failed to copy to clipboard:', error);
    return false;
  }
}

function handleTabAuthError(targetPane) {
  const errorMsg = 'AWS authentication required! Token has expired. Run "aws sso login" in terminal.';
  targetPane.innerHTML = `
    <div class="loading-state">
      <span style="color: var(--color-danger);">${errorMsg}</span>
      <br><br>
      <p>Steps to fix:</p>
      <ol style="text-align: left; margin: 10px 0;">
        <li>Open terminal</li>
        <li>Run: <code>aws sso login</code> (or <code>aws sso login --profile YOUR_PROFILE</code>)</li>
        <li>Click the "Retry" button below</li>
      </ol>
      <button class="modal-btn modal-btn-primary" onclick="location.reload()">Retry</button>
    </div>
  `;
}

function attachCopyHandlers(container) {
  const copyButtons = container.querySelectorAll('[data-copy]');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      copyToClipboard(text);
    });
  });
}

// ==============================================
// Service Endpoints Tab
// ==============================================

/**
 * Load service endpoints tab content
 */
export async function loadEndpointsTab(serviceName, namespace, context, targetPane, dataCache) {
  try {
    console.log('[Endpoints] Loading endpoints for service:', serviceName);

    const cacheKey = `${context}-${namespace}-${serviceName}`;
    if (dataCache.endpoints.has(cacheKey)) {
      console.log('[Endpoints] Using cached data');
      targetPane.innerHTML = dataCache.endpoints.get(cacheKey);
      attachCopyHandlers(targetPane);
      return;
    }

    targetPane.innerHTML = `
      <div class="loading-state">
        <div class="cyber-spinner"></div>
        <span>Loading endpoints...</span>
      </div>
    `;

    const params = new URLSearchParams();
    if (context) params.append('context', context);
    params.append('namespace', namespace);
    params.append('service', serviceName);

    const response = await fetch(`${apiEndpoint('service-endpoints')}?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        handleTabAuthError(targetPane);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const html = renderServiceEndpoints(data);

    dataCache.endpoints.set(cacheKey, html);
    targetPane.innerHTML = html;
    attachCopyHandlers(targetPane);
  } catch (error) {
    console.error('[Endpoints] Failed to load endpoints:', error);
    targetPane.innerHTML = `
      <div class="loading-state">
        <span style="color: var(--color-danger);">Failed to load endpoints: ${error.message}</span>
      </div>
    `;
  }
}

// ==============================================
// Pod Events Tab
// ==============================================

/**
 * Attach events tab handlers
 */
export function attachEventsHandlers(container) {
  const showAllBtn = container.querySelector('.show-all-events-btn');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      const hiddenEvents = container.querySelectorAll('.event-item.hidden');
      hiddenEvents.forEach(item => item.classList.remove('hidden'));
      showAllBtn.style.display = 'none';
    });
  }

  const warningOnlyCheckbox = container.querySelector('.warning-only-checkbox');
  if (warningOnlyCheckbox) {
    warningOnlyCheckbox.addEventListener('change', (e) => {
      const events = container.querySelectorAll('.event-item');
      events.forEach(item => {
        if (e.target.checked) {
          if (!item.classList.contains('event-warning')) {
            item.style.display = 'none';
          }
        } else {
          item.style.display = '';
        }
      });
    });
  }
}

/**
 * Load pod events tab content
 */
export async function loadEventsTab(serviceName, namespace, context, targetPane, dataCache) {
  try {
    console.log('[Events] Loading events for service:', serviceName);

    const cacheKey = `${context}-${namespace}-${serviceName}`;
    if (dataCache.events.has(cacheKey)) {
      console.log('[Events] Using cached data');
      targetPane.innerHTML = dataCache.events.get(cacheKey);
      attachEventsHandlers(targetPane);
      return;
    }

    targetPane.innerHTML = `
      <div class="loading-state">
        <div class="cyber-spinner"></div>
        <span>Loading events...</span>
      </div>
    `;

    const params = new URLSearchParams();
    if (context) params.append('context', context);
    params.append('namespace', namespace);
    params.append('service', serviceName);

    const response = await fetch(`${apiEndpoint('pod-events')}?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        handleTabAuthError(targetPane);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const html = renderPodEventsTimeline(data.events || []);

    dataCache.events.set(cacheKey, html);
    targetPane.innerHTML = html;
    attachEventsHandlers(targetPane);
  } catch (error) {
    console.error('[Events] Failed to load events:', error);
    targetPane.innerHTML = `
      <div class="loading-state">
        <span style="color: var(--color-danger);">Failed to load events: ${error.message}</span>
      </div>
    `;
  }
}
