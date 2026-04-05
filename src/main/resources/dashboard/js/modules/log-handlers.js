/**
 * Log Handlers - Pod log viewer and service log streaming
 * Handles: showPodLogsModal, showServiceLogsModal, attachLogViewerHandlers, attachPodLogsHandlers
 */

import { renderPodLogsViewer } from './ui-components.js';
import { escapeHtml, showNotification } from './formatters.js';

// ==============================================
// API Endpoint Helper (local to this module)
// ==============================================

function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

// ==============================================
// Shared: copy to clipboard (local helper)
// ==============================================

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success', 3000);
    return true;
  } catch (error) {
    console.error('[Logs] Failed to copy to clipboard:', error);
    showNotification('Failed to copy to clipboard', 'error', 3000);
    return false;
  }
}

// ==============================================
// Log Line Highlighting
// ==============================================

/**
 * Minimal log-line highlighter mirroring ui-components.js highlightLogLine.
 */
function highlightLogLineInHandler(line) {
  const div = document.createElement('div');
  div.textContent = String(line ?? '');
  const escaped = div.innerHTML;
  return escaped
    .replace(/\b(ERROR|ERRO|ERR)\b/g, '<span class="log-error">$1</span>')
    .replace(/\b(WARN|WARNING)\b/g, '<span class="log-warn">$1</span>')
    .replace(/\b(INFO|INF)\b/g, '<span class="log-info">$1</span>')
    .replace(/\b(DEBUG|DBG)\b/g, '<span class="log-debug">$1</span>');
}

/**
 * Render log lines HTML from a logs data response.
 * Extracted so both initial render path and polling can reuse it.
 */
function renderLogLines(logsData) {
  const lines = Array.isArray(logsData.logs) ? logsData.logs : logsData.logs.split('\n');
  return lines.map((line, index) => {
    const highlighted = highlightLogLineInHandler(line);
    return `<div class="log-line"><span class="line-number">${index + 1}</span><span class="line-content">${highlighted}</span></div>`;
  }).join('');
}

/**
 * Append a plain status/info line to the log area (not a real log line from the pod).
 */
function appendStatusLine(logsContent, message, cssClass = '') {
  const div = document.createElement('div');
  div.className = `log-line${cssClass ? ` ${cssClass}` : ''}`;
  div.style.opacity = '0.6';
  div.style.fontStyle = 'italic';
  div.innerHTML = `<span class="line-content">${escapeHtml(message)}</span>`;
  logsContent.appendChild(div);
  logsContent.scrollTop = logsContent.scrollHeight;
}

// ==============================================
// Pod Logs: Fetch + Stream
// ==============================================

/**
 * Fetch log lines for a pod and return the parsed response data.
 * Shared by initial load and the polling interval.
 */
async function fetchPodLogsData(podName, namespace, context, containerName = '') {
  const params = new URLSearchParams();
  if (context) params.append('context', context);
  params.append('namespace', namespace);
  params.append('pod', podName);
  params.append('tailLines', '200');
  if (containerName) params.append('container', containerName);
  const response = await fetch(`${apiEndpoint('pod-logs')}?${params.toString()}`);
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  return response.json();
}

/**
 * Open a WebSocket to /pod-logs-stream-local and stream log lines into logsContent.
 * Returns the WebSocket instance so the caller can close it when needed.
 * lineCount is the 1-based index of the last line already rendered (from the initial snapshot).
 */
