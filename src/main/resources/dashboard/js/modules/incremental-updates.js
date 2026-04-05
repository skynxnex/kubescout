/**
 * Modern Dashboard - Incremental Updates
 * Updates individual services instead of full page reload
 */

import { renderStatusBadge, renderRestartIndicators, renderSinglePodBadge } from './ui-components.js';
import { fmtAge } from './formatters.js';

// State for incremental updates
let incrementalUpdateTimer = null;
let countdownTimer = null;
let serviceUpdateQueue = [];
let isIncrementalUpdateRunning = false;
let currentServiceList = new Map(); // serviceName -> serviceData
let lastUpdateFailed = false; // Track if last update failed
let nextUpdateTime = null; // Timestamp for next update

const INCREMENTAL_UPDATE_INTERVAL_MS = 60000; // Check every 60s (1 minute)
const SERVICE_UPDATE_STAGGER_MS = 200; // Stagger each service update by 200ms
const HIGHLIGHT_DURATION_MS = 2000; // Highlight changes for 2s
const COUNTDOWN_UPDATE_INTERVAL_MS = 1000; // Update countdown every second

// Callback for auth errors (set by caller)
let onAuthErrorCallback = null;

/**
 * Start incremental updates (after initial load)
 */
export function startIncrementalUpdates(getServiceListFn, getCurrentFilters, onServiceListChange, onAuthError = null) {
  if (incrementalUpdateTimer) {
    stopIncrementalUpdates();
  }

  // Store auth error callback
  onAuthErrorCallback = onAuthError;

  // Set initial next update time
  nextUpdateTime = Date.now() + INCREMENTAL_UPDATE_INTERVAL_MS;

  // Start countdown timer
  startCountdownTimer();

  incrementalUpdateTimer = setInterval(() => {
    performIncrementalUpdate(getServiceListFn, getCurrentFilters, onServiceListChange);
  }, INCREMENTAL_UPDATE_INTERVAL_MS);
}

/**
 * Stop incremental updates
 */
export function stopIncrementalUpdates() {
  if (incrementalUpdateTimer) {
    clearInterval(incrementalUpdateTimer);
    incrementalUpdateTimer = null;
  }
  stopCountdownTimer();
  serviceUpdateQueue = [];
  isIncrementalUpdateRunning = false;
  lastUpdateFailed = false; // Reset error state
  nextUpdateTime = null;
  onAuthErrorCallback = null; // Clear callback
}

/**
 * Perform incremental update
 */
async function performIncrementalUpdate(getServiceListFn, getCurrentFilters, onServiceListChange) {
  if (isIncrementalUpdateRunning) return;

  console.log('[Incremental Update] Checking for changes...');
  isIncrementalUpdateRunning = true;

  // Show spinning animation on floating refresh button
  const floatingRefresh = document.getElementById('floatingRefresh');
  if (floatingRefresh) {
    floatingRefresh.classList.add('spinning');
  }

  try {
    // Fetch latest service list
    const newServices = await getServiceListFn();

    // Check if we recovered from a previous error
    const recoveredFromError = lastUpdateFailed;
    lastUpdateFailed = false; // Update succeeded

    // Detect changes (always, so currentServiceList stays up to date)
    const changes = detectChanges(newServices);

    if (recoveredFromError) {
      // Backend came back online - trigger full reload to restore UI
      console.log('[Incremental Update] Recovered from error, triggering full reload');
      if (onServiceListChange) {
        onServiceListChange({ added: [], removed: [], updated: [] });
      }
      return;
    }

    // Check if any updated services changed filter matching
    const filters = getCurrentFilters();
    const filterChanged = changes.updated.some(change => {
      const oldMatches = matchesFilters(change.old, filters);
      const newMatches = matchesFilters(change.new, filters);
      return oldMatches !== newMatches;
    });

    // Apply changes
    if (changes.added.length > 0 || changes.removed.length > 0) {
      // Service list changed - trigger automatic reload
      console.log('[Incremental Update] Service list changed:', {
        added: changes.added.length,
        removed: changes.removed.length
      });

      // Automatically reload the page to show new/removed services
      if (onServiceListChange) {
        onServiceListChange(changes);
      }
    } else if (filterChanged) {
      // A service changed status affecting filter visibility - trigger reload
      console.log('[Incremental Update] Service filter-matching changed, triggering reload');
      if (onServiceListChange) {
        onServiceListChange(changes);
      }
    } else if (changes.updated.length > 0) {
      // Update individual services (safe - no filter changes)
      console.log('[Incremental Update] Updating', changes.updated.length, 'services');
      updateIndividualServices(changes.updated, getCurrentFilters);
      // Update timestamps for all visible services (we just checked them)
      updateAllServiceTimestamps();
    } else {
      // No changes, but we still checked - update all timestamps
      console.log('[Incremental Update] No changes detected');
      updateAllServiceTimestamps();
    }

  } catch (err) {
    console.error('Incremental update failed:', err);

    // Check if this is an authentication error
    if (err.isAuthError) {
      console.error('[Incremental Update] Authentication error detected:', err.statusCode);

      // Stop incremental updates
      stopIncrementalUpdates();

      // Call auth error handler if provided
      if (onAuthErrorCallback) {
        onAuthErrorCallback(err);
      }

      return; // Don't continue after auth error
    }

    lastUpdateFailed = true; // Mark as failed for recovery detection
  } finally {
    isIncrementalUpdateRunning = false;

    // Remove spinning animation
    const floatingRefresh = document.getElementById('floatingRefresh');
    if (floatingRefresh) {
      floatingRefresh.classList.remove('spinning');
    }

    // Reset next update time and restart countdown
    nextUpdateTime = Date.now() + INCREMENTAL_UPDATE_INTERVAL_MS;
  }
}

