/**
 * Vue 3 Component: ModalBase
 * Generic modal wrapper with backdrop, ESC-key close, and a default slot.
 *
 * Props:
 *   visible  {Boolean} — controls visibility
 *   title    {String}  — text shown in modal-header h2
 *
 * Emits:
 *   close — when the user clicks the backdrop, X button, or presses ESC
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, onMounted, onUnmounted, watch, h } = Vue;

export const ModalBase = defineComponent({
  name: 'ModalBase',

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    /**
     * Optional extra CSS class applied to the inner modal-content div.
     * Allows callers to use modifier classes like modal-legend, modal-restart etc.
     */
    contentClass: {
      type: String,
      default: ''
    }
  },

  emits: ['close'],

  setup(props, { emit, slots }) {
    // ESC key handler — stored so it can be removed cleanly
    function onKeydown(e) {
      if (e.key === 'Escape' && props.visible) {
        emit('close');
      }
    }

    onMounted(() => {
      document.addEventListener('keydown', onKeydown);
    });

    onUnmounted(() => {
      document.removeEventListener('keydown', onKeydown);
    });

    function onBackdropClick(e) {
      // Only close when clicking the overlay itself, not its children
      if (e.target === e.currentTarget) {
        emit('close');
      }
    }

    function onCloseBtn() {
      emit('close');
    }

    return () => {
      if (!props.visible) return null;

      const closeBtn = h('button', {
        class: 'modal-close-btn',
        type: 'button',
        'aria-label': 'Close',
        onClick: onCloseBtn
      }, '\u2715'); // ×

      const header = h('div', { class: 'modal-header' }, [
        h('h2', {}, props.title),
        closeBtn
      ]);

      // Default slot content
      const body = h('div', { class: 'modal-body' },
        slots.default ? slots.default() : []
      );

      const contentClass = ['modal-content', props.contentClass].filter(Boolean).join(' ');
      const modalContent = h('div', { class: contentClass }, [header, body]);

      return h('div', {
        class: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        style: 'display: flex;',
        onClick: onBackdropClick
      }, [modalContent]);
    };
  }
});

export default ModalBase;
