/**
 * Config Handlers - ConfigMap and Secret viewer
 * Handles: loadConfigsTab, attachConfigsHandlers, attachSecretHandlers
 */

import {
  renderServiceConfigs,
  renderConfigMapViewer,
  renderSecretViewer
} from './ui-components.js';
import { escapeHtml, showNotification } from './formatters.js';

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
    showNotification('Copied to clipboard', 'success', 3000);
    return true;
  } catch (error) {
    console.error('[Configs] Failed to copy to clipboard:', error);
    showNotification('Failed to copy to clipboard', 'error', 3000);
    return false;
  }
}

function showToast(message, type = 'info') {
  showNotification(message, type, 3000);
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
// ConfigMaps / Secrets Tab
// ==============================================

/**
 * Attach configs tab handlers
 */
export function attachConfigsHandlers(container, namespace, context) {
  const configMapBtns = container.querySelectorAll('.expand-configmap-btn');
  configMapBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const detailsDiv = container.querySelector(`#configmap-details-${name}`);

      if (btn.classList.contains('expanded')) {
        btn.classList.remove('expanded');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        detailsDiv.innerHTML = '';
        detailsDiv.style.display = 'none';
      } else {
        btn.classList.add('expanded');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>';

        try {
          const params = new URLSearchParams();
          if (context) params.append('context', context);
          params.append('namespace', namespace);
          params.append('name', name);

          const response = await fetch(`${apiEndpoint('configmap-data')}?${params.toString()}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          detailsDiv.innerHTML = renderConfigMapViewer(data);
          detailsDiv.style.display = 'block';
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

          attachCopyHandlers(detailsDiv);
        } catch (error) {
          console.error('[Configs] Failed to load ConfigMap data:', error);
          detailsDiv.innerHTML = `<div style="color: var(--color-danger);">Failed to load data: ${error.message}</div>`;
          detailsDiv.style.display = 'block';
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
          btn.classList.remove('expanded');
        }
      }
    });
  });

  const secretBtns = container.querySelectorAll('.expand-secret-btn');
  secretBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const detailsDiv = container.querySelector(`#secret-details-${name}`);

      if (btn.classList.contains('expanded')) {
        btn.classList.remove('expanded');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        detailsDiv.innerHTML = '';
        detailsDiv.style.display = 'none';
      } else {
        btn.classList.add('expanded');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>';

        try {
          const params = new URLSearchParams();
          if (context) params.append('context', context);
          params.append('namespace', namespace);
          params.append('name', name);

          const response = await fetch(`${apiEndpoint('secret-keys')}?${params.toString()}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          detailsDiv.innerHTML = renderSecretViewer(data);
          detailsDiv.style.display = 'block';
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

          attachSecretHandlers(detailsDiv, namespace, context);
        } catch (error) {
          console.error('[Configs] Failed to load Secret keys:', error);
          detailsDiv.innerHTML = `<div style="color: var(--color-danger);">Failed to load keys: ${error.message}</div>`;
          detailsDiv.style.display = 'block';
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
          btn.classList.remove('expanded');
        }
      }
    });
  });
}

/**
 * Attach Decode and Copy button handlers to a rendered secret viewer
 */
export function attachSecretHandlers(container, namespace, context) {
  const rows = container.querySelectorAll('.secret-key-row');
  rows.forEach(row => {
    const key = row.dataset.key;
    const secretName = row.dataset.secret;
    const valueDisplay = row.querySelector('.secret-value-display');
    const decodeBtn = row.querySelector('.secret-decode-btn');
    const copyBtn = row.querySelector('.secret-copy-btn');

    // Track decode state per row
    let isDecoded = false;
    let decodedValue = null;

    decodeBtn.addEventListener('click', async () => {
      if (isDecoded) {
        // Hide: revert to masked
        valueDisplay.textContent = '••••••••';
        valueDisplay.classList.remove('secret-value-revealed');
        decodeBtn.textContent = 'Decode';
        isDecoded = false;
        return;
      }

      decodeBtn.textContent = '...';
      decodeBtn.disabled = true;

      try {
        // Fetch encoded value from backend on first decode
        if (decodedValue === null) {
          const params = new URLSearchParams();
          if (context) params.append('context', context);
          params.append('namespace', namespace);
          params.append('name', secretName);
          params.append('key', key);

          const response = await fetch(`${apiEndpoint('secret-value')}?${params.toString()}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();

          try {
            decodedValue = atob(data.encodedValue);
          } catch {
            decodedValue = null;
            throw new Error('Invalid base64 — cannot decode');
          }
        }

        console.log('[Feature Handlers] Secret decoded for key:', key);
        valueDisplay.textContent = decodedValue;
        valueDisplay.classList.add('secret-value-revealed');
        decodeBtn.textContent = 'Hide';
        isDecoded = true;
      } catch (error) {
        console.error('[Feature Handlers] Failed to decode secret value:', error);
        valueDisplay.textContent = `Error: ${error.message}`;
        valueDisplay.classList.add('secret-value-error');
      } finally {
        decodeBtn.disabled = false;
        if (!isDecoded) decodeBtn.textContent = 'Decode';
      }
    });

    copyBtn.addEventListener('click', async () => {
      const valueToCopy = isDecoded ? decodedValue : null;

      if (valueToCopy === null) {
        // Not yet decoded — fetch and decode silently first
        copyBtn.textContent = '...';
        copyBtn.disabled = true;

        try {
          const params = new URLSearchParams();
          if (context) params.append('context', context);
          params.append('namespace', namespace);
          params.append('name', secretName);
          params.append('key', key);

          const response = await fetch(`${apiEndpoint('secret-value')}?${params.toString()}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          let raw;
          try {
            raw = atob(data.encodedValue);
          } catch {
            throw new Error('Invalid base64 — cannot decode');
          }

          // Cache for future use
          decodedValue = raw;

          await copyToClipboard(raw);
        } catch (error) {
          console.error('[Feature Handlers] Failed to copy secret value:', error);
          showToast(`Failed to copy: ${error.message}`, 'error');
        } finally {
          copyBtn.disabled = false;
          copyBtn.textContent = 'Copy';
        }
      } else {
        await copyToClipboard(valueToCopy);
      }
    });
  });
}

/**
 * Load configs tab content
 */
export async function loadConfigsTab(serviceName, namespace, context, targetPane, dataCache) {
  try {
    console.log('[Configs] Loading configs for service:', serviceName);

    const cacheKey = `${context}-${namespace}-${serviceName}`;
    if (dataCache.configs.has(cacheKey)) {
      console.log('[Configs] Using cached data');
      targetPane.innerHTML = dataCache.configs.get(cacheKey);
      attachConfigsHandlers(targetPane, namespace, context);
      return;
    }

    targetPane.innerHTML = `
      <div class="loading-state">
        <div class="cyber-spinner"></div>
        <span>Loading configs...</span>
      </div>
    `;

    const params = new URLSearchParams();
    if (context) params.append('context', context);
    params.append('namespace', namespace);
    params.append('service', serviceName);

    const response = await fetch(`${apiEndpoint('service-configs')}?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        handleTabAuthError(targetPane);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const html = renderServiceConfigs(data);

    dataCache.configs.set(cacheKey, html);
    targetPane.innerHTML = html;
    attachConfigsHandlers(targetPane, namespace, context);
  } catch (error) {
    console.error('[Configs] Failed to load configs:', error);
    targetPane.innerHTML = `
      <div class="loading-state">
        <span style="color: var(--color-danger);">Failed to load configs: ${error.message}</span>
      </div>
    `;
  }
}
