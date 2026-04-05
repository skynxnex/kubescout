/**
 * Shell Handlers - Pod interactive terminal
 * Handles: attachPodShellHandlers, openPodShell
 */

import { escapeHtml } from './formatters.js';

// ==============================================
// API Endpoint Helper (local to this module)
// ==============================================

function apiEndpoint(name) {
  return window.IS_LOCAL_MODE ? `/${name}-local` : `/${name}`;
}

// ==============================================
// Pod Shell Terminal
// ==============================================

export function attachPodShellHandlers(container, namespace, context) {
  const shellButtons = container.querySelectorAll('.pod-shell-btn');
  shellButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const podName = btn.dataset.pod;
      openPodShell(podName, namespace, context);
    });
  });
}

export async function openPodShell(podName, nsParam, ctxParam, selectedContainer = null) {
  console.log('[Shell] Opening terminal for pod:', podName);

  // Resolve namespace and context based on mode
  const namespace = window.IS_LOCAL_MODE ? nsParam : (window.IN_CLUSTER_NAMESPACE || '');
  const context = window.IS_LOCAL_MODE ? ctxParam : '';

  // Fetch container list
  let containers = [];
  try {
    const params = new URLSearchParams({ namespace, pod: podName });
    if (context) params.append('context', context);
    const res = await fetch(`${apiEndpoint('pod-containers')}?${params}`);
    if (res.ok) containers = await res.json();
  } catch (e) {
    console.warn('[Shell] Could not fetch container list:', e);
  }

  const modal = document.getElementById('shellModal');
  const podNameSpan = document.getElementById('shellModalPodName');
  const containerSelect = document.getElementById('shellContainerSelect');
  const mountEl = document.getElementById('shellTerminalMount');
  const closeBtn = document.getElementById('shellModalClose');
  if (!modal || !mountEl) return;

  podNameSpan.textContent = podName;

  if (containers.length > 1) {
    containerSelect.innerHTML = containers.map(c =>
      `<option value="${escapeHtml(c)}"${c === selectedContainer ? ' selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
    containerSelect.style.display = '';
  } else {
    containerSelect.innerHTML = containers.length === 1
      ? `<option value="${escapeHtml(containers[0])}">${escapeHtml(containers[0])}</option>`
      : '';
    containerSelect.style.display = 'none';
  }

  mountEl.innerHTML = '';

  // Init xterm (globals from CDN)
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'Courier New', Courier, monospace",
    theme: { background: '#000000' },
    scrollback: 1000,
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(mountEl);
  fitAddon.fit();

  // Build WebSocket
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsParams = new URLSearchParams({ namespace, pod: podName, container: containerSelect.value || '' });
  if (context) wsParams.append('context', context);
  const ws = new WebSocket(`${wsProto}//${location.host}${apiEndpoint('pod-shell')}?${wsParams}`);
  ws.binaryType = 'arraybuffer';

  const attachAddon = new AttachAddon.AttachAddon(ws);
  term.loadAddon(attachAddon);

  const resizeObs = new ResizeObserver(() => { try { fitAddon.fit(); } catch (_) {} });
  resizeObs.observe(mountEl);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    resizeObs.disconnect();
    ws.close();
    term.dispose();
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', escHandler);
    closeBtn.removeEventListener('click', cleanup);
    modal.removeEventListener('click', backdropHandler);
    containerSelect.removeEventListener('change', onContainerChange);
  };

  const escHandler = (e) => { if (e.key === 'Escape') cleanup(); };
  const backdropHandler = (e) => { if (e.target === modal) cleanup(); };
  const onContainerChange = () => {
    const selected = containerSelect.value;
    cleanup();
    openPodShell(podName, namespace, context, selected);
  };

  document.addEventListener('keydown', escHandler);
  closeBtn.addEventListener('click', cleanup);
  modal.addEventListener('click', backdropHandler);
  containerSelect.addEventListener('change', onContainerChange);

  ws.addEventListener('open', () => {
    console.log('[Shell] WebSocket opened for pod:', podName);
  });
  ws.addEventListener('close', (e) => {
    console.log('[Shell] WebSocket closed for pod:', podName, 'code:', e.code, 'reason:', e.reason, 'wasClean:', e.wasClean);
    try { term.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m'); } catch (_) {}
  });
  ws.addEventListener('error', (e) => {
    console.log('[Shell] WebSocket error for pod:', podName, e);
    try { term.writeln('\r\n\x1b[31m[WebSocket error - check pod name and namespace]\x1b[0m'); } catch (_) {}
  });

  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  term.focus();
}