/**
 * Detect changes between old and new service lists
 */
function detectChanges(newServices) {
  const newMap = new Map(newServices.map(s => [s.serviceName, s]));
  const oldNames = new Set(currentServiceList.keys());
  const newNames = new Set(newMap.keys());

  const added = [];
  const removed = [];
  const updated = [];

  // Find added services
  for (const name of newNames) {
    if (!oldNames.has(name)) {
      added.push(newMap.get(name));
    }
  }

  // Find removed services
  for (const name of oldNames) {
    if (!newNames.has(name)) {
      removed.push(currentServiceList.get(name));
    }
  }

  // Find updated services
  for (const name of newNames) {
    if (oldNames.has(name)) {
      const oldService = currentServiceList.get(name);
      const newService = newMap.get(name);

      if (hasServiceChanged(oldService, newService)) {
        updated.push({ old: oldService, new: newService });
      }
    }
  }

  // Update current list
  currentServiceList = newMap;

  return { added, removed, updated };
}

/**
 * Check if service has changed
 */
function hasServiceChanged(oldService, newService) {
  return (
    oldService.podCount !== newService.podCount ||
    oldService.readyCount !== newService.readyCount ||
    oldService.restartCount !== newService.restartCount ||
    oldService.deployedAtEpochSeconds !== newService.deployedAtEpochSeconds ||
    JSON.stringify(oldService.restartReasons) !== JSON.stringify(newService.restartReasons)
  );
}

/**
 * Update individual services with staggered animation
 */
function updateIndividualServices(updated, getCurrentFilters) {
  // Filter out services that don't match current filters
  const filters = getCurrentFilters();

  updated.forEach((change, index) => {
    setTimeout(() => {
      updateServiceRow(change.old, change.new, filters);
    }, index * SERVICE_UPDATE_STAGGER_MS);
  });
}

/**
 * Update timestamps for all visible service rows
 */
function updateAllServiceTimestamps() {
  const now = Date.now();
  document.querySelectorAll('tr[data-service-name]').forEach(row => {
    row.setAttribute('data-last-updated', now);
  });
  // Countdown will be updated by the countdown timer
}

/**
 * Update a single service row
 */
