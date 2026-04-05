/**
 * Vue 3 Component: PodLogsViewer
 * Pod log viewer with WebSocket streaming.
 *
 * Props:
 *   podName    {String} — pod name
 *   namespace  {String} — Kubernetes namespace
 *   context    {String} — kubeconfig context
 *   containers {Array}  — list of container names in the pod
 *
 * Behaviour:
 *   1. Fetches an initial snapshot via REST (/pod-logs-local?tailLines=200)
 *   2. Opens a WebSocket stream (/pod-logs-stream-local) for live tail
 *   3. Enforces max 2000 lines; auto-scrolls unless user has scrolled up
 *   4. Container selector restarts snapshot + stream for the selected container
 *   5. Cleans up WebSocket in onUnmounted
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, ref, computed, onMounted, onUnmounted, nextTick, h } = Vue;

// ---------------------------------------------------------------------------
// Helpers (local — mirrors log-handlers.js without DOM coupling)
// ---------------------------------------------------------------------------

function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

/** Escape a string for safe insertion into innerHTML. */
function escapeForHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

/** Apply log-level highlight spans to an already-escaped line. */
function highlightLine(escapedLine) {
  return escapedLine
    .replace(/\b(ERROR|ERRO|ERR)\b/g, '<span class="log-error">$1</span>')
    .replace(/\b(WARN|WARNING)\b/g,   '<span class="log-warn">$1</span>')
    .replace(/\b(INFO|INF)\b/g,       '<span class="log-info">$1</span>')
    .replace(/\b(DEBUG|DBG)\b/g,      '<span class="log-debug">$1</span>');
}

