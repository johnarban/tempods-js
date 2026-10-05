<template>
  <div
    :class="['side-panel-control', open ? 'open' : 'closed']"
    :style="cssVars"
  >
    <div class="open-close-container">
      <v-tooltip
        :disabled="!tooltips"
        :text="open ? openTooltipText : closedTooltipText"
      >
        <template #activator="{ props }">
          <!--
            Vuetify renders v-icon as <i role="button" tabindex="0">, but
            role="button" is only a hint: the browser does not turn Enter or
            Space into a click the way it would for a real <button>, so these
            have to be handled here. Space is taken on keydown with .prevent
            because otherwise it scrolls the page before the panel toggles.
          -->
          <v-icon
            v-bind="props"
            :color="open ? openArrowColor : closedArrowColor"
            class="open-close-icon"
            :aria-label="toggleLabel"
            @click="toggleOpen()"
            @keyup.enter="toggleOpen()"
            @keydown.space.prevent="toggleOpen()"
          >
            {{ open ? openIcon : closedIcon }}
          </v-icon>
        </template>
      </v-tooltip>
      <hr />
    </div>
    <v-slide-x-transition class="content-container">
      <div v-if="open" class="content">
        <slot></slot>
      </div>
      <div class="placeholder-content" v-else>
        <v-tooltip
          :disabled="!tooltips"
          :text="open ? openTooltipText : closedTooltipText"
        >
          <template #activator="{ props }">
            <v-icon
              class="content-icon"
              v-bind="{ ...props, icon }"
              :color="color"
              :aria-label="toggleLabel"
              @click="toggleOpen()"
              @keyup.enter="toggleOpen()"
              @keydown.space.prevent="toggleOpen()"
              size="large"
            >
            </v-icon>
        </template>
      </v-tooltip>
      </div>
    </v-slide-x-transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  openDirection: "left" | "right";
  icon: string;
  color?: string;
  openArrowColor?: string;
  closedArrowColor?: string;
  tooltips?: boolean;
  openTooltipText?: string | undefined;
  closedTooltipText?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
  color: "white",
  openArrowColor: "gray",
  closedArrowColor: "gray",
  tooltips: false,
  openTooltipText: undefined,
  closedTooltipText: undefined,
});
const open = defineModel<boolean>("open", { type: Boolean, default: false });
const closeDirection = computed(() => props.openDirection === "left" ? "right" : "left");
const openIcon = computed(() => `mdi-chevron-double-${closeDirection.value}`);
const closedIcon = computed(() => `mdi-chevron-double-${props.openDirection}`);

function toggleOpen() {
  open.value = !open.value;
}

// Both toggles render as role="button", so they need an accessible name or a
// screen reader announces nothing but "button". The tooltip text is the natural
// one and already says what the control does, but it is optional on this
// component, so fall back to something generic rather than leaving it unnamed.
// The name describes what activating it will do, which flips with the state.
const toggleLabel = computed(() => {
  return open.value
    ? props.openTooltipText ?? "Collapse panel"
    : props.closedTooltipText ?? "Expand panel";
});

const cssVars = computed(() => ({
  "--icon-alignment": props.openDirection == "left" ? "start" : "end",
}));
</script>

<style scoped lang="less">
.side-panel-control {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;

  // we want the scrollbars. but keeping code for reference
  // -ms-overflow-style: none;
  // scrollbar-width: none;
  padding: 0;

  // collapsed nothing to scroll
  &.closed {
    overflow: hidden;
  }
}

hr {
  background: white;
  margin: auto;
  width: 100%;
}

.open-close-container {
  display: flex;
  background: #222222;
  flex-direction: column;

  .open-close-icon {
    align-self: var(--icon-alignment);
  }
}

.content-container {
  margin-top: 10px;
  height: 100%;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
