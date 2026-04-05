/**
 * Vue 3 Component: AuthError
 * Displays an AWS SSO authentication error with a retry button.
 * Mirrors the auth error UI rendered by handleAuthError() in main.js.
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, h } = Vue;

// Lock icon SVG — SAFE: hardcoded
const ICON_LOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

// Refresh icon SVG — SAFE: hardcoded
const ICON_REFRESH = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';

export const AuthError = defineComponent({
  name: 'AuthError',

  props: {
    // Optional custom message — falls back to standard AWS SSO copy
    message: {
      type: String,
      default: ''
    },
    // Whether a retry is currently in progress
    retrying: {
      type: Boolean,
      default: false
    }
  },

  emits: ['retry'],

  setup(props, { emit }) {
    function onRetry() {
      emit('retry');
    }

    return () => {
      const displayMessage = props.message ||
        'AWS SSO session expired. Run "aws sso login" in your terminal, then click Retry.';

      return h('div', {
        class: 'auth-error-container',
        style: [
          'display: flex',
          'flex-direction: column',
          'align-items: center',
          'justify-content: center',
          'gap: 20px',
          'padding: 48px 24px',
          'text-align: center',
          'color: var(--text-primary)',
        ].join('; ')
      }, [

        // Lock icon
        h('div', {
          style: 'color: var(--color-danger, #ef4444); opacity: 0.85;',
          innerHTML: ICON_LOCK  // SAFE: hardcoded SVG
        }),

        // Heading
        h('h3', {
          style: [
            'margin: 0',
            'font-size: 1.125rem',
            'font-weight: 700',
            'color: var(--color-danger, #ef4444)',
            'letter-spacing: 0.05em',
            'text-transform: uppercase',
          ].join('; ')
        }, 'Authentication Required'),

        // Message
        h('p', {
          style: [
            'margin: 0',
            'max-width: 480px',
            'font-size: 0.9rem',
            'line-height: 1.6',
            'color: var(--text-secondary)',
          ].join('; ')
        }, displayMessage),

        // Steps list
        h('ol', {
          style: [
            'margin: 0',
            'padding-left: 1.5em',
            'text-align: left',
            'font-size: 0.875rem',
            'color: var(--text-secondary)',
            'line-height: 2',
          ].join('; ')
        }, [
          h('li', 'Open a terminal'),
          h('li', [
            'Run: ',
            h('code', {
              style: 'background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace;'
            }, 'aws sso login')
          ]),
          h('li', 'Click the Retry button below')
        ]),

        // Retry button
        h('button', {
          type: 'button',
          class: 'cyber-button cyber-button-primary',
          disabled: props.retrying,
          style: 'display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: center;',
          onClick: onRetry
        }, [
          h('span', {
            style: props.retrying ? 'animation: spin 1s linear infinite; display: inline-flex;' : 'display: inline-flex;',
            innerHTML: ICON_REFRESH  // SAFE: hardcoded SVG
          }),
          props.retrying ? 'Retrying...' : 'Retry'
        ])
      ]);
    };
  }
});

export default AuthError;
