/**
 * Service diff utilities — pure functions with no DOM dependencies.
 * Extracted from modules/incremental-updates.js so Vue store and
 * vanilla JS can share the same change-detection logic.
 *
 * None of these functions mutate any external state.
 */

/**
 * Check whether two service snapshots differ on any tracked field.
 *
 * @param {Object} oldService
 * @param {Object} newService
 * @returns {boolean}
 */
export function hasServiceChanged(oldService, newService) {
  return (
    oldService.podCount              !== newService.podCount              ||
    oldService.readyCount            !== newService.readyCount            ||
    oldService.restartCount          !== newService.restartCount          ||
    oldService.deployedAtEpochSeconds !== newService.deployedAtEpochSeconds ||
    JSON.stringify(oldService.restartReasons) !== JSON.stringify(newService.restartReasons)
  );
}

/**
 * Return an array of field-level change descriptors between two service snapshots.
 * Only includes fields that actually changed.
 *
 * @param {Object} oldService
 * @param {Object} newService
 * @returns {Array<{ field: string, old: *, new: *, isTimestamp?: boolean }>}
 */
export function getFieldChanges(oldService, newService) {
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
    changes.push({
      field: 'deployed',
      old: oldService.deployedAtEpochSeconds,
      new: newService.deployedAtEpochSeconds,
      isTimestamp: true
    });
  }

  return changes;
}

/**
 * Detect additions, removals, and updates between two flat service arrays.
 * Does NOT mutate any external state — returns a plain result object.
 *
 * @param {Object[]} oldServices  — previous snapshot (array)
 * @param {Object[]} newServices  — latest snapshot from API (array)
 * @returns {{ added: Object[], removed: Object[], updated: Array<{ old: Object, new: Object, fieldChanges: Array }> }}
 */
export function detectChanges(oldServices, newServices) {
  const oldMap = new Map(oldServices.map(s => [s.serviceName, s]));
  const newMap = new Map(newServices.map(s => [s.serviceName, s]));

  const added   = [];
  const removed = [];
  const updated = [];

  // Services present in new but not old → added
  for (const [name, svc] of newMap) {
    if (!oldMap.has(name)) {
      added.push(svc);
    }
  }

  // Services present in old but not new → removed
  for (const [name, svc] of oldMap) {
    if (!newMap.has(name)) {
      removed.push(svc);
    }
  }

  // Services present in both → check for changes
  for (const [name, newSvc] of newMap) {
    if (oldMap.has(name)) {
      const oldSvc = oldMap.get(name);
      if (hasServiceChanged(oldSvc, newSvc)) {
        updated.push({
          old: oldSvc,
          new: newSvc,
          fieldChanges: getFieldChanges(oldSvc, newSvc)
        });
      }
    }
  }

  return { added, removed, updated };
}
