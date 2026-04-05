/**
 * Vue 3 Component: ConfirmModal
 * Programmatic confirmation dialog used for restart/scale/rollback actions.
 *
 * Props:
 *   visible      {Boolean} — controls visibility
 *   title        {String}  — dialog title
 *   message      {String}  — dialog body message
 *   confirmLabel {String}  — label for confirm button (default: "Confirm")
 *   cancelLabel  {String}  — label for cancel button (default: "Cancel")
 *   dangerous    {Boolean} — when true, confirm button uses danger styling
 *
 * Emits:
 *   confirm — user clicked the confirm button
 *   cancel  — user clicked cancel, X, backdrop, or pressed ESC
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

import { ModalBase } from './ModalBase.js';

const { defineComponent, h } = Vue;

export const ConfirmModal = defineComponent({
  name: 'ConfirmModal',

  components: { ModalBase },

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm'
    },
    message: {
      type: String,
      default: 'Are you sure?'
    },
    confirmLabel: {
      type: String,
      default: 'Confirm'
    },
    cancelLabel: {
      type: String,
      default: 'Cancel'
    },
    dangerous: {
      type: Boolean,
      default: false
    }
  },

  emits: ['confirm', 'cancel'],

  setup(props, { emit }) {
    return () => h(ModalBase, {
      visible: props.visible,
      title: props.title,
      onClose: () => emit('cancel')
    }, {
      default: () => [
        // Message
        h('p', {
          style: 'font-size: 15px; margin: 0 0 24px 0; line-height: 1.6; color: var(--text-primary);'
        }, props.message),

        // Footer buttons
        h('div', {
          class: 'modal-footer',
          style: 'padding: 0; border: none; margin-top: 8px;'
        }, [
          h('button', {
            class: 'cyber-button',
            type: 'button',
            onClick: () => emit('cancel')
          }, props.cancelLabel),

          h('button', {
            class: ['cyber-button', props.dangerous ? 'cyber-button-danger' : 'cyber-button-primary'].join(' '),
            type: 'button',
            onClick: () => emit('confirm')
          }, props.confirmLabel)
        ])
      ]
    });
  }
});

export default ConfirmModal;
