/**
 * AI Help Module
 * Provides contextual AI assistance icons for Kubernetes-specific concepts.
 * Clicking the icon opens a modal with a pre-written prompt and a link to Gemini.
 */

// ==============================================
// Prompt Definitions per K8s Concept
// ==============================================

const AI_PROMPTS = {
  // Pod Events
  'event-backoff': {
    title: 'Back-off / BackOff event',
    prompt: 'Explain what the Kubernetes event "Back-off restarting failed container" means, why it happens, and how to troubleshoot it. Explain in a way that is easy to understand.'
  },
  'event-oomkilled': {
    title: 'OOMKilled event',
    prompt: 'Explain what OOMKilled means in Kubernetes, why a pod can be OOMKilled, and what you can do about it.'
  },
  'event-pulled': {
    title: 'Pulled / Pulling event',
    prompt: 'Explain what the Kubernetes events "Pulled" and "Pulling" mean for container images.'
  },
  'event-failed': {
    title: 'Failed event',
    prompt: 'Explain what "Failed" events mean in Kubernetes and how to troubleshoot them.'
  },
  'event-generic': {
    title: 'Kubernetes Events',
    prompt: 'Explain how Kubernetes Events work, what they are used for, and how to interpret them to diagnose problems.'
  },

  // ConfigMaps & Secrets
  'configmap': {
    title: 'ConfigMap',
    prompt: 'Explain what a Kubernetes ConfigMap is, what it is used for, and how it differs from a Secret. Give practical examples.'
  },
  'secret': {
    title: 'Kubernetes Secret',
    prompt: 'Explain what a Kubernetes Secret is, how it works, and what security aspects you should keep in mind.'
  },

  // Pod status
  'status-crashloopbackoff': {
    title: 'CrashLoopBackOff',
    prompt: 'Explain what CrashLoopBackOff means in Kubernetes, the most common causes, and how to troubleshoot it step by step.'
  },
  'status-oomkilled': {
    title: 'OOMKilled status',
    prompt: 'Explain what OOMKilled means in Kubernetes pod status, how to find the root cause, and how to fix it.'
  },
  'status-imagepullbackoff': {
    title: 'ImagePullBackOff',
    prompt: 'Explain what ImagePullBackOff means in Kubernetes and how to troubleshoot problems with pulling container images.'
  },
  'status-pending': {
    title: 'Pending pod',
    prompt: 'Explain what it means when a Kubernetes pod is stuck in "Pending" status, what the common causes are, and how to resolve it.'
  },
  'status-failed': {
    title: 'Failed pod',
    prompt: 'Explain what "Failed" pod status means in Kubernetes and how to diagnose and fix it.'
  },

  // Restart count
  'high-restarts': {
    title: 'High restart count',
    prompt: 'In Kubernetes, this pod has a high number of restarts. Explain what could be causing it and how to diagnose the problem.'
  },

  // Endpoints
  'endpoints': {
    title: 'Service Endpoints',
    prompt: 'Explain what Kubernetes Service Endpoints are and how they relate to Pods and Services.'
  },

  // Problematic pods
  'problematic-pods': {
    title: 'Problematic pods',
    prompt: 'Explain what makes a Kubernetes pod "problematic" and which status types you should pay attention to.'
  }
};

// ==============================================
// Modal: Show AI Help
// ==============================================

/**
 * Show the AI help modal for a given concept key.
 * The modal displays the prompt text (editable) and buttons to copy or open Gemini.
 * @param {string} conceptKey - Key from AI_PROMPTS
 */
function showAiHelpModal(conceptKey) {
  const concept = AI_PROMPTS[conceptKey];
  if (!concept) {
    console.warn('[AI Help] Unknown concept key:', conceptKey);
    return;
  }

  // Remove any existing AI help modal
  document.querySelector('.ai-help-modal-overlay')?.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay ai-help-modal-overlay';
  modal.innerHTML = `
    <div class="modal-content ai-help-modal">
      <div class="modal-header">
        <div class="ai-help-modal-title">
          <span class="ai-help-modal-sparkle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          <h2>AI Help: ${escapeHtmlInline(concept.title)}</h2>
        </div>
        <button class="modal-close-btn" aria-label="Close">×</button>
      </div>
      <div class="modal-body ai-help-modal-body">
        <p class="ai-help-description">Pre-written question for Gemini AI. You can edit the text before sending.</p>
        <textarea class="ai-help-prompt-textarea" rows="6" spellcheck="false">${escapeHtmlInline(concept.prompt)}</textarea>
        <div class="ai-help-actions">
          <button class="modal-btn modal-btn-secondary ai-help-copy-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy prompt
          </button>
          <button class="modal-btn modal-btn-primary ai-help-open-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open Gemini
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
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

  // Copy prompt button
  modal.querySelector('.ai-help-copy-btn').addEventListener('click', async () => {
    const textarea = modal.querySelector('.ai-help-prompt-textarea');
    const text = textarea.value;
    try {
      await navigator.clipboard.writeText(text);
      const btn = modal.querySelector('.ai-help-copy-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    } catch {
      console.warn('[AI Help] Clipboard write failed, falling back to selection');
      textarea.select();
    }
  });

  // Open Gemini button — copies prompt to clipboard so user can paste in Gemini
  modal.querySelector('.ai-help-open-btn').addEventListener('click', async () => {
    const textarea = modal.querySelector('.ai-help-prompt-textarea');
    const text = textarea.value;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // If clipboard fails, still open Gemini
    }

    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    closeModal();
  });
}

// ==============================================
// Inline HTML escaping (no external dep)
// ==============================================

function escapeHtmlInline(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// ==============================================
// Global click handler (event delegation)
// ==============================================

/**
 * Initialize the global AI help click handler.
 * Uses event delegation on document so it works with dynamically rendered HTML.
 * Call once on page load.
 */
export function initAiHelp() {
  document.addEventListener('click', (e) => {
    const icon = e.target.closest('.ai-help-icon');
    if (!icon) return;

    e.stopPropagation();
    e.preventDefault();

    const conceptKey = icon.dataset.concept;
    if (conceptKey) {
      showAiHelpModal(conceptKey);
    }
  });

  console.log('[AI Help] Initialized');
}

// ==============================================
// Icon Generator (used in template literals)
// ==============================================

/**
 * Create an AI help icon HTML string for use in template literals.
 * @param {string} conceptKey - Key from AI_PROMPTS (e.g. 'configmap', 'status-crashloopbackoff')
 * @returns {string} HTML string for the icon button
 */
export function aiHelpIcon(conceptKey) {
  if (!AI_PROMPTS[conceptKey]) {
    console.warn('[AI Help] Unknown concept key for icon:', conceptKey);
    return '';
  }
  const title = AI_PROMPTS[conceptKey].title;
  return `<button
    class="ai-help-icon"
    data-concept="${escapeHtmlInline(conceptKey)}"
    title="Ask AI about: ${escapeHtmlInline(title)}"
    aria-label="AI help about ${escapeHtmlInline(title)}"
    type="button"
  >🤖</button>`;
}
