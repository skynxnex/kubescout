/**
 * Vue 3 Component: ServiceLogsViewer
 * Aggregated live log stream from all pods in a service.
 *
 * Props:
 *   serviceName {String} — Kubernetes service / deployment name
 *   namespace   {String} — Kubernetes namespace
 *   context     {String} — kubeconfig context
 *
 * Behaviour:
 *   - Opens a single WebSocket to /service-logs-stream-local immediately (no HTTP snapshot)
 *   - Server prefixes each line with [pod-name]
 *   - Enforces max 2000 lines; auto-scrolls unless user has scrolled up
 *   - Cleans up WebSocket in onUnmounted
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, ref, onMounted, onUnmounted, nextTick, h } = Vue;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeForHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

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

export const ServiceLogsViewer = defineComponent({
  name: 'ServiceLogsViewer',

  props: {
    serviceName: { type: String, required: true },
    namespace:   { type: String, default: '' },
    context:     { type: String, default: '' },
  },

  setup(props) {
    const lines       = ref([]);  // Array of { number, html }
    const autoScroll  = ref(true);
    const isConnected = ref(false);

    const logsContentEl = ref(null);

    let activeWs    = null;
    let lineCounter = 0;

    // -----------------------------------------------------------------------
    // Auto-scroll
    // -----------------------------------------------------------------------
    function scrollToBottom() {
      if (!logsContentEl.value) return;
      logsContentEl.value.scrollTop = logsContentEl.value.scrollHeight;
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
    // Append a status/info line (italic, dimmed)
    // -----------------------------------------------------------------------
    function appendStatus(message, cssClass) {
      lines.value.push({
        number: null,
        html:   `<span class="line-content ${cssClass}" style="opacity:0.6;font-style:italic;">${escapeForHtml(message)}</span>`,
      });
      trimLines();
      if (autoScroll.value) nextTick(scrollToBottom);
    }

    // -----------------------------------------------------------------------
    // Control-frame parser (mirrors log-handlers.js showServiceLogsModal)
    // -----------------------------------------------------------------------
    function handleControlFrame(text) {
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
          return false;
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    // -----------------------------------------------------------------------
    // Open WebSocket
    // -----------------------------------------------------------------------
    function openStream() {
      if (activeWs) {
        activeWs.close();
        activeWs = null;
      }

      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params  = new URLSearchParams({
        service:   props.serviceName,
        namespace: props.namespace,
        tailLines: 50,
      });
      if (props.context) params.append('context', props.context);

      appendStatus('[Connecting to live stream...]', 'log-debug');

      const ws = new WebSocket(`${wsProto}//${location.host}/service-logs-stream-local?${params}`);
      activeWs = ws;

      ws.onopen = () => {
        isConnected.value = true;
      };

      ws.onmessage = (event) => {
        const text = event.data;
        if (handleControlFrame(text)) return;

        lineCounter += 1;
        const highlighted = highlightLine(escapeForHtml(text));
        lines.value.push({ number: lineCounter, html: highlighted });
        trimLines();
        if (autoScroll.value) nextTick(scrollToBottom);
      };

      ws.onerror = () => {
        console.error('[ServiceLogsViewer] WebSocket error for service:', props.serviceName);
        appendStatus('[connection error]', 'log-error');
      };

      ws.onclose = (e) => {
        isConnected.value = false;
        if (!e.wasClean) {
          console.warn('[ServiceLogsViewer] WebSocket closed unexpectedly:', props.serviceName);
        }
      };
    }

    // -----------------------------------------------------------------------
    // Copy logs to clipboard
    // -----------------------------------------------------------------------
    function copyLogs() {
      const text = lines.value
        .map(l => {
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
      openStream();
    });

    onUnmounted(() => {
      if (activeWs) {
        activeWs.close();
        activeWs = null;
      }
    });

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return () => {
      // Toolbar
      const toolbar = h('div', {
        style: 'display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;flex-wrap:wrap;'
      }, [
        h('span', {
          style: `font-size:0.75rem;color:${isConnected.value ? 'var(--color-success, #10b981)' : 'var(--text-muted)'};`
        }, isConnected.value ? 'Live' : 'Connecting...'),
        h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;' }, [
          h('input', {
            type: 'checkbox',
            checked: autoScroll.value,
            onChange: (e) => {
              autoScroll.value = e.target.checked;
              if (autoScroll.value) scrollToBottom();
            },
          }),
          'Auto-scroll'
        ]),
        h('button', {
          class: 'modal-btn modal-btn-secondary',
          style: 'margin-left:auto;font-size:0.75rem;padding:4px 10px;',
          onClick: copyLogs,
        }, 'Copy logs'),
      ]);

      // Log lines
      const logItems = lines.value.map((line) =>
        h('div', { class: 'log-line' }, [
          line.number != null
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

export default ServiceLogsViewer;
