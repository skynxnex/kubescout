/**
 * Modern Dashboard - UI Components
 * Rendering logic for modern UI elements with Lucide icons
 */

import { rotateChevron } from './animations.js';
import { aiHelpIcon } from './ai-help.js';
import { escapeHtml } from './formatters.js';

/**
 * Render modern status badge with Lucide icon
 * @param {Object} status - Status object with cls, pill, and label
 * @returns {string} HTML string for badge
 */
export function renderStatusBadge(status) {
  let iconSvg = '';

  if (status.cls === 'bad' || status.pill === 'status-bad') {
    // X-Circle icon for error
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else if (status.cls === 'warn' || status.pill === 'status-warn') {
    // Alert-Triangle icon for warning
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    // Check-Circle icon for success
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  }

  const badgeClass = status.pill.replace('status-', '');
  return `<span class="status-badge ${badgeClass}">
    ${iconSvg}
    <span>${escapeHtml(status.label)}</span>
  </span>`;
}

/**
 * Render single pod indicator badge
 * @param {Object} item - Service item
 * @returns {string} HTML string for single pod badge
 */
export function renderSinglePodBadge(item) {
  if (item.podCount !== 1) return '';

  return `<span class="status-badge single-pod icon-only" title="Single Pod - No redundancy">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
      <line x1="12" y1="13" x2="12" y2="21"/>
    </svg>
  </span>`;
}

/**
 * Render expand/collapse button with animated chevron
 * @param {Object} item - Service item
 * @param {boolean} isOpen - Whether details are currently open
 * @returns {string} HTML string for expand button
 */
export function renderExpandButton(item, isOpen) {
  const serviceName = escapeHtml(String(item.serviceName || ''));
  const ariaExpanded = isOpen ? 'true' : 'false';
  const chevronClass = isOpen ? 'expanded' : '';

  return `<button
    class="expand-button ${chevronClass}"
    data-action="toggle"
    data-service="${serviceName}"
    aria-expanded="${ariaExpanded}"
    aria-label="Expand/Collapse details for ${serviceName}"
    type="button"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>`;
}

/**
 * Render restart button for service
 * @param {Object} item - Service item
 * @returns {string} HTML string for restart button
 */
export function renderRestartButton(item) {
  const serviceName = escapeHtml(String(item.serviceName || ''));

  return `<button
    class="restart-button"
    data-action="restart"
    data-service="${serviceName}"
    aria-label="Restart ${serviceName}"
    title="Restart deployment"
    type="button"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  </button>`;
}

/**
 * Render service logs button (combined live logs for all pods)
 * @param {Object} item - Service item
 * @returns {string} HTML string for service logs button
 */
export function renderServiceLogsButton(item) {
  const serviceName = escapeHtml(String(item.serviceName || ''));

  return `<button
    class="action-btn service-logs-btn"
    data-action="service-logs"
    data-service="${serviceName}"
    aria-label="View logs for all pods of ${serviceName}"
    title="View logs for all pods"
    type="button"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  </button>`;
}

/**
 * Build Humio service URL (logs for all pods in service)
 * @param {string} serviceName - Service name
 * @param {string} [namespace] - Kubernetes namespace (overrides window.HUMIO_NAMESPACE)
 * @returns {string} Humio search URL
 */
export function buildHumioServiceUrl(serviceName, namespace) {
  const base = String(window.HUMIO_BASE_URL || '').replace(/\/+$/, '');
  const repo = encodeURIComponent(String(window.HUMIO_REPO || '').trim());
  const tz = encodeURIComponent(String(window.HUMIO_TZ || '').trim() || 'Europe/Stockholm');
  const start = encodeURIComponent(String(window.HUMIO_START || '').trim() || '7d');

  const columns = encodeURIComponent('[{"type":"time","width":"content"},{"type":"field","fieldName":"@rawstring","format":"logline"}]');
  const query = encodeURIComponent(
    'kubernetes.namespace_name = "' + String(namespace || window.HUMIO_NAMESPACE || '').trim() + '"\n' +
    '| kubernetes.labels.app = "*' + String(serviceName || '').trim().replaceAll('"', '') + '*"'
  );

  return base + '/' + repo + '/search' +
    '?columns=' + columns +
    '&live=false' +
    '&newestAtBottom=true' +
    '&query=' + query +
    '&showOnlyFirstLine=false' +
    '&start=' + start +
    '&tz=' + tz +
    '&widgetType=list-view';
}

/**
 * Build Humio pod URL (logs for specific pod)
 * @param {string} podName - Pod name
 * @param {string} serviceName - Service name (for kubernetes.labels.app filter)
 * @param {string} namespace - Kubernetes namespace
 * @returns {string} Humio search URL
 */
export function buildHumioPodLogsUrl(podName, serviceName, namespace) {
  const base = String(window.HUMIO_BASE_URL || '').replace(/\/+$/, '');
  const repo = encodeURIComponent(String(window.HUMIO_REPO || '').trim());
  const tz = encodeURIComponent(String(window.HUMIO_TZ || '').trim() || 'Europe/Stockholm');
  const start = encodeURIComponent(String(window.HUMIO_START || '').trim() || '7d');

  const columns = encodeURIComponent('[{"type":"time","width":"content"},{"type":"field","fieldName":"@rawstring","format":"logline"}]');
  const query = encodeURIComponent(
    'kubernetes.namespace_name = "' + String(namespace || '').trim() + '"\n' +
    '| kubernetes.labels.app = "*' + String(serviceName || '').trim().replaceAll('"', '') + '*"\n' +
    '| kubernetes.pod_name = "' + String(podName || '').trim().replaceAll('"', '') + '"'
  );

  return base + '/' + repo + '/search' +
    '?columns=' + columns +
    '&live=false' +
    '&newestAtBottom=true' +
    '&query=' + query +
    '&showOnlyFirstLine=false' +
    '&start=' + start +
    '&tz=' + tz +
    '&widgetType=list-view';
}

/**
 * Render service name as link to Humio
 * @param {Object} item - Service item
 * @returns {string} HTML string for service link
 */
export function renderServiceLink(item) {
  const name = escapeHtml(item.serviceName || '');
  const namespace = item.namespace ||
    document.getElementById('namespaceInput')?.value ||
    window.HUMIO_NAMESPACE;
  const url = buildHumioServiceUrl(item.serviceName || '', namespace);

  return `<a href="${url}" class="service-link" target="_blank" rel="noopener">${name}</a>`;
}

/**
 * Render restart info indicators (warning/error icons)
 * @param {Object} item - Service item
 * @returns {string} HTML string for restart indicators
 */
export function renderRestartIndicators(item) {
  const restartReasons = item.restartReasons || {};
  const keys = Object.keys(restartReasons);
  if (keys.length === 0) return '';

  let html = '';

  // OOMKilled - memory icon with X
  if (keys.some(k => k === 'OOMKilled')) {
    const count = restartReasons['OOMKilled'] || 0;
    html += aiHelpIcon('status-oomkilled');
    html += `<span class="restart-badge oomkilled" title="OOMKilled (${count}x)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 10h.01"/>
        <path d="M15 10h.01"/>
        <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 18l2.5 3.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>
        <line x1="15" y1="6" x2="9" y2="12"/>
        <line x1="9" y1="6" x2="15" y2="12"/>
      </svg>
    </span>`;
  }

  // Error - alert octagon
  if (keys.some(k => k === 'Error')) {
    const count = restartReasons['Error'] || 0;
    html += `<span class="restart-badge error" title="Error (${count}x)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </span>`;
  }

  // Completed - info icon
  if (keys.some(k => k === 'Completed')) {
    const count = restartReasons['Completed'] || 0;
    html += `<span class="restart-badge completed" title="Completed (${count}x)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
    </span>`;
  }

  return html ? ' ' + html : '';
}

/**
 * Render a complete service row
 * @param {Object} item - Service item
 * @param {Object} status - Status object
 * @param {boolean} isOpen - Whether details are open
 * @param {Function} fmtDeploy - Deploy timestamp formatter
 * @param {Function} fmtHpa - HPA formatter
 * @returns {string} HTML string for service row
 */
export function renderServiceRow(item, status, isOpen, fmtDeploy, fmtHpa) {
  const extraClass = (item.podCount === 1) ? ' single' : '';
  const serviceName = escapeHtml(item.serviceName || '');
  const now = Date.now();

  return `<tr class="${status.cls}${extraClass}" data-service-name="${serviceName}" data-last-updated="${now}">
    <td class="expand-cell">
      <div style="display: flex; align-items: center; gap: 4px;">
        ${renderExpandButton(item, isOpen)}
        ${renderRestartButton(item)}
        ${renderServiceLogsButton(item)}
      </div>
    </td>
    <td data-field="serviceName">${renderServiceLink(item)}</td>
    <td data-field="podCount">
      <div class="pod-count-with-scale">
        <span class="pod-count-value">${item.podCount}</span>
        ${renderScaleControls(item)}
      </div>
    </td>
    <td data-field="hpa">${escapeHtml(fmtHpa(item) || '')}</td>
    <td data-field="readyCount">${item.readyCount}</td>
    <td data-field="restartCount">${item.restartCount}${renderRestartIndicators(item)}</td>
    <td data-field="deployed">${escapeHtml(fmtDeploy(item) || '')}</td>
    <td data-field="status">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div>${renderStatusBadge(status)} ${renderSinglePodBadge(item)}</div>
        <div class="service-update-time" style="font-size: 11px; color: var(--text-tertiary);">uppdaterad nyss</div>
      </div>
    </td>
  </tr>`;
}

/**
 * Render pod phase badge
 * @param {string} phase - Pod phase (Running, Pending, Failed, etc.)
 * @returns {string} HTML string for pod phase badge
 */
export function renderPodPhaseBadge(phase) {
  const phaseStr = String(phase || 'Unknown').toLowerCase();

  // Icon-based badges with cyberpunk styling
  let icon = '';
  let badgeClass = phaseStr;
  let title = phase || 'Unknown';

  if (phaseStr === 'running') {
    // Running - green checkmark
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`;
  } else if (phaseStr === 'pending' || phaseStr === 'podinitializing' || phaseStr === 'containercreating') {
    // Pending/Initializing - clock icon
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`;
    badgeClass = 'pending';
  } else if (phaseStr === 'failed' || phaseStr === 'error') {
    // Failed/Error - X in circle
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`;
    badgeClass = 'failed';
  } else if (phaseStr === 'crashloopbackoff' || phaseStr.includes('backoff')) {
    // CrashLoopBackOff - alert triangle
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
    badgeClass = 'crashloop';
  } else if (phaseStr === 'imagepullbackoff' || phaseStr === 'errimagepull' || phaseStr.includes('image')) {
    // ImagePullBackOff - download icon with X
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="8 17 12 21 16 17"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
      <line x1="16" y1="5" x2="8" y2="13"/>
    </svg>`;
    badgeClass = 'imagepull';
  } else if (phaseStr === 'terminating') {
    // Terminating - stop icon
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>`;
    badgeClass = 'terminating';
  } else if (phaseStr === 'evicted') {
    // Evicted - trash icon
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`;
    badgeClass = 'evicted';
  } else if (phaseStr === 'succeeded' || phaseStr === 'completed') {
    // Succeeded/Completed - checkmark with circle
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`;
    badgeClass = 'completed';
  } else {
    // Unknown - question mark
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`;
    badgeClass = 'unknown';
  }

  let statusAiIcon = '';
  if (phaseStr === 'crashloopbackoff' || phaseStr.includes('backoff')) {
    statusAiIcon = aiHelpIcon('status-crashloopbackoff');
  } else if (phaseStr === 'imagepullbackoff' || phaseStr === 'errimagepull' || phaseStr.includes('image')) {
    statusAiIcon = aiHelpIcon('status-imagepullbackoff');
  } else if (phaseStr === 'failed' || phaseStr === 'error') {
    statusAiIcon = aiHelpIcon('status-failed');
  } else if (phaseStr === 'pending' || phaseStr === 'podinitializing' || phaseStr === 'containercreating') {
    statusAiIcon = aiHelpIcon('status-pending');
  }

  return `<span style="display:inline-flex;align-items:center;gap:2px;"><span class="pod-phase-badge ${badgeClass}" title="${escapeHtml(title)}">${icon}</span>${statusAiIcon}</span>`;
}

/**
 * Render resource usage progress bar
 * @param {string} label - Resource label (CPU, Memory)
 * @param {number} usage - Usage value
 * @param {number} request - Request value
 * @param {number} limit - Limit value
 * @param {Function} formatter - Value formatter function
 * @returns {string} HTML string for progress bar
 */
export function renderResourceBar(label, usage, request, limit, formatter) {
  // Calculate percentage based on limit (if available), otherwise request
  // Limit is the hard cap, more meaningful than request % (aligns with k9s %MEM/L column)
  const denominator = (limit != null && limit > 0) ? limit : request;
  const percent = (usage != null && denominator != null && denominator > 0)
    ? Math.min(100, (usage / denominator) * 100)
    : 0;

  const usageStr = formatter(usage);
  const requestStr = formatter(request);
  const limitStr = formatter(limit);
  const percentStr = percent.toFixed(0) + '%';

  // Build resource info string (usage / request / limit)
  const parts = [usageStr];
  if (requestStr || limitStr) {
    const denom = [requestStr, limitStr].filter(Boolean).join(' / ');
    if (denom) parts.push('(' + denom + ')');
  }
  const resourceInfo = parts.join(' ');

  // Determine color class based on usage
  let colorClass = 'low';
  if (percent >= 80) colorClass = 'high';
  else if (percent >= 60) colorClass = 'medium';

  return `<div class="resource-usage">
    <div class="resource-label">
      <span>${escapeHtml(label)}</span>
      <span class="resource-value">${escapeHtml(percentStr)}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ${colorClass}" style="width: ${percent}%"></div>
    </div>
    <div class="resource-info">${escapeHtml(resourceInfo)}</div>
  </div>`;
}

/**
 * Render pod restart reason in parentheses
 * @param {Object} pod - Pod object with restartReasons
 * @returns {string} HTML string for restart reason (e.g., " (OOMKilled)")
 */
function renderPodRestartReason(pod) {
  const restarts = pod.restarts ?? 0;
  if (restarts === 0) return '';

  const restartReasons = pod.restartReasons || {};
  const keys = Object.keys(restartReasons);
  if (keys.length === 0) return '';

  // Prioritize by severity: OOMKilled > Error > Completed > others
  let primaryReason = '';
  if (keys.includes('OOMKilled')) {
    primaryReason = 'OOMKilled';
  } else if (keys.includes('Error')) {
    primaryReason = 'Error';
  } else if (keys.includes('Completed')) {
    primaryReason = 'Completed';
  } else {
    // Pick first available reason
    primaryReason = keys[0];
  }

  return ` <span style="color: var(--text-muted); font-size: 0.7rem;">(${escapeHtml(primaryReason)})</span>`;
}

/**
 * Render pod card (for expanded details)
 * @param {Object} pod - Pod object
 * @param {string} serviceName - Service name
 * @param {string} namespace - Kubernetes namespace
 * @param {Object} formatters - Object with formatter functions
 * @returns {string} HTML string for pod card
 */
export function renderPodCard(pod, serviceName, namespace, formatters) {
  const { fmtCpuVal, fmtMemVal, fmtAge } = formatters;

  const created = pod.createdAtEpochSeconds
    ? new Date(pod.createdAtEpochSeconds * 1000)
    : null;

  const podName = escapeHtml(pod.podName || '');
  const logsUrl = buildHumioPodLogsUrl(pod.podName || '', serviceName || '', namespace || '');

  return `<div class="pod-card" data-pod-name="${podName}">
    <div class="pod-card-header">
      <div class="pod-card-name">
        <a href="${logsUrl}" class="pod-link" target="_blank" rel="noopener" title="View logs in Humio">${podName}</a>
      </div>
      <div class="pod-card-actions">
        <button class="pod-logs-btn" data-pod="${podName}" title="View logs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </button>
        <button class="pod-shell-btn" data-pod="${podName}" title="Open terminal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </button>
        ${renderPodPhaseBadge(pod.status)}
      </div>
    </div>
    <div class="pod-card-body">
      ${renderResourceBar('CPU', pod.cpuUsageMilliCores, pod.cpuRequestMilliCores, pod.cpuLimitMilliCores, fmtCpuVal)}
      ${renderResourceBar('Memory', pod.memoryUsageBytes, pod.memoryRequestBytes, pod.memoryLimitBytes, fmtMemVal)}
      <div class="pod-metadata">
        <div class="pod-metadata-item">
          <div class="metadata-label">Node</div>
          <div class="metadata-value">${escapeHtml(pod.nodeName || 'n/a')}</div>
        </div>
        <div class="pod-metadata-item">
          <div class="metadata-label">IP</div>
          <div class="metadata-value">${escapeHtml(pod.podIp || 'n/a')}</div>
        </div>
        <div class="pod-metadata-item">
          <div class="metadata-label">Age</div>
          <div class="metadata-value pod-age-value"${created ? ` data-created-epoch="${pod.createdAtEpochSeconds * 1000}"` : ''}>${escapeHtml(created ? fmtAge(created) : 'n/a')}</div>
        </div>
        <div class="pod-metadata-item">
          <div class="metadata-label">Restarts</div>
          <div class="metadata-value">${escapeHtml(String(pod.restarts ?? '0'))}${renderPodRestartReason(pod)}${(pod.restarts ?? 0) >= 5 ? aiHelpIcon('high-restarts') : ''}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/**
 * Render pod details container with cards
 * @param {Array} pods - Array of pod objects
 * @param {string} serviceName - Service name
 * @param {string} namespace - Kubernetes namespace
 * @param {Object} formatters - Object with formatter functions
 * @returns {string} HTML string for pod details
 */
export function renderPodDetails(pods, serviceName, namespace, formatters) {
  if (!pods || pods.length === 0) {
    return '<div class="pod-details-empty">No pods.</div>';
  }

  const cards = pods.map(pod => renderPodCard(pod, serviceName, namespace, formatters)).join('');

  return `<div class="pod-details-container">
    ${cards}
  </div>`;
}

/**
 * Render tabs for expanded service
 * @param {string} serviceName - Service name
 * @param {string} namespace - Kubernetes namespace
 * @returns {string} HTML string for service details tabs
 */
export function renderServiceDetailsTabs(serviceName, namespace) {
  return `
    <div class="service-details-tabs">
      <div class="tab-buttons">
        <button class="tab-button active" data-tab="pods" data-service="${escapeHtml(serviceName)}">
          <span class="tab-icon">📦</span>
          <span>Pods</span>
        </button>
        <button class="tab-button" data-tab="events" data-service="${escapeHtml(serviceName)}">
          <span class="tab-icon">📋</span>
          <span>Events</span>
        </button>
        <button class="tab-button" data-tab="configs" data-service="${escapeHtml(serviceName)}">
          <span class="tab-icon">⚙️</span>
          <span>Configs</span>
        </button>
        <button class="tab-button" data-tab="endpoints" data-service="${escapeHtml(serviceName)}">
          <span class="tab-icon">🔗</span>
          <span>Endpoints</span>
        </button>
        <button class="tab-button" data-tab="deployment" data-service="${escapeHtml(serviceName)}">
          <span class="tab-icon">🕐</span>
          <span>Deployments</span>
        </button>
      </div>
      <div class="tab-content">
        <div class="tab-pane active" id="pods-${escapeHtml(serviceName)}">
          <div class="loading-state">
            <span>Loading pods...</span>
          </div>
        </div>
        <div class="tab-pane" id="events-${escapeHtml(serviceName)}" style="display: none;">
          <div class="loading-state">
            <span>Loading events...</span>
          </div>
        </div>
        <div class="tab-pane" id="configs-${escapeHtml(serviceName)}" style="display: none;">
          <div class="loading-state">
            <span>Loading configs...</span>
          </div>
        </div>
        <div class="tab-pane" id="endpoints-${escapeHtml(serviceName)}" style="display: none;">
          <div class="loading-state">
            <span>Loading endpoints...</span>
          </div>
        </div>
        <div class="tab-pane" id="deployment-${escapeHtml(serviceName)}" style="display: none;">
          <div class="loading-state">
            <span>Loading deployment history...</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format age helper
 * @param {Date} date - Date object
 * @returns {string} Formatted age string
 */
function formatAge(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Render deployment history table
 * @param {Object} historyData - Deployment history data
 * @param {string} serviceName - Service name
 * @param {string} namespace - Kubernetes namespace
 * @returns {string} HTML string for deployment history table
 */
export function renderDeploymentHistory(historyData, serviceName, namespace) {
  if (!historyData || !historyData.revisions || historyData.revisions.length === 0) {
    return '<div class="empty-state">No deployment history available</div>';
  }

  const rows = historyData.revisions.map(rev => {
    const date = new Date(rev.createdAtEpochSeconds * 1000);
    const age = formatAge(date);
    const currentBadge = rev.isCurrent ? '<span class="current-badge">CURRENT</span>' : '';
    const rollbackBtn = !rev.isCurrent
      ? `<button class="rollback-btn" data-deployment="${escapeHtml(serviceName)}" data-namespace="${escapeHtml(namespace)}" data-revision="${rev.revision}" data-image="${escapeHtml(rev.image)}">Rollback</button>`
      : '';

    return `
      <tr>
        <td>${rev.revision} ${currentBadge}</td>
        <td><code>${escapeHtml(rev.image)}</code></td>
        <td>${age}</td>
        <td>${rollbackBtn}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="deployment-history-table">
      <thead>
        <tr>
          <th>Revision</th>
          <th>Image</th>
          <th>Age</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/* ============================================
   Feature 5: Service Endpoints View
   ============================================ */

/**
 * Render service endpoints view
 * @param {Object} endpointsData - Endpoints data from API
 * @returns {string} HTML string for endpoints view
 */
export function renderServiceEndpoints(endpointsData) {
  console.log('[Service Endpoints] Rendering endpoints data');

  if (!endpointsData) {
    return '<div class="empty-state">No endpoint data available</div>';
  }

  const serviceTypeBadge = renderServiceTypeBadge(endpointsData.serviceType);
  const clusterIp = escapeHtml(endpointsData.clusterIp || 'None');
  const ports = endpointsData.ports || [];
  const endpoints = endpointsData.endpoints || [];
  const ingresses = endpointsData.ingresses || [];

  // Render ports list
  const portsHtml = ports.length > 0
    ? ports.map(p => `<code class="port-item">${escapeHtml(p.name || 'unnamed')}:${p.port}/${escapeHtml(p.protocol || 'TCP')}</code>`).join(' ')
    : '<span class="text-muted">No ports</span>';

  // Render endpoints table
  const endpointsTableHtml = endpoints.length > 0
    ? `<table class="endpoints-table">
        <thead>
          <tr>
            <th>Address</th>
            <th>Pod Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${endpoints.map(ep => {
            const readyIndicator = ep.ready
              ? '<span class="ready-indicator ready"></span>'
              : '<span class="ready-indicator not-ready"></span>';
            const copyBtn = `<button class="copy-btn" data-copy="${escapeHtml(ep.ip)}" title="Copy address">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>`;
            return `
              <tr>
                <td><code>${escapeHtml(ep.ip)}</code> ${copyBtn}</td>
                <td>${escapeHtml(ep.podName || 'n/a')}</td>
                <td>${readyIndicator} ${ep.ready ? 'Ready' : 'Not Ready'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>`
    : '<div class="empty-state">No endpoints available</div>';

  // Render ingress URLs
  const ingressesHtml = ingresses.length > 0
    ? `<div class="ingress-list">
        ${ingresses.map(rule => {
          const url = rule.host ? `https://${rule.host}${rule.path || '/'}` : null;
          if (!url) return '';
          const displayText = rule.host;
          const copyBtn = `<button class="copy-btn" data-copy="${escapeHtml(url)}" title="Copy URL">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>`;
          return `<div class="ingress-item">
            <div class="ingress-item-main">
              <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="ingress-link">${escapeHtml(displayText)}</a>
              ${copyBtn}
            </div>
            ${rule.address ? `<div class="ingress-address"><span class="ingress-address-label">Address:</span> <code class="ingress-address-value">${escapeHtml(rule.address)}</code></div>` : ''}
          </div>`;
        }).join('')}
      </div>`
    : '<div class="empty-state">No ingress URLs</div>';

  return `
    <div class="endpoints-view">
      <div class="endpoints-header">
        <div class="endpoint-info-row">
          <span class="endpoint-label">Service Type:</span>
          ${serviceTypeBadge}
        </div>
        <div class="endpoint-info-row">
          <span class="endpoint-label">Cluster IP:</span>
          <code>${clusterIp}</code>
        </div>
        <div class="endpoint-info-row">
          <span class="endpoint-label">Ports:</span>
          <div class="ports-list">${portsHtml}</div>
        </div>
      </div>

      <div class="section-divider"></div>

      <div class="endpoints-section">
        <h4 class="section-title">Endpoints ${aiHelpIcon('endpoints')}</h4>
        ${endpointsTableHtml}
      </div>

      ${ingresses.length > 0 ? `
        <div class="section-divider"></div>
        <div class="ingress-section">
          <h4 class="section-title">Ingress URLs</h4>
          ${ingressesHtml}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render service type badge
 * @param {string} serviceType - Service type (ClusterIP, LoadBalancer, NodePort)
 * @returns {string} HTML string for service type badge
 */
function renderServiceTypeBadge(serviceType) {
  const type = String(serviceType || 'Unknown').toLowerCase();
  let badgeClass = 'service-type-badge';

  if (type === 'loadbalancer') badgeClass += ' loadbalancer';
  else if (type === 'nodeport') badgeClass += ' nodeport';
  else if (type === 'clusterip') badgeClass += ' clusterip';

  return `<span class="${badgeClass}">${escapeHtml(serviceType || 'Unknown')}</span>`;
}

/* ============================================
   Feature 1: Pod Events Timeline
   ============================================ */

/**
 * Render pod events timeline
 * @param {Array} events - Array of event objects
 * @returns {string} HTML string for events timeline
 */
export function renderPodEventsTimeline(events) {
  console.log('[Pod Events] Rendering events timeline');

  if (!events || events.length === 0) {
    return '<div class="empty-state">No events found</div>';
  }

  // Group events by pod
  const eventsByPod = {};
  events.forEach(event => {
    const podName = event.podName || 'Unknown';
    if (!eventsByPod[podName]) {
      eventsByPod[podName] = [];
    }
    eventsByPod[podName].push(event);
  });

  // Render each pod's events
  const podSections = Object.keys(eventsByPod).map(podName => {
    const podEvents = eventsByPod[podName];
    const eventsHtml = podEvents.slice(0, 10).map(event => renderEventItem(event)).join('');
    const hasMore = podEvents.length > 10;

    return `
      <div class="pod-events-section">
        <h4 class="pod-events-header">${escapeHtml(podName)}</h4>
        <div class="events-timeline">
          ${eventsHtml}
        </div>
        ${hasMore ? `
          <button class="show-all-events-btn" data-pod="${escapeHtml(podName)}">
            Show all ${podEvents.length} events
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="events-view">
      <div class="events-filter">
        <label class="filter-checkbox">
          <input type="checkbox" id="filter-warnings" />
          <span>Show only warnings</span>
        </label>
      </div>
      ${podSections}
    </div>
  `;
}

/** Map a K8s event reason to an ai-help concept key. */
function resolveEventConceptKey(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('backoff') || r.includes('back-off')) return 'event-backoff';
  if (r.includes('oom') || r.includes('killed')) return 'event-oomkilled';
  if (r === 'pulled' || r === 'pulling') return 'event-pulled';
  if (r.includes('failed') || r.includes('fail')) return 'event-failed';
  return 'event-generic';
}

/**
 * Render single event item
 * @param {Object} event - Event object
 * @returns {string} HTML string for event item
 */
function renderEventItem(event) {
  const isWarning = event.type === 'Warning';
  const icon = isWarning
    ? `<svg class="event-icon warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>`
    : `<svg class="event-icon normal" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>`;

  const timestamp = event.lastTimestamp || event.firstTimestamp;
  const relativeTime = timestamp ? formatRelativeTime(new Date(timestamp)) : 'Unknown time';
  const absoluteTime = timestamp ? new Date(timestamp).toLocaleString() : '';

  const reason = event.reason || 'Unknown';
  const eventAiIcon = aiHelpIcon(resolveEventConceptKey(reason));

  return `
    <div class="event-item ${isWarning ? 'warning' : 'normal'}">
      <div class="event-icon-wrapper">${icon}</div>
      <div class="event-content">
        <div class="event-message">${escapeHtml(event.message || 'No message')}</div>
        <div class="event-meta">
          <span class="event-reason">${escapeHtml(reason)}${eventAiIcon}</span>
          <span class="event-time" title="${absoluteTime}">${relativeTime}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date} date - Date object
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

/* ============================================
   Feature 2: Quick Pod Logs View
   ============================================ */

/**
 * Render pod logs viewer
 * @param {Object} logsData - Logs data with logs array and containerName
 * @param {Array} containers - Available containers in the pod
 * @returns {string} HTML string for logs viewer
 */
export function renderPodLogsViewer(logsData, containers) {
  console.log('[Pod Logs] Rendering logs viewer');

  if (!logsData || !logsData.logs || logsData.logs.length === 0) {
    return '<div class="empty-state">No logs available</div>';
  }

  const containerSelector = containers && containers.length > 1
    ? `<div class="logs-controls">
        <label for="container-select">Container:</label>
        <select id="container-select" class="container-select">
          ${containers.map(c => `
            <option value="${escapeHtml(c)}" ${c === logsData.containerName ? 'selected' : ''}>
              ${escapeHtml(c)}
            </option>
          `).join('')}
        </select>
      </div>`
    : '';

  // Apply syntax highlighting
  const lines = Array.isArray(logsData.logs) ? logsData.logs : logsData.logs.split('\n');
  const logsHtml = lines.map((line, index) => {
    const highlighted = highlightLogLine(line);
    return `<div class="log-line"><span class="line-number">${index + 1}</span><span class="line-content">${highlighted}</span></div>`;
  }).join('');

  return `
    <div class="logs-viewer">
      <div class="logs-header">
        ${containerSelector}
        <div class="logs-actions">
          <label class="logs-checkbox">
            <input type="checkbox" id="show-line-numbers" checked />
            <span>Line numbers</span>
          </label>
          <label class="logs-checkbox">
            <input type="checkbox" id="auto-scroll" checked />
            <span>Auto-scroll</span>
          </label>
          <button class="logs-action-btn" id="copy-logs-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy All
          </button>
        </div>
      </div>
      <div class="logs-content" id="logs-content">
        ${logsHtml}
      </div>
    </div>
  `;
}

/**
 * Highlight log line with simple syntax highlighting
 * @param {string} line - Log line
 * @returns {string} Highlighted HTML
 */
function highlightLogLine(line) {
  const escaped = escapeHtml(line);

  // Simple regex-based highlighting
  return escaped
    .replace(/\b(ERROR|ERRO|ERR)\b/g, '<span class="log-error">$1</span>')
    .replace(/\b(WARN|WARNING)\b/g, '<span class="log-warn">$1</span>')
    .replace(/\b(INFO|INF)\b/g, '<span class="log-info">$1</span>')
    .replace(/\b(DEBUG|DBG)\b/g, '<span class="log-debug">$1</span>');
}

/* ============================================
   Feature 4: ConfigMap/Secret Viewer
   ============================================ */

/**
 * Render service configs (ConfigMaps and Secrets)
 * @param {Object} configs - Configs data with configMaps and secrets arrays
 * @returns {string} HTML string for configs view
 */
export function renderServiceConfigs(configs) {
  console.log('[Service Configs] Rendering configs');

  if (!configs) {
    return '<div class="empty-state">No config data available</div>';
  }

  const configMaps = configs.configMaps || [];
  const secrets = configs.secrets || [];

  if (configMaps.length === 0 && secrets.length === 0) {
    return '<div class="empty-state">No ConfigMaps or Secrets found</div>';
  }

  const configMapsHtml = configMaps.length > 0
    ? `<div class="configs-section">
        <h4 class="section-title">ConfigMaps ${aiHelpIcon('configmap')}</h4>
        <div class="config-items">
          ${configMaps.map(cm => renderConfigMapItem(cm)).join('')}
        </div>
      </div>`
    : '';

  const secretsHtml = secrets.length > 0
    ? `<div class="configs-section">
        <h4 class="section-title">Secrets ${aiHelpIcon('secret')}</h4>
        <div class="config-items">
          ${secrets.map(secret => renderSecretItem(secret)).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="configs-view">
      ${configMapsHtml}
      ${secretsHtml}
    </div>
  `;
}

/**
 * Render ConfigMap item (collapsed)
 * @param {Object} configMap - ConfigMap object
 * @returns {string} HTML string for ConfigMap item
 */
function renderConfigMapItem(configMap) {
  const keyCount = configMap.keys ? configMap.keys.length : 0;
  return `
    <div class="config-item" data-type="configmap" data-name="${escapeHtml(configMap.name)}">
      <div class="config-item-header">
        <div class="config-item-title">
          <svg class="config-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>${escapeHtml(configMap.name)}</span>
          <span class="config-badge">${keyCount} key${keyCount !== 1 ? 's' : ''}</span>
        </div>
        <button class="expand-configmap-btn" data-name="${escapeHtml(configMap.name)}" aria-label="Expand ConfigMap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
      <div class="config-item-content" id="configmap-details-${escapeHtml(configMap.name)}" style="display: none;">
        <div class="loading-state">
          <span>Loading ConfigMap data...</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Secret item (collapsed)
 * @param {Object} secret - Secret object
 * @returns {string} HTML string for Secret item
 */
function renderSecretItem(secret) {
  const keyCount = secret.keys ? secret.keys.length : 0;
  return `
    <div class="config-item" data-type="secret" data-name="${escapeHtml(secret.name)}">
      <div class="config-item-header">
        <div class="config-item-title">
          <svg class="config-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>${escapeHtml(secret.name)}</span>
          <span class="config-badge secret">${keyCount} key${keyCount !== 1 ? 's' : ''}</span>
        </div>
        <button class="expand-secret-btn" data-name="${escapeHtml(secret.name)}" aria-label="Expand Secret">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
      <div class="config-item-content" id="secret-details-${escapeHtml(secret.name)}" style="display: none;">
        <div class="loading-state">
          <span>Loading Secret keys...</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render ConfigMap data (expanded)
 * @param {Object} data - ConfigMap data with key-value pairs
 * @returns {string} HTML string for ConfigMap data
 */
export function renderConfigMapViewer(data) {
  console.log('[ConfigMap Viewer] Rendering ConfigMap data');

  if (!data || !data.data) {
    return '<div class="empty-state">No data in ConfigMap</div>';
  }

  const entries = Object.entries(data.data);
  if (entries.length === 0) {
    return '<div class="empty-state">ConfigMap is empty</div>';
  }

  return `
    <table class="config-data-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([key, value]) => `
          <tr>
            <td><code class="config-key">${escapeHtml(key)}</code></td>
            <td><pre class="config-value">${escapeHtml(value)}</pre></td>
            <td>
              <button class="copy-btn" data-copy="${escapeHtml(value)}" title="Copy value">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Render Secret keys (expanded, values masked)
 * @param {Object} data - Secret data with keys array
 * @returns {string} HTML string for Secret keys
 */
export function renderSecretViewer(data) {
  console.log('[Secret Viewer] Rendering Secret keys');

  if (!data || !data.keys || data.keys.length === 0) {
    return '<div class="empty-state">No keys in Secret</div>';
  }

  const secretName = escapeHtml(data.name || '');
  const namespace = escapeHtml(data.namespace || '');

  return `
    <div class="secret-warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Secret values are masked for security. Click Decode to reveal a value.
    </div>
    <table class="config-data-table secret-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
          <th class="secret-actions-col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.keys.map(key => `
          <tr class="secret-key-row" data-key="${escapeHtml(key)}" data-secret="${secretName}" data-namespace="${namespace}">
            <td><code class="config-key">${escapeHtml(key)}</code></td>
            <td>
              <span class="masked-value secret-value-display">••••••••</span>
            </td>
            <td class="secret-actions-col">
              <button class="secret-action-btn secret-decode-btn" title="Decode base64 value">Decode</button>
              <button class="secret-action-btn secret-copy-btn" title="Copy current value to clipboard">Copy</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ============================================
   Feature 3: Scale Deployment Controls
   ============================================ */

/**
 * Render scale controls for a service
 * @param {Object} service - Service object
 * @returns {string} HTML string for scale controls
 */
export function renderScaleControls(service) {
  const hasHpa = service.hpaMinReplicas != null;

  if (hasHpa) {
    const hpaMin = service.hpaMinReplicas;
    const hpaMax = service.hpaMaxReplicas;
    return `
      <div class="scale-controls" data-scale-mode="hpa"
           data-hpa-min="${hpaMin}" data-hpa-max="${hpaMax}">
        <span class="scale-label">HPA</span>
        <label class="scale-hpa-label">Min
          <input class="scale-hpa-input" data-field="min" type="number"
                 value="${hpaMin}" min="1" aria-label="HPA min replicas">
        </label>
        <label class="scale-hpa-label">Max
          <input class="scale-hpa-input" data-field="max" type="number"
                 value="${hpaMax}" min="1" aria-label="HPA max replicas">
        </label>
        <button class="scale-confirm hidden" data-action="scale-confirm-hpa">Confirm</button>
        <span class="scale-hpa-error hidden"></span>
      </div>
    `;
  }

  const replicas = service.podCount || 0;
  return `
    <div class="scale-controls" data-scale-mode="direct" data-current="${replicas}">
      <button class="scale-btn scale-minus" data-action="scale-minus"${replicas === 0 ? ' disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <span class="scale-current">${replicas}</span>
      <button class="scale-btn scale-plus" data-action="scale-plus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button class="scale-confirm hidden" data-action="scale-confirm-direct" data-target="${replicas}">Confirm</button>
    </div>
  `;
}
