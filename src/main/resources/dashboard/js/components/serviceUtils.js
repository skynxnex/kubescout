/**
 * Shared utilities for Vue service components.
 * Extracted from StatusBadge.js and ServiceRow.js to avoid duplication.
 * Fas 8: getPodStatus() consolidated here from ProblematicPodCard.js and ProblematicPodsView.js.
 */

/**
 * Derive status object from a service data object.
 * Mirrors statusFor() in main.js — must be kept in sync with that function.
 *
 * @param {Object} service
 * @param {number} restartRedThreshold
 * @returns {{ cls: string, pill: string, label: string }}
 */
export function statusFor(service, restartRedThreshold) {
  const readyCount = Number(service.readyCount ?? 0);
  const podCount = Number(service.podCount ?? 0);
  const restartCount = Number(service.restartCount ?? 0);
  const restartReasons = service.restartReasons || {};
  const keys = Object.keys(restartReasons).map(k => String(k).toLowerCase());

  const hasOOMOrError = keys.includes('oomkilled') || keys.includes('error');
  const hasCompleted = keys.includes('completed');
  const isBad = (readyCount < podCount && restartCount > 0) || hasOOMOrError;
  const isWarn = !isBad && (hasCompleted || restartCount >= restartRedThreshold);

  if (isBad) return { cls: 'row-bad', pill: 'status-bad', label: 'Bad' };
  if (isWarn) return { cls: 'row-warn', pill: 'status-warn', label: 'Warning' };
  return { cls: '', pill: 'status-ok', label: 'Healthy' };
}

/**
 * Determine pod status string: 'bad', 'warn', or 'ok'.
 * Consolidated from ProblematicPodCard.js and ProblematicPodsView.js (Fas 8).
 *
 * @param {Object} pod - Pod data object from /problematic-pods-local
 * @returns {'bad'|'warn'|'ok'}
 */
export function getPodStatus(pod) {
  const phase = (pod.status || '').toLowerCase();
  const restarts = pod.restarts || 0;
  const restartReasons = pod.restartReasons || {};
  const restartReasonKeys = Object.keys(restartReasons).map(k => k.toLowerCase());
  const ready = pod.ready || '0/0';

  const parts = ready.split('/');
  const isReady = parts.length === 2
    ? (parseInt(parts[0]) || 0) === (parseInt(parts[1]) || 0) && (parseInt(parts[1]) || 0) > 0
    : false;

  const isBad = phase === 'failed' ||
                restartReasonKeys.includes('oomkilled') ||
                restartReasonKeys.includes('error') ||
                (restarts > 0 && !isReady);

  const threshold = (typeof window.RESTART_RED_THRESHOLD === 'number') ? window.RESTART_RED_THRESHOLD : 3;
  const isWarning = !isBad && (
    restarts >= threshold ||
    restartReasonKeys.includes('completed')
  );

  if (isBad) return 'bad';
  if (isWarning) return 'warn';
  return 'ok';
}
