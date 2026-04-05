/**
 * Shared Formatters and Utility Functions
 * Single source of truth for formatting and notification helpers
 * used across main.js, problematic-pods.js, feature-handlers.js, and ui-components.js
 */

/**
 * Escape HTML to prevent XSS
 * Uses the browser's own text-node escaping — handles all edge cases correctly.
 * @param {*} str - Value to escape (coerced to string)
 * @returns {string} HTML-safe string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/**
 * Format CPU value in millicores
 * Values >= 1000m are displayed as cores (e.g. 2000m -> "2c"), otherwise as millicores (e.g. "500m").
 * @param {number|null} m - CPU value in millicores
 * @returns {string} Formatted string, or '' if null/undefined
 */
export function fmtCpuVal(m) {
  if (m == null) return '';
  if (m >= 1000) return (m / 1000).toFixed(m % 1000 === 0 ? 0 : 2) + 'c';
  return String(m) + 'm';
}

/**
 * Format memory value in bytes
 * Values < 1 GiB are displayed in MiB, larger values in GiB.
 * @param {number|null} b - Memory value in bytes
 * @returns {string} Formatted string, or '' if null/undefined
 */
export function fmtMemVal(b) {
  if (b == null) return '';
  const mib = b / (1024 * 1024);
  if (mib < 1024) return mib.toFixed(mib < 10 ? 1 : 0) + 'Mi';
  const gib = mib / 1024;
  return gib.toFixed(gib < 10 ? 1 : 0) + 'Gi';
}

/**
 * Format a Date object as a human-readable age string (e.g. "2d3h", "5h10m", "45m")
 * @param {Date} date - The reference date to measure age from (now - date)
 * @returns {string} Formatted age string
 */
export function fmtAge(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return days + 'd' + (hours > 0 ? hours + 'h' : '');
  if (hours > 0) return hours + 'h' + (mins > 0 ? mins + 'm' : '');
  return mins + 'm';
}

/**
 * Build a Humio pod log search URL.
 * Consolidated from ProblematicPodCard.js (Fas 8) — matches buildHumioPodLogsUrl() in ui-components.js.
 * Values are taken from window globals set by the HTML template.
 *
 * @param {string} podName
 * @param {string} serviceName
 * @param {string} namespace
 * @returns {string} Humio search URL
 */
export function buildHumioPodLogsUrl(podName, serviceName, namespace) {
  const base = String(window.HUMIO_BASE_URL || '').replace(/\/+$/, '');
  const repo = encodeURIComponent(String(window.HUMIO_REPO || '').trim());
  const tz   = encodeURIComponent(String(window.HUMIO_TZ  || '').trim() || 'Europe/Stockholm');
  const start = encodeURIComponent(String(window.HUMIO_START || '').trim() || '7d');

  const columns = encodeURIComponent('[{"type":"time","width":"content"},{"type":"field","fieldName":"@rawstring","format":"logline"}]');
  const query = encodeURIComponent(
    'kubernetes.namespace_name = "' + String(namespace || '').trim() + '"\n' +
    '| kubernetes.labels.app = "*' + String(serviceName || '').trim().replaceAll('"', '') + '*"\n' +
    '| kubernetes.pod_name = "' + String(podName || '').trim().replaceAll('"', '') + '"'
  );

  return `${base}/${repo}/search?columns=${columns}&live=false&newestAtBottom=true&query=${query}&showOnlyFirstLine=false&start=${start}&tz=${tz}&widgetType=list-view`;
}

/**
 * Show a cyberpunk-styled notification in #notificationContainer
 * @param {string} message - Notification message text
 * @param {'info'|'success'|'warn'|'error'} type - Notification type
 * @param {number} duration - Auto-dismiss delay in ms (0 = no auto-dismiss)
 */
export function showNotification(message, type = 'info', duration = 5000) {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  const iconMap = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  notification.innerHTML = `
    <div class="notification-icon">${iconMap[type] || iconMap.info}</div>
    <div class="notification-content">
      <div class="notification-message">${escapeHtml(message)}</div>
    </div>
    <button class="notification-close" aria-label="Close">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  container.appendChild(notification);

  const closeBtn = notification.querySelector('.notification-close');
  const closeNotification = () => {
    notification.classList.add('removing');
    setTimeout(() => notification.remove(), 300);
  };

  closeBtn.addEventListener('click', closeNotification);

  if (duration > 0) {
    setTimeout(closeNotification, duration);
  }
}
