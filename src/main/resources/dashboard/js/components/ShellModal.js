/**
 * Vue 3 Component: ShellModal
 * Full-screen modal wrapper around PodShell.
 *
 * Props:
 *   visible    {Boolean} — controls visibility
 *   podName    {String}  — pod name to open terminal for
 *   namespace  {String}  — Kubernetes namespace
 *   context    {String}  — kubeconfig context
 *   containers {Array}   — list of container names (fetched by vue-app.js)
 *
 * Emits:
 *   close — when the user clicks the backdrop, X button, or presses ESC
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, h } = Vue;

import { ModalBase } from './ModalBase.js';
import { PodShell } from './PodShell.js';

export const ShellModal = defineComponent({
  name: 'ShellModal',

  components: { ModalBase, PodShell },

  props: {
    visible:    { type: Boolean, default: false },
    podName:    { type: String,  default: '' },
    namespace:  { type: String,  default: '' },
    context:    { type: String,  default: '' },
    containers: { type: Array,   default: () => [] },
  },

  emits: ['close'],

  setup(props, { emit }) {
    return () => {
      if (!props.visible || !props.podName) return null;

      return h(ModalBase, {
        visible:      props.visible,
        title:        `Terminal: ${props.podName}`,
        contentClass: 'modal-shell',
        onClose:      () => emit('close'),
      }, {
        default: () => [
          h('div', {
            style: 'padding:0;overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column;'
          }, [
            h(PodShell, {
              key:        `${props.podName}-${props.containers.join(',')}`,
              podName:    props.podName,
              namespace:  props.namespace,
              context:    props.context,
              containers: props.containers,
            })
          ])
        ]
      });
    };
  }
});

export default ShellModal;
