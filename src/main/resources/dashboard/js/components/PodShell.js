/**
 * Vue 3 Component: PodShell
 * Interactive pod terminal powered by xterm.js.
 *
 * Props:
 *   podName    {String} — pod name
 *   namespace  {String} — Kubernetes namespace
 *   context    {String} — kubeconfig context
 *   containers {Array}  — list of container names (fetched by parent)
 *
 * Behaviour:
 *   - Terminal is initialised in onMounted (xterm requires a visible DOM node)
 *   - FitAddon.fit() is called after nextTick to ensure the element is sized
 *   - ResizeObserver keeps the terminal fitted when the modal resizes
 *   - Container selector closes the current terminal and opens a new one
 *   - Full cleanup in onUnmounted: ws.close(), resizeObserver.disconnect(), term.dispose()
 *
 * xterm globals (loaded via CDN in index.html before this module):
 *   window.Terminal   — xterm.js Terminal class
 *   window.FitAddon   — xterm-addon-fit  (accessed as FitAddon.FitAddon)
 *   window.AttachAddon — xterm-addon-attach (accessed as AttachAddon.AttachAddon)
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, ref, onMounted, onUnmounted, nextTick, h } = Vue;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PodShell = defineComponent({
  name: 'PodShell',

  props: {
    podName:    { type: String, required: true },
    namespace:  { type: String, default: '' },
    context:    { type: String, default: '' },
    containers: { type: Array,  default: () => [] },
  },

  setup(props) {
    const selectedContainer = ref(props.containers[0] || '');
    const mountEl           = ref(null);
    const statusMsg         = ref('Connecting...');

    let term            = null;
    let ws              = null;
    let fitAddon        = null;
    let attachAddon     = null;
    let resizeObserver  = null;
    let cleaned         = false;

    // -----------------------------------------------------------------------
    // Teardown — idempotent, safe to call multiple times
    // -----------------------------------------------------------------------
    function teardown() {
      if (cleaned) return;
      cleaned = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (ws) {
        ws.close();
        ws = null;
      }
      if (term) {
        term.dispose();
        term = null;
      }
      fitAddon    = null;
      attachAddon = null;
    }

    // -----------------------------------------------------------------------
    // Open terminal for a given container
    // -----------------------------------------------------------------------
    async function openTerminal(containerName) {
      // Dispose any previous terminal instance
      if (term) { term.dispose(); term = null; }
      if (ws)   { ws.close();    ws   = null; }
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      cleaned = false;

      // Wait for DOM to be visible (critical: xterm measures the element)
      await nextTick();

      if (!mountEl.value) {
        console.error('[PodShell] Mount element not found');
        return;
      }

      // Clear previous content
      mountEl.value.innerHTML = '';

      // Init xterm from CDN globals
      const TerminalClass = (typeof Terminal !== 'undefined') ? Terminal : null;
      const FitAddonClass = (typeof FitAddon !== 'undefined') ? FitAddon.FitAddon : null;
      const AttachAddonClass = (typeof AttachAddon !== 'undefined') ? AttachAddon.AttachAddon : null;

      if (!TerminalClass || !FitAddonClass) {
        statusMsg.value = 'xterm.js not loaded. Check network / CDN.';
        console.error('[PodShell] xterm.js globals not available');
        return;
      }

      term = new TerminalClass({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'Courier New', Courier, monospace",
        theme: { background: '#000000' },
        scrollback: 1000,
      });

      fitAddon = new FitAddonClass();
      term.loadAddon(fitAddon);
      term.open(mountEl.value);

      // fit() after next paint so the element has computed dimensions
      await nextTick();
      try { fitAddon.fit(); } catch (_) {}

      // Resolve namespace and context based on mode (mirrors shell-handlers.js)
      const namespace = window.IS_LOCAL_MODE ? props.namespace : (window.IN_CLUSTER_NAMESPACE || '');
      const context   = window.IS_LOCAL_MODE ? props.context   : '';

      // Build WebSocket
      const wsProto  = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsParams = new URLSearchParams({ namespace, pod: props.podName, container: containerName || '' });
      if (context) wsParams.append('context', context);

      ws = new WebSocket(`${wsProto}//${location.host}${apiEndpoint('pod-shell')}?${wsParams}`);
      ws.binaryType = 'arraybuffer';

      if (AttachAddonClass) {
        attachAddon = new AttachAddonClass(ws);
        term.loadAddon(attachAddon);
      }

      ws.addEventListener('open', () => {
        statusMsg.value = '';
        console.log('[PodShell] WebSocket opened for pod:', props.podName);
        term.focus();
      });

      ws.addEventListener('close', (e) => {
        console.log('[PodShell] WebSocket closed for pod:', props.podName, 'code:', e.code, 'wasClean:', e.wasClean);
        try { term.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m'); } catch (_) {}
      });

      ws.addEventListener('error', (e) => {
        console.error('[PodShell] WebSocket error for pod:', props.podName, e);
        try { term.writeln('\r\n\x1b[31m[WebSocket error — check pod name and namespace]\x1b[0m'); } catch (_) {}
      });

      // ResizeObserver keeps terminal fitted when the modal is resized
      resizeObserver = new ResizeObserver(() => {
        try { if (fitAddon) fitAddon.fit(); } catch (_) {}
      });
      resizeObserver.observe(mountEl.value);
    }

    // -----------------------------------------------------------------------
    // Container selector change
    // -----------------------------------------------------------------------
    function onContainerChange(e) {
      selectedContainer.value = e.target.value;
      openTerminal(selectedContainer.value);
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------
    onMounted(() => {
      openTerminal(selectedContainer.value);
    });

    onUnmounted(() => {
      teardown();
    });

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return () => {
      // Container selector (shown only when > 1 container)
      const containerSelector = props.containers.length > 1
        ? h('div', { style: 'padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:8px;flex-shrink:0;' }, [
            h('label', { for: 'psh-container-select', style: 'font-size:0.8rem;color:var(--text-secondary);' }, 'Container:'),
            h('select', {
              id: 'psh-container-select',
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

      // Status overlay (shown during connect before WS opens)
      const statusOverlay = statusMsg.value
        ? h('div', {
            style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-muted);font-size:0.85rem;pointer-events:none;'
          }, statusMsg.value)
        : null;

      // Terminal mount point — xterm renders directly into this div
      const terminal = h('div', {
        ref: mountEl,
        style: 'width:100%;height:100%;min-height:0;',
      });

      return h('div', {
        style: 'display:flex;flex-direction:column;height:100%;min-height:0;'
      }, [
        containerSelector,
        h('div', { style: 'flex:1;min-height:0;position:relative;background:#000;' }, [
          statusOverlay,
          terminal,
        ])
      ].filter(Boolean));
    };
  }
});

export default PodShell;
