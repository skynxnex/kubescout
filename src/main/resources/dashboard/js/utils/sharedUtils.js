/**
 * Shared utilities for Vue components — Fas 8
 *
 * Consolidates helpers that were duplicated across Vue component files.
 * Vanilla JS modules (ui-components.js, feature-handlers.js, etc.) are NOT
 * changed — they keep their own local copies to avoid circular dependencies.
 *
 * Exports:
 *   escapeHtml        — XSS-safe string escaping (re-exported from formatters.js)
 *   apiEndpoint       — Resolves local vs. in-cluster endpoint path
 *   showToast         — Thin wrapper around showNotification (3 s default)
 */

import { escapeHtml, showNotification } from '../modules/formatters.js';

// Re-export escapeHtml so Vue components can import everything from one place.
export { escapeHtml };

/**
 * Resolve an API endpoint path based on the current mode.
 * Mirrors the local apiEndpoint() helpers in the vanilla JS modules.
 *
 * @param {string} name - Base endpoint name without leading slash or '-local' suffix
 * @returns {string} Full path, e.g. '/pod-logs-local' or '/pod-logs'
 */
export function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

/**
 * Show a brief notification toast.
 * Thin wrapper around showNotification with a 3-second default duration.
 *
 * @param {string} message - Notification text
 * @param {'info'|'success'|'warn'|'error'} type - Notification type
 */
export function showToast(message, type = 'info') {
  showNotification(message, type, 3000);
}
