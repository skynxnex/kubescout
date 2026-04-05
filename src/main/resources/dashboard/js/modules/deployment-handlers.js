/**
 * Deployment Handlers - Deployment history, rollback, and restart
 * Handles: loadDeploymentHistoryTab, showRollbackModal, performRollback,
 *          attachRollbackHandlers, showRestartModal, performRestart
 */

import { renderDeploymentHistory } from './ui-components.js';
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

function showToast(message, type = 'info') {
  showNotification(message, type, 3000);
}

// ==============================================
// Rollback
// ==============================================

/**
 * Extract image tag from full image path
 */
export function extractImageTag(imagePath) {
  const parts = imagePath.split(':');
  return parts.length > 1 ? parts[parts.length - 1] : imagePath;
}

/**
 * Perform rollback API call
 */
export async function performRollback(deploymentName, namespace, targetRevision, context) {
  const params = new URLSearchParams();
  if (context) params.append('context', context);

  const response = await fetch(`${apiEndpoint('rollback-deployment')}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'kss' },
    body: JSON.stringify({ deploymentName, namespace, targetRevision })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Rollback failed');
  }

  return result;
}

/**
 * Show rollback confirmation modal
 */
export function showRollbackModal(deploymentName, namespace, targetRevision, targetImage, context, onSuccess) {
  const currentRow = document.querySelector('.deployment-history-table .current-badge')?.closest('tr');
  const currentImage = currentRow?.querySelector('code')?.textContent || 'unknown';
  const currentRevision = currentRow?.querySelector('td:first-child')?.textContent.replace('CURRENT', '').trim() || '?';

  const currentTag = extractImageTag(currentImage);
  const targetTag = extractImageTag(targetImage);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-danger-large">
      <div class="modal-header">
        <h2 style="font-size: 28px; color: var(--accent-red);">⚠️ CRITICAL: ROLLBACK DEPLOYMENT</h2>
      </div>
      <div class="modal-body">
        <div class="warning-box-critical">
          <p style="font-size: 18px; font-weight: bold; margin: 0 0 12px 0;">
            🚨 THIS WILL CHANGE RUNNING CODE IN PRODUCTION
          </p>
          <p style="font-size: 14px; margin: 0;">
            Namespace: <strong>${escapeHtml(namespace)}</strong>
          </p>
          <p style="font-size: 14px; margin: 8px 0 0 0;">
            All running pods will be replaced with the target version. This cannot be undone automatically.
          </p>
        </div>

        <div class="comparison-vertical">
          <div class="comparison-item">
            <h4 style="color: var(--accent-red);">Current (WILL BE STOPPED)</h4>
            <p style="font-size: 16px; margin: 8px 0 0 0;">Revision <strong>${escapeHtml(currentRevision)}</strong></p>
            <code style="font-size: 16px; color: var(--accent-red);">${escapeHtml(currentTag)}</code>
          </div>
          <div style="text-align: center; font-size: 32px; margin: 16px 0; color: var(--accent-red);">↓</div>
          <div class="comparison-item">
            <h4 style="color: var(--accent-green);">Target (WILL BE DEPLOYED)</h4>
            <p style="font-size: 16px; margin: 8px 0 0 0;">Revision <strong>${targetRevision}</strong></p>
            <code style="font-size: 16px; color: var(--accent-green);">${escapeHtml(targetTag)}</code>
          </div>
        </div>

        <div class="confirmation-input">
          <label for="confirmRollback" style="font-size: 16px; font-weight: bold;">
            Type <span style="color: var(--accent-red); font-family: monospace; font-size: 18px;">ROLLBACK</span> to confirm:
          </label>
          <input type="text" id="confirmRollbackInput" placeholder="ROLLBACK" autocomplete="off" style="font-family: monospace; font-size: 16px; text-transform: uppercase;">
        </div>
      </div>
      <div class="modal-footer">
        <button class="cyber-button" id="cancelRollback" style="font-size: 16px;">Cancel</button>
        <button class="cyber-button cyber-button-danger" id="confirmRollback" disabled style="font-size: 16px;">Execute Rollback</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmInput = modal.querySelector('#confirmRollbackInput');
  const confirmBtn = modal.querySelector('#confirmRollback');
  const cancelBtn = modal.querySelector('#cancelRollback');

  confirmInput.addEventListener('input', () => {
    confirmBtn.disabled = confirmInput.value.toUpperCase() !== 'ROLLBACK';
  });

  cancelBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Rolling back...';

    try {
      await performRollback(deploymentName, namespace, targetRevision, context);
      modal.remove();
      showNotification('Rollback successful! Reloading...', 'success');
      if (onSuccess) onSuccess();
    } catch (error) {
      showNotification(`Rollback failed: ${error.message}`, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Rollback';
    }
  });
}

/**
 * Attach rollback button handlers
 */
export function attachRollbackHandlers(container, deploymentName, namespace, context, onSuccess) {
  const rollbackButtons = container.querySelectorAll('.rollback-btn');
  rollbackButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const revision = parseInt(btn.dataset.revision);
      const image = btn.dataset.image;
      showRollbackModal(deploymentName, namespace, revision, image, context, onSuccess);
    });
  });
}

/**
 * Load deployment history tab content
 */
export async function loadDeploymentHistoryTab(deploymentName, namespace, context, targetPane) {
  try {
    targetPane.innerHTML = `
      <div class="loading-state">
        <div class="cyber-spinner"></div>
        <span>Loading deployment history...</span>
      </div>
    `;

    if (!deploymentName) throw new Error('Deployment name is required');
    if (!namespace) throw new Error('Namespace is required');

    const params = new URLSearchParams();
    if (context) params.append('context', context);
    params.append('namespace', namespace);
    params.append('deployment', deploymentName);

    const response = await fetch(`${apiEndpoint('deployment-history')}?${params.toString()}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const historyData = await response.json();
    targetPane.innerHTML = renderDeploymentHistory(historyData, deploymentName, namespace);

    // onSuccess reloads this same tab.
    // Re-query the pane from DOM instead of using the closed-over targetPane,
    // which may be a detached node if loadData() ran during the 2s delay.
    const onSuccess = async () => {
      setTimeout(async () => {
        const freshPane = document.querySelector(`#deployment-${deploymentName}`);
        if (freshPane) {
          await loadDeploymentHistoryTab(deploymentName, namespace, context, freshPane);
        }
      }, 2000);
    };

    attachRollbackHandlers(targetPane, deploymentName, namespace, context, onSuccess);
  } catch (error) {
    console.error('[Dashboard] Failed to load deployment history:', error);
    targetPane.innerHTML = `
      <div class="loading-state">
        <span style="color: var(--color-danger);">Failed to load deployment history: ${error.message}</span>
      </div>
    `;
  }
}

