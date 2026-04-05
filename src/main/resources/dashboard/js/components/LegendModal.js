/**
 * Vue 3 Component: LegendModal
 * Wraps ModalBase with the icon-legend content copied from index.html.
 *
 * Props:
 *   visible {Boolean}
 *
 * Emits:
 *   close
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { ModalBase } from './ModalBase.js';

const { defineComponent, h } = Vue;

// Legend HTML is safe — entirely hardcoded, no user data interpolated.
// SAFE: hardcoded
const LEGEND_HTML = `
  <div class="legend-modal-body">

    <!-- Row Colors -->
    <section class="legend-section">
      <h3 class="legend-section-title">Row Colors</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-swatch legend-swatch--bad"></span>
          <span class="legend-label">Red row &mdash; Service has failed pods or containers with errors</span>
        </div>
        <div class="legend-item">
          <span class="legend-swatch legend-swatch--warn"></span>
          <span class="legend-label">Yellow row &mdash; High restart count or completed containers</span>
        </div>
        <div class="legend-item">
          <span class="legend-swatch legend-swatch--ok"></span>
          <span class="legend-label">Default &mdash; Service is healthy</span>
        </div>
        <div class="legend-item">
          <span class="legend-swatch legend-swatch--single"></span>
          <span class="legend-label">Blue left border &mdash; Single pod, no redundancy, higher risk</span>
        </div>
      </div>
    </section>

    <!-- Service Status Icons -->
    <section class="legend-section">
      <h3 class="legend-section-title">Service Status</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-icon legend-icon--bad">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </span>
          <span class="legend-label">Unhealthy &mdash; One or more pods are failing</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--warn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="legend-label">Warning &mdash; High restarts or non-critical issues</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--ok">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <span class="legend-label">Healthy &mdash; All pods running normally</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--single">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="13" x2="12" y2="21"/></svg>
          </span>
          <span class="legend-label">Single pod &mdash; No redundancy, higher availability risk</span>
        </div>
      </div>
    </section>

    <!-- Pod Phase Icons -->
    <section class="legend-section">
      <h3 class="legend-section-title">Pod Phase</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-icon legend-icon--ok">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <span class="legend-label">Check circle &mdash; Running</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <span class="legend-label">Clock &mdash; Pending / Initializing</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--bad">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <span class="legend-label">Zap &mdash; CrashLoopBackOff</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--bad">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </span>
          <span class="legend-label">X circle &mdash; Failed / Error</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--warn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </span>
          <span class="legend-label">Download &mdash; ImagePullBackOff</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          </span>
          <span class="legend-label">Square &mdash; Terminating</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </span>
          <span class="legend-label">Trash &mdash; Evicted</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--warn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="legend-label">Alert triangle &mdash; Unknown phase</span>
        </div>
      </div>
    </section>

    <!-- Restart Reason Tags -->
    <section class="legend-section">
      <h3 class="legend-section-title">Restart Reason Tags</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-tag">&#x1F4A5; OOMKilled</span>
          <span class="legend-label">Container ran out of memory and was killed</span>
        </div>
        <div class="legend-item">
          <span class="legend-tag">&#x274C; Error</span>
          <span class="legend-label">Container exited with a non-zero error code</span>
        </div>
        <div class="legend-item">
          <span class="legend-tag">&#x2705; Completed</span>
          <span class="legend-label">Container finished normally (expected exit)</span>
        </div>
      </div>
    </section>

    <!-- Action Icons -->
    <section class="legend-section">
      <h3 class="legend-section-title">Action Icons</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-icon legend-icon--muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </span>
          <span class="legend-label">Circular arrows &mdash; Restart deployment (prompts for confirmation)</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon legend-icon--ai">🤖</span>
          <span class="legend-label">AI help &mdash; explains the Kubernetes concept</span>
        </div>
      </div>
    </section>

  </div>
`;

export const LegendModal = defineComponent({
  name: 'LegendModal',

  components: { ModalBase },

  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },

  emits: ['close'],

  setup(props, { emit }) {
    return () => h(ModalBase, {
      visible: props.visible,
      title: 'Icon Legend',
      contentClass: 'modal-legend',
      onClose: () => emit('close')
    }, {
      default: () => [
        h('div', {
          innerHTML: LEGEND_HTML // SAFE: hardcoded, no user data
        })
      ]
    });
  }
});

export default LegendModal;