function openLogStream(podName, namespace, context, containerName, lineCount, logsContent, autoScrollCheckbox) {
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsParams = new URLSearchParams({ namespace, pod: podName, tailLines: 1 });
  if (context) wsParams.append('context', context);
  if (containerName) wsParams.append('container', containerName);

  const ws = new WebSocket(`${wsProto}//${location.host}/pod-logs-stream-local?${wsParams}`);
  let currentLine = lineCount;

  ws.onmessage = (event) => {
    const text = event.data;

    // Check for JSON control frames from the server
    try {
      const msg = JSON.parse(text);
      if (msg.error === 'auth') {
        appendStatusLine(logsContent, '[AWS authentication required — run "aws sso login" and reopen]', 'log-error');
        return;
      }
      if (msg.stream === 'ended') {
        appendStatusLine(logsContent, '[stream ended]', 'log-debug');
        return;
      }
      if (msg.error === 'general') {
        appendStatusLine(logsContent, `[stream error: ${msg.message ?? 'unknown'}]`, 'log-error');
        return;
      }
      // Only treat as control frame if it has known control keys
      if (!('error' in msg) && !('stream' in msg)) {
        // It's a JSON-formatted application log line — fall through to rendering
        throw new Error('not a control frame');
      }
    } catch (_) {
      // Not JSON — it's a plain log line, fall through
    }

    currentLine += 1;
    const highlighted = highlightLogLineInHandler(text);
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span class="line-number">${currentLine}</span><span class="line-content">${highlighted}</span>`;
    logsContent.appendChild(div);

    const MAX_LOG_LINES = 2000;
    while (logsContent.children.length > MAX_LOG_LINES) {
      logsContent.removeChild(logsContent.firstChild);
    }

    if (autoScrollCheckbox?.checked) {
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  };

  ws.onerror = () => {
    console.error('[Logs] WebSocket error for pod:', podName);
    appendStatusLine(logsContent, '[connection error]', 'log-error');
  };

  ws.onclose = (event) => {
    if (event.wasClean) {
      console.log('[Logs] WebSocket closed cleanly for pod:', podName);
    } else {
      console.warn('[Logs] WebSocket closed unexpectedly for pod:', podName);
    }
  };

  return ws;
}

// ==============================================
// Log Viewer Handlers
// ==============================================

/**
 * Attach log viewer handlers.
 * Uses ID selectors to match the IDs set in renderPodLogsViewer().
 * Returns the containerSelect element so the caller can read its value during polling.
 */
export function attachLogViewerHandlers(container, podName, namespace, context) {
  const containerSelect = container.querySelector('#container-select');
  const logsContent = container.querySelector('#logs-content');

  // Line numbers toggle
  const lineNumbersCheckbox = container.querySelector('#show-line-numbers');
  if (lineNumbersCheckbox && logsContent) {
    lineNumbersCheckbox.addEventListener('change', (e) => {
      logsContent.classList.toggle('hide-line-numbers', !e.target.checked);
    });
  }

  // Copy button
  const copyBtn = container.querySelector('#copy-logs-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = Array.from(logsContent?.querySelectorAll('.line-content') ?? [])
        .map(el => el.textContent)
        .join('\n');
      copyToClipboard(text);
    });
  }

  // Auto-scroll: when re-enabled, jump to bottom immediately
  const autoScrollCheckbox = container.querySelector('#auto-scroll');
  if (autoScrollCheckbox && logsContent) {
    autoScrollCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        logsContent.scrollTop = logsContent.scrollHeight;
      }
    });
  }

  return { containerSelect, logsContent, autoScrollCheckbox };
}

/**
 * Attach pod logs button handlers
 */
export function attachPodLogsHandlers(container, namespace, context) {
  const logsButtons = container.querySelectorAll('.pod-logs-btn');
  logsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const podName = btn.dataset.pod;
      showPodLogsModal(podName, namespace, context);
    });
  });
}

// ==============================================
// Pod Logs Modal
// ==============================================

/**
 * Show pod logs viewer modal with real-time WebSocket streaming.
 * Initial snapshot (last N lines) is fetched via HTTP, then a WebSocket
 * streams new lines appended in real time.
 */
export async function showPodLogsModal(podName, namespace, context) {
  console.log('[Logs] Opening logs viewer for pod:', podName);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-logs">
      <div class="modal-header">
        <h2>Pod Logs: ${escapeHtml(podName)}</h2>
        <button class="modal-close-btn" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="loading-state">
          <div class="cyber-spinner"></div>
          <span>Loading logs...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // activeWs holds the current WebSocket so closeModal and container-change can close it
  let activeWs = null;

  const closeModal = () => {
    if (activeWs) {
      activeWs.close();
      activeWs = null;
    }
    modal.remove();
    document.removeEventListener('keydown', escHandler);
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  try {
    // Initial snapshot: gives the user the last N lines immediately
    const data = await fetchPodLogsData(podName, namespace, context);
    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = renderPodLogsViewer(data, data.containers || []);

    const { containerSelect, logsContent, autoScrollCheckbox } = attachLogViewerHandlers(modalBody, podName, namespace, context);

    // Scroll to bottom after initial snapshot
    if (logsContent) {
      logsContent.scrollTop = logsContent.scrollHeight;
    }

    // Open the live stream starting from the line after the snapshot
    const initialLineCount = data.lineCount ?? 0;
    activeWs = openLogStream(podName, namespace, context, containerSelect?.value || '', initialLineCount, logsContent, autoScrollCheckbox);

    // Container selector: close current stream and restart with new container
    if (containerSelect) {
      containerSelect.addEventListener('change', async () => {
        // Close existing stream immediately
        if (activeWs) {
          activeWs.close();
          activeWs = null;
        }
        try {
          const freshData = await fetchPodLogsData(podName, namespace, context, containerSelect.value);
          if (logsContent) {
            logsContent.innerHTML = renderLogLines(freshData);
            if (autoScrollCheckbox?.checked) {
              logsContent.scrollTop = logsContent.scrollHeight;
            }
          }
          // Open new stream for the selected container
          const newLineCount = freshData.lineCount ?? 0;
          activeWs = openLogStream(podName, namespace, context, containerSelect.value, newLineCount, logsContent, autoScrollCheckbox);
        } catch (err) {
          console.error('[Logs] Failed to switch container:', err);
        }
      });
    }

  } catch (error) {
    console.error('[Logs] Failed to load logs:', error);
    const isAuthError = error.status === 401 || error.status === 403;
    modal.querySelector('.modal-body').innerHTML = isAuthError
      ? `<div class="loading-state">
           <span style="color: var(--color-danger);">AWS authentication required! Run "aws sso login" in terminal.</span>
           <br><br>
           <button class="modal-btn modal-btn-primary" onclick="location.reload()">Retry</button>
         </div>`
      : `<div class="loading-state">
           <span style="color: var(--color-danger);">Failed to load logs: ${error.message}</span>
         </div>`;
  }
}

// ==============================================
// Service Logs Modal (combined live stream)
// ==============================================

/**
 * Show combined live log stream for all pods of a service.
 * Opens a WebSocket to /service-logs-stream-local immediately (no HTTP snapshot).
 * Each message is prefixed with [pod-name] by the server.
 */
export async function showServiceLogsModal(serviceName, namespace, context) {
  console.log('[ServiceLogs] Opening combined logs for service:', serviceName);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-logs">
      <div class="modal-header">
        <h2>Service Logs: ${escapeHtml(serviceName)}</h2>
        <button class="modal-close-btn" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="logs-toolbar">
          <label class="logs-toolbar-label">
            <input type="checkbox" id="service-log-auto-scroll" checked>
            Auto-scroll
          </label>
          <button class="modal-btn modal-btn-secondary" id="service-log-copy-btn" style="margin-left: auto;">Copy logs</button>
        </div>
        <div class="logs-content" id="service-logs-content"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let activeWs = null;

  const closeModal = () => {
    if (activeWs) {
      activeWs.close();
      activeWs = null;
    }
    modal.remove();
    document.removeEventListener('keydown', escHandler);
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const logsContent = modal.querySelector('#service-logs-content');
  const autoScrollCheckbox = modal.querySelector('#service-log-auto-scroll');
  const copyBtn = modal.querySelector('#service-log-copy-btn');

  autoScrollCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  });

  copyBtn.addEventListener('click', () => {
    const text = Array.from(logsContent.querySelectorAll('.line-content'))
      .map(el => el.textContent)
      .join('\n');
    copyToClipboard(text);
  });

  // Show "Connecting..." status line before opening WebSocket
  appendStatusLine(logsContent, '[Connecting to live stream...]', 'log-debug');

  // Open WebSocket — server prefixes each line with [pod-name]
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsParams = new URLSearchParams({ service: serviceName, namespace, tailLines: 50 });
  if (context) wsParams.append('context', context);

  const ws = new WebSocket(`${wsProto}//${location.host}/service-logs-stream-local?${wsParams}`);
  activeWs = ws;

  let lineCount = 0;

  ws.onmessage = (event) => {
    const text = event.data;

    // Check for JSON control frames from the server
    try {
      const msg = JSON.parse(text);
      if (msg.error === 'auth') {
        appendStatusLine(logsContent, '[AWS authentication required — run "aws sso login" and reopen]', 'log-error');
        return;
      }
      if (msg.stream === 'ended') {
        appendStatusLine(logsContent, '[stream ended]', 'log-debug');
        return;
      }
      if (msg.error === 'general') {
        appendStatusLine(logsContent, `[stream error: ${msg.message ?? 'unknown'}]`, 'log-error');
        return;
      }
      // Only treat as control frame if it has known control keys
      if (!('error' in msg) && !('stream' in msg)) {
        throw new Error('not a control frame');
      }
    } catch (_) {
      // Not JSON — it's a plain log line, fall through
    }

    lineCount += 1;
    const highlighted = highlightLogLineInHandler(text);
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span class="line-number">${lineCount}</span><span class="line-content">${highlighted}</span>`;
    logsContent.appendChild(div);

    const MAX_LOG_LINES = 2000;
    while (logsContent.children.length > MAX_LOG_LINES) {
      logsContent.removeChild(logsContent.firstChild);
    }

    if (autoScrollCheckbox?.checked) {
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  };

  ws.onerror = () => {
    console.error('[ServiceLogs] WebSocket error for service:', serviceName);
    appendStatusLine(logsContent, '[connection error]', 'log-error');
  };

  ws.onclose = (event) => {
    if (!event.wasClean) {
      console.warn('[ServiceLogs] WebSocket closed unexpectedly for service:', serviceName);
    } else {
      console.log('[ServiceLogs] WebSocket closed cleanly for service:', serviceName);
    }
  };
}