// ==============================================
// Restart
// ==============================================

/**
 * Perform restart API call
 */
export async function performRestart(serviceName, namespace, context) {
  const params = new URLSearchParams();
  if (context) params.append('context', context);

  const response = await fetch(`${apiEndpoint('restart-deployment')}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'kss' },
    body: JSON.stringify({ serviceName, namespace })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Restart failed');
  }

  return result;
}

/**
 * Show restart confirmation modal
 */
export function showRestartModal(serviceName, namespace, context, onReload) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-restart">
      <div class="modal-header">
        <h2>Restart Deployment</h2>
      </div>
      <div class="modal-body">
        <p style="font-size: 16px; margin-bottom: 16px;">
          Are you sure you want to restart this service?
        </p>
        <div style="background: var(--bg-surface); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>Service:</strong> ${escapeHtml(serviceName)}</p>
          <p style="margin: 0;"><strong>Namespace:</strong> ${escapeHtml(namespace)}</p>
        </div>
        <p style="font-size: 14px; color: var(--text-secondary);">
          All pods for this service will be restarted one by one.
        </p>
      </div>
      <div class="modal-footer">
        <button class="cyber-button" id="cancelRestart">Cancel</button>
        <button class="cyber-button cyber-button-danger" id="confirmRestart">Restart</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = modal.querySelector('#confirmRestart');
  const cancelBtn = modal.querySelector('#cancelRestart');

  cancelBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Restarting...';

    try {
      await performRestart(serviceName, namespace, context);
      modal.remove();
      showNotification('Restart initiated successfully!', 'success');
      if (onReload) setTimeout(onReload, 2000);
    } catch (error) {
      showNotification(`Restart failed: ${error.message}`, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Restart';
    }
  });
}
