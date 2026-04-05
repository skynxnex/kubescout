/**
 * Unit Tests for State Manager
 * Run with: npm test or via browser test runner
 */

import {
  readState,
  writeState,
  resetState,
  saveState,
  loadState,
  clearState
} from './state-manager.js';

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// Test suite
describe('StateManager', () => {
  let localStorageMock;

  beforeEach(() => {
    // Setup localStorage mock
    localStorageMock = new LocalStorageMock();
    global.localStorage = localStorageMock;

    // Setup DOM mock
    document.body.innerHTML = `
      <input type="text" id="contextInput" value="" />
      <input type="text" id="namespaceInput" value="" />
      <input type="text" id="prefixInput" value="app-" />
      <input type="text" id="searchInput" value="" />
      <input type="checkbox" id="filterBad" />
      <input type="checkbox" id="filterWarn" />
      <input type="checkbox" id="filterSingle" />
      <input type="checkbox" id="filterRestarts" />
      <input type="number" id="minRestartsInput" value="1" />
      <select id="sortField">
        <option value="service" selected>Service</option>
        <option value="pods">Pods</option>
      </select>
      <select id="sortDir">
        <option value="asc" selected>Ascending</option>
        <option value="desc">Descending</option>
      </select>
    `;
  });

  afterEach(() => {
    localStorageMock.clear();
    document.body.innerHTML = '';
  });

  describe('readState()', () => {
    it('should read default state from DOM', () => {
      const state = readState();

      expect(state).toEqual({
        context: '',
        namespace: '',
        prefix: 'app-',
        search: '',
        filterBad: false,
        filterWarn: false,
        filterSingle: false,
        filterRestarts: false,
        minRestarts: 1,
        sortField: 'service',
        sortDir: 'asc'
      });
    });

    it('should read modified state from DOM', () => {
      document.getElementById('contextInput').value = 'test-context';
      document.getElementById('filterBad').checked = true;
      document.getElementById('minRestartsInput').value = '5';

      const state = readState();

      expect(state.context).toBe('test-context');
      expect(state.filterBad).toBe(true);
      expect(state.minRestarts).toBe(5);
    });
  });

  describe('writeState()', () => {
    it('should write state to DOM', () => {
      const state = {
        context: 'prod-context',
        namespace: 'production',
        prefix: 'web-',
        search: 'api',
        filterBad: true,
        filterWarn: false,
        filterSingle: true,
        filterRestarts: false,
        minRestarts: 3,
        sortField: 'pods',
        sortDir: 'desc'
      };

      writeState(state);

      expect(document.getElementById('contextInput').value).toBe('prod-context');
      expect(document.getElementById('namespaceInput').value).toBe('production');
      expect(document.getElementById('prefixInput').value).toBe('web-');
      expect(document.getElementById('searchInput').value).toBe('api');
      expect(document.getElementById('filterBad').checked).toBe(true);
      expect(document.getElementById('filterWarn').checked).toBe(false);
      expect(document.getElementById('filterSingle').checked).toBe(true);
      expect(document.getElementById('minRestartsInput').value).toBe('3');
      expect(document.getElementById('sortField').value).toBe('pods');
      expect(document.getElementById('sortDir').value).toBe('desc');
    });

    it('should handle null state gracefully', () => {
      writeState(null);
      // Should not throw error
      expect(document.getElementById('contextInput').value).toBe('');
    });
  });

  describe('resetState()', () => {
    it('should reset all fields to defaults', () => {
      // Set some values first
      document.getElementById('contextInput').value = 'test';
      document.getElementById('filterBad').checked = true;
      document.getElementById('prefixInput').value = 'custom-';

      resetState();

      expect(document.getElementById('contextInput').value).toBe('');
      expect(document.getElementById('namespaceInput').value).toBe('');
      expect(document.getElementById('prefixInput').value).toBe('app-');
      expect(document.getElementById('searchInput').value).toBe('');
      expect(document.getElementById('filterBad').checked).toBe(false);
      expect(document.getElementById('minRestartsInput').value).toBe('1');
      expect(document.getElementById('sortField').value).toBe('service');
      expect(document.getElementById('sortDir').value).toBe('asc');
    });
  });

  describe('saveState()', () => {
    it('should save state to localStorage', () => {
      document.getElementById('contextInput').value = 'dev-context';
      document.getElementById('filterBad').checked = true;

      const result = saveState('test-key');

      expect(result).toBe(true);
      const saved = JSON.parse(localStorageMock.getItem('test-key'));
      expect(saved.context).toBe('dev-context');
      expect(saved.filterBad).toBe(true);
    });

    it('should return false on localStorage error', () => {
      // Mock localStorage.setItem to throw error
      localStorageMock.setItem = () => {
        throw new Error('Storage full');
      };

      const result = saveState('test-key');

      expect(result).toBe(false);
    });
  });

  describe('loadState()', () => {
    it('should load state from localStorage', () => {
      const savedState = {
        context: 'loaded-context',
        namespace: 'loaded-ns',
        prefix: 'loaded-',
        filterBad: true,
        minRestarts: 7
      };

      localStorageMock.setItem('test-key', JSON.stringify(savedState));

      const result = loadState('test-key');

      expect(result).toEqual(expect.objectContaining({
        context: 'loaded-context',
        namespace: 'loaded-ns',
        prefix: 'loaded-',
        filterBad: true,
        minRestarts: 7
      }));

      expect(document.getElementById('contextInput').value).toBe('loaded-context');
      expect(document.getElementById('filterBad').checked).toBe(true);
    });

    it('should return null if no saved state exists', () => {
      const result = loadState('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null on parse error', () => {
      localStorageMock.setItem('test-key', 'invalid-json{');

      const result = loadState('test-key');

      expect(result).toBeNull();
    });
  });

  describe('clearState()', () => {
    it('should remove state from localStorage', () => {
      localStorageMock.setItem('test-key', '{"test":"data"}');

      const result = clearState('test-key');

      expect(result).toBe(true);
      expect(localStorageMock.getItem('test-key')).toBeNull();
    });

    it('should return false on error', () => {
      localStorageMock.removeItem = () => {
        throw new Error('Remove failed');
      };

      const result = clearState('test-key');

      expect(result).toBe(false);
    });
  });

  describe('Integration: save and load cycle', () => {
    it('should persist and restore complete state', () => {
      // Set initial state
      document.getElementById('contextInput').value = 'integration-test';
      document.getElementById('namespaceInput').value = 'test-ns';
      document.getElementById('prefixInput').value = 'test-';
      document.getElementById('searchInput').value = 'api-test';
      document.getElementById('filterBad').checked = true;
      document.getElementById('filterWarn').checked = true;
      document.getElementById('minRestartsInput').value = '10';
      document.getElementById('sortField').value = 'pods';
      document.getElementById('sortDir').value = 'desc';

      // Save state
      saveState('integration-key');

      // Reset to defaults
      resetState();

      // Verify reset worked
      expect(document.getElementById('contextInput').value).toBe('');
      expect(document.getElementById('filterBad').checked).toBe(false);

      // Load state
      loadState('integration-key');

      // Verify state was restored
      expect(document.getElementById('contextInput').value).toBe('integration-test');
      expect(document.getElementById('namespaceInput').value).toBe('test-ns');
      expect(document.getElementById('prefixInput').value).toBe('test-');
      expect(document.getElementById('searchInput').value).toBe('api-test');
      expect(document.getElementById('filterBad').checked).toBe(true);
      expect(document.getElementById('filterWarn').checked).toBe(true);
      expect(document.getElementById('minRestartsInput').value).toBe('10');
      expect(document.getElementById('sortField').value).toBe('pods');
      expect(document.getElementById('sortDir').value).toBe('desc');
    });
  });
});
