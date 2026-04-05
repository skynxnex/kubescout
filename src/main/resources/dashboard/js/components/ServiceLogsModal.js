/**
 * Vue 3 Component: ServiceLogsModal
 * Full-screen modal wrapper around ServiceLogsViewer.
 *
 * Props:
 *   visible     {Boolean} — controls visibility
 *   serviceName {String}  — Kubernetes service name
 *   namespace   {String}  — Kubernetes namespace
 *   context     {String}  — kubeconfig context
 *
 * Emits:
 *   close — when the user dismisses the modal
 *
 * CDN-Vue pattern: destructure from global window.Vue — no ESM import from 'vue'.
 */

const { defineComponent, h } = Vue;

import { ModalBase } from './ModalBase.js';
import { ServiceLogsViewer } from './ServiceLogsViewer.js';

export const ServiceLogsModal = defineComponent({
  name: 'ServiceLogsModal',

  components: { ModalBase, ServiceLogsViewer },

  props: {
    visible:     { type: Boolean, default: false },
    serviceName: { type: String,  default: '' },
    namespace:   { type: String,  default: '' },
    context:     { type: String,  default: '' },
  },

  emits: ['close'],

  setup(props, { emit }) {
    return () => {
      if (!props.visible || !props.serviceName) return null;

      return h(ModalBase, {
        visible:      props.visible,
        title:        `Service Logs: ${props.serviceName}`,
        contentClass: 'modal-logs',
        onClose:      () => emit('close'),
      }, {
        default: () => [
          h(ServiceLogsViewer, {
            key:         `${props.serviceName}-${props.namespace}`,
            serviceName: props.serviceName,
            namespace:   props.namespace,
            context:     props.context,
          })
        ]
      });
    };
  }
});

export default ServiceLogsModal;