function updateServiceRow(oldService, newService, filters) {
  const serviceName = newService.serviceName;
  const rowSelector = `tr[data-service-name="${CSS.escape(serviceName)}"]`;
  const row = document.querySelector(rowSelector);

  if (!row) return;

  // Detect what changed
  const changes = [];
  if (oldService.podCount !== newService.podCount) {
    changes.push({ field: 'podCount', old: oldService.podCount, new: newService.podCount });
  }
  if (oldService.readyCount !== newService.readyCount) {
    changes.push({ field: 'readyCount', old: oldService.readyCount, new: newService.readyCount });
  }
  if (oldService.restartCount !== newService.restartCount) {
    changes.push({ field: 'restartCount', old: oldService.restartCount, new: newService.restartCount });
  }
  if (oldService.deployedAtEpochSeconds !== newService.deployedAtEpochSeconds) {
    changes.push({ field: 'deployed', old: oldService.deployedAtEpochSeconds, new: newService.deployedAtEpochSeconds, isTimestamp: true });
  }
  // Note: HPA changes would require formatting, so we'll skip those for now in incremental updates

  // Update cells with highlight animation
  changes.forEach(change => {
    const cell = row.querySelector(`[data-field="${change.field}"]`);
    if (cell) {
      // Update value based on field type
      if (change.field === 'restartCount') {
        cell.innerHTML = change.new + renderRestartIndicators(newService);
      } else if (change.isTimestamp) {
        // For deployed timestamp, format it
        const fmtDeploy = (item) => {
          if (!item.deployedAtEpochSeconds) return '';
          const date = new Date(item.deployedAtEpochSeconds * 1000);
          const now = new Date();
          const diffMs = now - date;
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (days > 0) return days + 'd';
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          if (hours > 0) return hours + 'h';
          const mins = Math.floor(diffMs / (1000 * 60));
          return mins + 'm';
        };
        cell.textContent = fmtDeploy(newService);
      } else {
        // For podCount: only update the count span to avoid overwriting scale controls
        const countSpan = cell.querySelector('.scale-current');
        if (countSpan) {
          countSpan.textContent = change.new;
        } else {
          cell.textContent = change.new;
        }
      }

      // Add highlight class (only for numeric changes)
      if (!change.isTimestamp) {
        const highlightClass = change.new > change.old ? 'cell-increased' : 'cell-decreased';
        cell.classList.add(highlightClass);

        // Remove highlight after duration
        setTimeout(() => {
          cell.classList.remove(highlightClass);
        }, HIGHLIGHT_DURATION_MS);
      }
    }
  });

  // Update status badge if status changed
  const oldStatus = getStatusForService(oldService);
  const newStatus = getStatusForService(newService);

  if (oldStatus.cls !== newStatus.cls || oldStatus.label !== newStatus.label) {
    const statusCell = row.querySelector('[data-field="status"]');
    if (statusCell) {
      // Re-render status badge with new layout including timestamp
      const secondsLeft = nextUpdateTime ? Math.max(0, Math.ceil((nextUpdateTime - Date.now()) / 1000)) : 60;
      statusCell.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div>${renderStatusBadge(newStatus)} ${renderSinglePodBadge(newService)}</div>
          <div class="service-update-time" style="font-size: 11px; color: var(--text-tertiary);">updates in ${secondsLeft}s</div>
        </div>
      `;

      // Add pulse animation
      statusCell.classList.add('status-changed');
      setTimeout(() => {
        statusCell.classList.remove('status-changed');
      }, HIGHLIGHT_DURATION_MS);
    }
  }

  // Update row class if status class changed
  if (oldStatus.cls !== newStatus.cls) {
    if (oldStatus.cls) row.classList.remove(oldStatus.cls);
    if (newStatus.cls) row.classList.add(newStatus.cls);
  }

  // Update last updated timestamp
  row.setAttribute('data-last-updated', Date.now());
  // Countdown will be updated by the countdown timer
}


/**
 * Initialize current service list (call after first load)
 */
export function initializeServiceList(services) {
  currentServiceList = new Map(services.map(s => [s.serviceName, s]));
}

/**
 * Get status for service (needs to match main logic)
 */
function getStatusForService(item) {
  const readyCount = Number(item.readyCount ?? 0);
  const podCount = Number(item.podCount ?? 0);
  const restartCount = Number(item.restartCount ?? 0);
  const restartReasons = item.restartReasons || {};
  const keys = Object.keys(restartReasons).map(k => String(k).toLowerCase());

  const hasOOMOrError = keys.includes('oomkilled') || keys.includes('error');
  const hasCompleted = keys.includes('completed');
  const RESTART_RED_THRESHOLD = window.RESTART_RED_THRESHOLD || 3;
  const isBad = (readyCount < podCount && restartCount > 0) || hasOOMOrError;
  const isWarn = !isBad && (hasCompleted || restartCount >= RESTART_RED_THRESHOLD);

  if (isBad) return { cls: 'row-bad', pill: 'status-bad', label: 'Bad' };
  if (isWarn) return { cls: 'row-warn', pill: 'status-warn', label: 'Warning' };
  return { cls: '', pill: 'status-ok', label: 'Healthy' };
}

/**
 * Check if a service matches current filters
 */
function matchesFilters(service, filters) {
  const status = getStatusForService(service);

  // If no filters are active, all services match
  const hasActiveFilters = filters.showBad || filters.showWarn || filters.showSingle || filters.showRestarts;
  if (!hasActiveFilters) {
    return true;
  }

  // Check if service matches any active filter
  let matches = false;
  if (filters.showBad && status.cls === 'row-bad') matches = true;
  if (filters.showWarn && status.cls === 'row-warn') matches = true;
  if (filters.showSingle && service.podCount === 1) matches = true;
  if (filters.showRestarts && service.restartCount >= (filters.minRestarts || 1)) matches = true;

  return matches;
}

/**
 * Start countdown timer to update timestamps
 */
function startCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  countdownTimer = setInterval(() => {
    updateCountdownDisplay();
  }, COUNTDOWN_UPDATE_INTERVAL_MS);
}

/**
 * Stop countdown timer
 */
function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

/**
 * Update countdown display on all service rows
 */
function updateCountdownDisplay() {
  if (!nextUpdateTime) return;

  const now = Date.now();
  const secondsLeft = Math.max(0, Math.ceil((nextUpdateTime - now) / 1000));

  document.querySelectorAll('.service-update-time').forEach(timeEl => {
    if (secondsLeft > 0) {
      timeEl.textContent = `updates in ${secondsLeft}s`;
    } else {
      timeEl.textContent = 'updating...';
    }
  });

  // Keep pod age text live so it doesn't go stale during long sessions or after server restarts
  document.querySelectorAll('.pod-age-value[data-created-epoch]').forEach(el => {
    const epoch = parseInt(el.getAttribute('data-created-epoch'), 10);
    if (!isNaN(epoch)) {
      el.textContent = fmtAge(new Date(epoch));
    }
  });
}
