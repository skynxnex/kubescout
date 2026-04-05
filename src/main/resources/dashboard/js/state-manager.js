/**
 * State Manager Module
 * Handles dashboard state persistence with localStorage
 */

// State field configuration
const STATE_FIELDS = [
  { id: 'contextInput', key: 'context', type: 'value', default: '' },
  { id: 'namespaceInput', key: 'namespace', type: 'value', default: '' },
  { id: 'prefixInput', key: 'prefix', type: 'value', default: 'app-' },
  { id: 'searchInput', key: 'search', type: 'value', default: '' },
  { id: 'filterBad', key: 'filterBad', type: 'checked', default: false },
  { id: 'filterWarn', key: 'filterWarn', type: 'checked', default: false },
  { id: 'filterSingle', key: 'filterSingle', type: 'checked', default: false },
  { id: 'filterRestarts', key: 'filterRestarts', type: 'checked', default: false },
  { id: 'minRestartsInput', key: 'minRestarts', type: 'number', default: 1 },
  { id: 'sortField', key: 'sortField', type: 'value', default: 'service' },
  { id: 'sortDir', key: 'sortDir', type: 'value', default: 'asc' },
];

/**
 * Get value from DOM element based on field type
 */
function getElementValue(element, type, defaultValue) {
  if (!element) return defaultValue;

  switch (type) {
    case 'checked':
      return element.checked;
    case 'number':
      return parseInt(element.value || defaultValue, 10);
    case 'value':
    default:
      return element.value || defaultValue;
  }
}

/**
 * Set value to DOM element based on field type
 */
function setElementValue(element, value, type) {
  if (!element || value === undefined) return;

  switch (type) {
    case 'checked':
      element.checked = value;
      break;
    case 'number':
    case 'value':
    default:
      element.value = value;
      break;
  }
}

/**
 * Read current state from DOM
 */
export function readState() {
  const state = {};

  STATE_FIELDS.forEach(field => {
    const element = document.getElementById(field.id);
    state[field.key] = getElementValue(element, field.type, field.default);
  });

  return state;
}

/**
 * Write state to DOM
 */
export function writeState(state) {
  if (!state) return;

  STATE_FIELDS.forEach(field => {
    const element = document.getElementById(field.id);
    const value = state[field.key];
    setElementValue(element, value, field.type);
  });
}

/**
 * Reset state to defaults
 */
export function resetState() {
  STATE_FIELDS.forEach(field => {
    const element = document.getElementById(field.id);
    setElementValue(element, field.default, field.type);
  });
}

/**
 * Save state to localStorage
 */
export function saveState(storageKey) {
  try {
    const state = readState();
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('[StateManager] Failed to save state:', error);
    return false;
  }
}

/**
 * Load state from localStorage
 */
export function loadState(storageKey) {
  try {
    const savedData = localStorage.getItem(storageKey);
    if (!savedData) return null;

    const state = JSON.parse(savedData);
    writeState(state);
    return state;
  } catch (error) {
    console.error('[StateManager] Failed to load state:', error);
    return null;
  }
}

/**
 * Clear state from localStorage
 */
export function clearState(storageKey) {
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.error('[StateManager] Failed to clear state:', error);
    return false;
  }
}
