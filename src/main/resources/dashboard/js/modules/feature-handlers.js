/**
 * Feature Handlers - Re-export barrel
 *
 * This file re-exports all feature handler functions from their sub-modules.
 * main.js and index.html import from this file and do not need to change.
 *
 * Sub-modules:
 *   endpoint-handlers.js  - Service endpoints + pod events tabs
 *   log-handlers.js       - Pod log viewer + service log streaming
 *   config-handlers.js    - ConfigMap and Secret viewer
 *   deployment-handlers.js - Deployment history, rollback, restart
 *   scale-handlers.js     - Deployment and HPA scaling
 *   shell-handlers.js     - Pod interactive terminal
 */

// Utility re-exports (consumed by main.js)
import { escapeHtml, showNotification } from './formatters.js';
export { escapeHtml, showNotification };

export function formatTimestamp(epochSeconds) {
  if (!epochSeconds) return '';
  const date = new Date(epochSeconds * 1000);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function showToast(message, type = 'info') {
  showNotification(message, type, 3000);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success', 3000);
    return true;
  } catch (error) {
    console.error('[Dashboard] Failed to copy to clipboard:', error);
    showNotification('Failed to copy to clipboard', 'error', 3000);
    return false;
  }
}

export function showConfirmModal(title, message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="modal-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
        <button class="modal-btn modal-btn-primary" data-action="confirm">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const handleAction = (action) => {
    modal.remove();
    if (action === 'confirm' && onConfirm) {
      onConfirm();
    }
  };

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => handleAction('cancel'));
  modal.querySelector('[data-action="confirm"]').addEventListener('click', () => handleAction('confirm'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) handleAction('cancel');
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      handleAction('cancel');
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function handleTabAuthError(targetPane) {
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

export function attachCopyHandlers(container) {
  const copyButtons = container.querySelectorAll('[data-copy]');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.copy);
    });
  });
}

// Endpoint + Events
export { loadEndpointsTab } from './endpoint-handlers.js';
export { loadEventsTab, attachEventsHandlers } from './endpoint-handlers.js';

// Logs
export {
  attachLogViewerHandlers,
  attachPodLogsHandlers,
  showPodLogsModal,
  showServiceLogsModal
} from './log-handlers.js';

// ConfigMaps / Secrets
export {
  attachConfigsHandlers,
  attachSecretHandlers,
  loadConfigsTab
} from './config-handlers.js';

// Deployment history + rollback + restart
export {
  extractImageTag,
  performRollback,
  showRollbackModal,
  attachRollbackHandlers,
  loadDeploymentHistoryTab,
  performRestart,
  showRestartModal
} from './deployment-handlers.js';

// Scale
export {
  performScaleDeployment,
  handleDirectScaleConfirm,
  handleHpaScaleConfirm,
  initScaleControls
} from './scale-handlers.js';

// Shell
export {
  attachPodShellHandlers,
  openPodShell
} from './shell-handlers.js';
