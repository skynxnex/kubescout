/**
 * Scale Handlers - Deployment and HPA scaling
 * Handles: performScaleDeployment, handleDirectScaleConfirm, handleHpaScaleConfirm, initScaleControls
 */

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
// Scale Modal (internal)
// ==============================================

/**
 * Show scale confirmation modal and execute on confirm
 */
function showScaleModal(title, bodyHtml, dangerClass, onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content ${dangerClass}">
      <div class="modal-header"><h2>${title}</h2></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
        <button class="modal-btn modal-btn-primary" data-action="confirm">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = (confirmed) => {
    modal.remove();
    document.removeEventListener('keydown', escHandler);
    if (confirmed) onConfirm();
    else if (onCancel) onCancel();
  };

  const escHandler = (e) => { if (e.key === 'Escape') close(false); };
  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
  modal.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
  modal.addEventListener('click', (e) => { if (e.target === modal) close(false); });
  document.addEventListener('keydown', escHandler);
}

// ==============================================
// Scale Deployment
// ==============================================

/**
 * Perform scale deployment API call
 */
export async function performScaleDeployment(serviceName, namespace, context, replicas, onReload, isHpaMode = false, hpaMaxReplicas = null) {
  console.log(`[Scale] Scaling ${serviceName} to ${replicas} replicas (HPA mode: ${isHpaMode})`);

  const row = document.querySelector(`tr[data-service-name="${CSS.escape(serviceName)}"]`);
  const scaleControls = row?.querySelector('.scale-controls');
  if (scaleControls) {
    scaleControls.style.opacity = '0.5';
    scaleControls.style.pointerEvents = 'none';
  }

  try {
    const params = new URLSearchParams();
    if (context) params.append('context', context);

    const response = await fetch(`${apiEndpoint('scale-deployment')}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'kubescout' },
      body: JSON.stringify({
        deploymentName: serviceName,
        namespace,
        replicas,
        scaleHpa: isHpaMode,
        hpaMaxReplicas: isHpaMode ? hpaMaxReplicas : null
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        showNotification('AWS authentication required! Run "aws sso login"', 'error', 0);
        throw new Error('Authentication failed');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Scale operation failed');
    }

    const successMsg = isHpaMode
      ? `Updated HPA for ${serviceName}: min ${replicas}, max ${hpaMaxReplicas}`
      : `Successfully scaled ${serviceName} to ${replicas} replicas`;
    showToast(successMsg, 'success');
    if (onReload) setTimeout(onReload, 2000);
  } catch (error) {
    console.error('[Scale] Failed to scale deployment:', error);
    showToast(`Failed to scale deployment: ${error.message}`, 'error');
    if (onReload) onReload();
  } finally {
    if (scaleControls) {
      scaleControls.style.opacity = '1';
      scaleControls.style.pointerEvents = 'auto';
    }
  }
}

/**
 * Handle +/- direct scale confirm button click
 */
export function handleDirectScaleConfirm(serviceName, onReload) {
  const namespace = window.IS_LOCAL_MODE
    ? (document.getElementById('namespaceInput')?.value || '')
    : (window.IN_CLUSTER_NAMESPACE || '');
  const context = window.IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value || '') : '';

  const row = document.querySelector(`tr[data-service-name="${CSS.escape(serviceName)}"]`);
  const scaleControls = row?.querySelector('.scale-controls');
  const confirmBtn = scaleControls?.querySelector('.scale-confirm');
  const currentSpan = scaleControls?.querySelector('.scale-current');

  const newReplicas = parseInt(confirmBtn?.dataset.target ?? '0');
  const originalReplicas = parseInt(scaleControls?.dataset.current ?? '0');

  let warningHtml = '';
  let dangerClass = '';
  if (newReplicas === 0) {
    warningHtml = '<div class="warning-box" style="margin-bottom:16px;">WARNING: Scaling to 0 will make this service unavailable.</div>';
    dangerClass = 'modal-danger';
  } else if (newReplicas > originalReplicas * 1.5 || newReplicas < originalReplicas * 0.5) {
    warningHtml = '<div class="warning-box" style="margin-bottom:16px;">This changes replica count by more than 50%.</div>';
    dangerClass = 'modal-warning';
  }

  const bodyHtml = `
    ${warningHtml}
    <div style="background:var(--bg-surface);padding:12px;border-radius:6px;margin-bottom:16px;">
      <p style="margin:0 0 8px 0;"><strong>Service:</strong> ${escapeHtml(serviceName)}</p>
      <p style="margin:0;"><strong>Scale:</strong> ${originalReplicas} &rarr; ${newReplicas} replicas</p>
    </div>
    <p style="font-size:14px;color:var(--text-secondary);">Kubernetes will gradually scale the deployment.</p>
  `;

  const resetControls = () => {
    if (currentSpan) currentSpan.textContent = originalReplicas;
    if (confirmBtn) {
      confirmBtn.dataset.target = originalReplicas;
      confirmBtn.classList.add('hidden');
    }
    const minusBtn = scaleControls?.querySelector('.scale-minus');
    if (minusBtn) minusBtn.disabled = originalReplicas === 0;
  };

  showScaleModal(
    'Confirm Scale',
    bodyHtml,
    dangerClass,
    () => performScaleDeployment(serviceName, namespace, context, newReplicas, onReload, false, null),
    resetControls
  );
}

/**
 * Handle HPA scale confirm button click
 */
export function handleHpaScaleConfirm(serviceName, onReload) {
  const namespace = window.IS_LOCAL_MODE
    ? (document.getElementById('namespaceInput')?.value || '')
    : (window.IN_CLUSTER_NAMESPACE || '');
  const context = window.IS_LOCAL_MODE ? (document.getElementById('contextInput')?.value || '') : '';

  const row = document.querySelector(`tr[data-service-name="${CSS.escape(serviceName)}"]`);
  const scaleControls = row?.querySelector('.scale-controls');

  const originalMin = parseInt(scaleControls?.dataset.hpaMin ?? '1');
  const originalMax = parseInt(scaleControls?.dataset.hpaMax ?? '1');
  const minInput = scaleControls?.querySelector('[data-field="min"]');
  const maxInput = scaleControls?.querySelector('[data-field="max"]');
  const newMin = parseInt(minInput?.value ?? originalMin);
  const newMax = parseInt(maxInput?.value ?? originalMax);

  const minChanged = newMin !== originalMin;
  const maxChanged = newMax !== originalMax;
  const minLabel = minChanged ? `${originalMin}&rarr;${newMin}` : `${newMin} (unchanged)`;
  const maxLabel = maxChanged ? `${originalMax}&rarr;${newMax}` : `${newMax} (unchanged)`;

  const bodyHtml = `
    <div style="background:var(--bg-surface);padding:12px;border-radius:6px;margin-bottom:16px;">
      <p style="margin:0 0 8px 0;"><strong>Service:</strong> ${escapeHtml(serviceName)}</p>
      <p style="margin:0 0 8px 0;"><strong>HPA min:</strong> ${minLabel}</p>
      <p style="margin:0;"><strong>HPA max:</strong> ${maxLabel}</p>
    </div>
    <p style="font-size:14px;color:var(--text-secondary);">
      Kubernetes will scale between ${newMin} and ${newMax} replicas automatically.
    </p>
  `;

  const resetConfirm = () => {
    scaleControls?.querySelector('.scale-confirm')?.classList.add('hidden');
  };

  showScaleModal(
    'Confirm HPA Update',
    bodyHtml,
    '',
    () => performScaleDeployment(serviceName, namespace, context, newMin, onReload, true, newMax),
    resetConfirm
  );
}

/**
 * Wire up scale controls for a service row (called from main.js after render)
 */
export function initScaleControls(row, serviceName, onReload) {
  const scaleControls = row.querySelector('.scale-controls');
  if (!scaleControls) return;

  const mode = scaleControls.dataset.scaleMode;

  if (mode === 'direct') {
    const minusBtn = scaleControls.querySelector('.scale-minus');
    const plusBtn = scaleControls.querySelector('.scale-plus');
    const currentSpan = scaleControls.querySelector('.scale-current');
    const confirmBtn = scaleControls.querySelector('.scale-confirm');

    const updateDirectUI = () => {
      const displayed = parseInt(currentSpan?.textContent ?? '0');
      const original = parseInt(scaleControls.dataset.current ?? '0');
      const changed = displayed !== original;
      if (confirmBtn) {
        confirmBtn.classList.toggle('hidden', !changed);
        confirmBtn.dataset.target = displayed;
      }
      if (minusBtn) minusBtn.disabled = displayed === 0;
    };

    plusBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = parseInt(currentSpan.textContent ?? '0') + 1;
      currentSpan.textContent = val;
      updateDirectUI();
    });

    minusBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = parseInt(currentSpan.textContent ?? '0');
      if (val > 0) {
        currentSpan.textContent = val - 1;
        updateDirectUI();
      }
    });

    confirmBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDirectScaleConfirm(serviceName, onReload);
    });

  } else if (mode === 'hpa') {
    const minInput = scaleControls.querySelector('[data-field="min"]');
    const maxInput = scaleControls.querySelector('[data-field="max"]');
    const confirmBtn = scaleControls.querySelector('.scale-confirm');
    const errorSpan = scaleControls.querySelector('.scale-hpa-error');

    const originalMin = parseInt(scaleControls.dataset.hpaMin ?? '1');
    const originalMax = parseInt(scaleControls.dataset.hpaMax ?? '1');

    const validateHpa = () => {
      const min = parseInt(minInput?.value ?? '1');
      const max = parseInt(maxInput?.value ?? '1');
      let error = '';

      if (min < 1) error = 'HPA requires min >= 1';
      else if (min > max) error = 'Min cannot exceed max';
      else if (max < min) error = 'Max cannot be less than min';

      if (errorSpan) {
        errorSpan.textContent = error;
        errorSpan.classList.toggle('hidden', !error);
      }

      const changed = min !== originalMin || max !== originalMax;
      const valid = !error;

      if (confirmBtn) {
        confirmBtn.classList.toggle('hidden', !changed || !valid);
        confirmBtn.disabled = !valid;
      }
    };

    const stopProp = (e) => e.stopPropagation();
    minInput?.addEventListener('input', (e) => { stopProp(e); validateHpa(); });
    maxInput?.addEventListener('input', (e) => { stopProp(e); validateHpa(); });
    minInput?.addEventListener('click', stopProp);
    maxInput?.addEventListener('click', stopProp);

    confirmBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHpaScaleConfirm(serviceName, onReload);
    });
  }
}
