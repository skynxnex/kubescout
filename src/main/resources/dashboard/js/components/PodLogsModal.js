/**
 * Vue 3 Component: PodLogsModal
 * Full-screen modal wrapper around PodLogsViewer.
 *
 * Props:
 *   visible    {Boolean} — controls visibility
 *   podName    {String}  — pod name
 *   namespace  {String}  — Kubernetes namespace
 *   context    {String}  — kubeconfig context
 *   containers {Array}   — list of container names
 *
 * Emits:
 *   close — when the user dismisses the modal
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, h } = Vue;

import { ModalBase } from './ModalBase.js';
import { PodLogsViewer } from './PodLogsViewer.js';

export const PodLogsModal = defineComponent({
  name: 'PodLogsModal',

  components: { ModalBase, PodLogsViewer },

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
        title:        `Pod Logs: ${props.podName}`,
        contentClass: 'modal-logs',
        onClose:      () => emit('close'),
      }, {
        default: () => [
          h(PodLogsViewer, {
            key:        `${props.podName}-${props.namespace}`,
            podName:    props.podName,
            namespace:  props.namespace,
            context:    props.context,
            containers: props.containers,
          })
        ]
      });
    };
  }
});

export default PodLogsModal;