const MAX_LOG_LINES = 2000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PodLogsViewer = defineComponent({
  name: 'PodLogsViewer',

  props: {
    podName:    { type: String, required: true },
    namespace:  { type: String, default: '' },
    context:    { type: String, default: '' },
    containers: { type: Array,  default: () => [] },
  },

  setup(props) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    const selectedContainer = ref(props.containers[0] || '');
    const lines             = ref([]);   // Array of { number, html }
    const isLoading         = ref(true);
    const errorMsg          = ref('');
    const autoScroll        = ref(true);
    const showLineNumbers   = ref(true);

    // DOM refs
    const logsContentEl = ref(null);

    // Active WebSocket (closed on container change / unmount)
    let activeWs = null;

    // -----------------------------------------------------------------------
    // Auto-scroll helper
    // -----------------------------------------------------------------------
    function scrollToBottom() {
      if (!logsContentEl.value) return;
      logsContentEl.value.scrollTop = logsContentEl.value.scrollHeight;
    }

    // -----------------------------------------------------------------------
    // Control-frame parser (mirrors log-handlers.js openLogStream)
    // Returns true if the message was a control frame and should not be
    // rendered as a log line.
    // -----------------------------------------------------------------------
    function handleControlFrame(text, appendStatus) {
      try {
        const msg = JSON.parse(text);
        if (msg.error === 'auth') {
          appendStatus('[AWS authentication required — run "aws sso login" and reopen]', 'log-error');
          return true;
        }
        if (msg.stream === 'ended') {
          appendStatus('[stream ended]', 'log-debug');
          return true;
        }
        if (msg.error === 'general') {
          appendStatus(`[stream error: ${msg.message ?? 'unknown'}]`, 'log-error');
          return true;
        }
        if (!('error' in msg) && !('stream' in msg)) {
          return false; // JSON application log line — render normally
        }
        return true;
      } catch (_) {
        return false; // Plain text log line
      }
    }

    // -----------------------------------------------------------------------
    // Append a status/info line (italic, dimmed) to lines[]
    // -----------------------------------------------------------------------
    function appendStatus(message, cssClass) {
      lines.value.push({
        number: null, // status lines get no line number
        html:   `<span class="line-content ${cssClass}" style="opacity:0.6;font-style:italic;">${escapeForHtml(message)}</span>`,
      });
      trimLines();
      if (autoScroll.value) nextTick(scrollToBottom);
    }

    // -----------------------------------------------------------------------
    // Trim to MAX_LOG_LINES
    // -----------------------------------------------------------------------
    function trimLines() {
      if (lines.value.length > MAX_LOG_LINES) {
        lines.value.splice(0, lines.value.length - MAX_LOG_LINES);
      }
    }

    // -----------------------------------------------------------------------
    // Open WebSocket stream
    // -----------------------------------------------------------------------
    function openStream(containerName, startLineNumber) {
      closeStream();

      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params  = new URLSearchParams({
        namespace: props.namespace,
        pod:       props.podName,
        tailLines: 1,
      });
      if (props.context)  params.append('context',   props.context);
      if (containerName)  params.append('container', containerName);

      const ws = new WebSocket(`${wsProto}//${location.host}/pod-logs-stream-local?${params}`);
      activeWs = ws;

      let lineCounter = startLineNumber;

      ws.onmessage = (event) => {
        const text = event.data;
        if (handleControlFrame(text, appendStatus)) return;

        lineCounter += 1;
        const highlighted = highlightLine(escapeForHtml(text));
        lines.value.push({ number: lineCounter, html: highlighted });
        trimLines();
        if (autoScroll.value) nextTick(scrollToBottom);
      };

      ws.onerror = () => {
        console.error('[PodLogsViewer] WebSocket error for pod:', props.podName);
        appendStatus('[connection error]', 'log-error');
      };

      ws.onclose = (e) => {
        if (!e.wasClean) {
          console.warn('[PodLogsViewer] WebSocket closed unexpectedly for pod:', props.podName);
        }
      };
    }

    function closeStream() {
      if (activeWs) {
        activeWs.close();
        activeWs = null;
      }
    }

    // -----------------------------------------------------------------------
    // Fetch snapshot + start stream for a given container
    // -----------------------------------------------------------------------
    async function loadContainer(containerName) {
      closeStream();
      isLoading.value = true;
      errorMsg.value  = '';
      lines.value     = [];

      try {
        const params = new URLSearchParams({
          namespace: props.namespace,
          pod:       props.podName,
          tailLines: '200',
        });
        if (props.context)  params.append('context',   props.context);
        if (containerName)  params.append('container', containerName);

        const resp = await fetch(`${apiEndpoint('pod-logs')}?${params}`);
        if (!resp.ok) {
          const isAuth = resp.status === 401 || resp.status === 403;
          errorMsg.value = isAuth
            ? 'AWS authentication required. Run "aws sso login" in terminal, then retry.'
            : `Failed to load logs: HTTP ${resp.status}`;
          isLoading.value = false;
          return;
        }

        const data = await resp.json();
        const rawLines = Array.isArray(data.logs) ? data.logs : String(data.logs ?? '').split('\n');

        lines.value = rawLines.map((line, idx) => ({
          number: idx + 1,
          html:   highlightLine(escapeForHtml(line)),
        }));

        isLoading.value = false;
        await nextTick();
        scrollToBottom();

        const startLineNumber = data.lineCount ?? rawLines.length;
        openStream(containerName, startLineNumber);

      } catch (err) {
        console.error('[PodLogsViewer] Failed to load logs:', err);
        errorMsg.value  = `Failed to load logs: ${err.message}`;
        isLoading.value = false;
      }
    }

    // -----------------------------------------------------------------------
    // Container change handler
    // -----------------------------------------------------------------------
    function onContainerChange(e) {
      selectedContainer.value = e.target.value;
      loadContainer(selectedContainer.value);
    }

    // -----------------------------------------------------------------------
    // Auto-scroll: re-enable → jump to bottom immediately
    // -----------------------------------------------------------------------
    function onAutoScrollChange(e) {
      autoScroll.value = e.target.checked;
      if (autoScroll.value) scrollToBottom();
    }

    // -----------------------------------------------------------------------
    // Copy logs to clipboard
    // -----------------------------------------------------------------------
    function copyLogs() {
      const text = lines.value
        .map(l => {
          // Strip HTML tags to get plain text
          const div = document.createElement('div');
          div.innerHTML = l.html;
          return div.textContent;
        })
        .join('\n');
      navigator.clipboard.writeText(text).catch(() => {});
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------
    onMounted(() => {
      loadContainer(selectedContainer.value);
    });

    onUnmounted(() => {
      closeStream();
    });

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return () => {
      // Error state
      if (errorMsg.value) {
        return h('div', { class: 'loading-state' },
          h('span', { style: 'color: var(--color-danger);' }, errorMsg.value)
        );
      }

      // Loading state
      if (isLoading.value) {
        return h('div', { class: 'loading-state' }, [
          h('div', { class: 'cyber-spinner' }),
          h('span', {}, 'Loading logs...')
        ]);
      }

      // ---- Toolbar --------------------------------------------------------
      const containerSelector = props.containers.length > 1
        ? h('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
            h('label', { for: 'pvl-container-select', style: 'font-size:0.8rem;color:var(--text-secondary);' }, 'Container:'),
            h('select', {
              id: 'pvl-container-select',
              class: 'cyber-select',
              style: 'font-size:0.8rem;padding:4px 8px;',
              value: selectedContainer.value,
              onChange: onContainerChange,
            },
              props.containers.map(c =>
                h('option', { value: c, selected: c === selectedContainer.value }, c)
              )
            )
          ])
        : null;

      const toolbar = h('div', {
        class: 'logs-toolbar',
        style: 'display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;flex-wrap:wrap;'
      }, [
        containerSelector,
        h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;' }, [
          h('input', {
            type: 'checkbox',
            checked: showLineNumbers.value,
            onChange: (e) => { showLineNumbers.value = e.target.checked; },
          }),
          'Line numbers'
        ]),
        h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;' }, [
          h('input', {
            type: 'checkbox',
            checked: autoScroll.value,
            onChange: onAutoScrollChange,
          }),
          'Auto-scroll'
        ]),
        h('button', {
          class: 'modal-btn modal-btn-secondary',
          style: 'margin-left:auto;font-size:0.75rem;padding:4px 10px;',
          onClick: copyLogs,
        }, 'Copy logs'),
      ].filter(Boolean));

      // ---- Log content ----------------------------------------------------
      const logItems = lines.value.map((line) =>
        h('div', { class: 'log-line' }, [
          showLineNumbers.value && line.number != null
            ? h('span', { class: 'line-number' }, String(line.number))
            : null,
          h('span', {
            class: 'line-content',
            innerHTML: line.html, // SAFE: escaped then highlight-tagged
          }),
        ].filter(Boolean))
      );

      const content = h('div', {
        class: 'logs-content',
        ref: logsContentEl,
        style: 'flex:1;min-height:0;overflow-y:auto;',
        onScroll: () => {
          // If user scrolls away from bottom, disable auto-scroll
          const el = logsContentEl.value;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          if (!atBottom) autoScroll.value = false;
        }
      }, logItems);

      return h('div', {
        class: 'logs-viewer',
        style: 'display:flex;flex-direction:column;height:100%;min-height:0;'
      }, [toolbar, content]);
    };
  }
});

export default PodLogsViewer;
