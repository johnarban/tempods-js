/* eslint-disable @typescript-eslint/no-unused-vars */
import Vue, { createApp } from "vue";

import TempoLite from "./TempoLite.vue";
import vuetify from "../plugins/vuetify";
import AggregationWorkflow from "./components/aggregation/AggregationWorkflow.vue";

/** v-hide directive taken from https://www.ryansouthgate.com/2020/01/30/vue-js-v-hide-element-whilst-keeping-occupied-space/ */
// Extract the function out, up here, so I'm not writing it twice
const update = (el: HTMLElement, binding: Vue.DirectiveBinding) => el.style.visibility = (binding.value) ? "hidden" : "";

createApp(TempoLite, {})

  // Plugins
  .use(vuetify)

  // Directives
  .directive(
    /**
    * Hides an HTML element, keeping the space it would have used if it were visible (css: Visibility)
    */
    "hide", {
      // Run on initialisation (first render) of the directive on the element
      beforeMount(el, binding, _vnode, _prevVnode) {
        update(el, binding);
      },
      // Run on subsequent updates to the value supplied to the directive
      updated(el, binding, _vnode, _prevVnode) {
        update(el, binding);
      }
    })

  // Components
  .component('aggregation-workflow', AggregationWorkflow)

  // Mount
  .mount("#app");
