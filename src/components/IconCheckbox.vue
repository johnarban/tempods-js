<template>
  <v-checkbox
    v-model="modelValue"
    :value="value"
    :label="label"
    :class="[isSelected ? '' : 'not-selected']"
    :ripple="false"
    class="icon-checkbox"
  >
    <template #label>
      <!--
        No click handler needed: Vuetify wraps this slot in a <label for>
        pointing at the real input, so clicking the text toggles natively.
      -->
      <span class="pl-2 icon-checkbox-label">
        {{ label }}
      </span>
    </template>
    <template #input="{ model, inputNode }">
      <!--
        This slot REPLACES Vuetify's input rather than decorating it, and the
        replacement used to be a bare <span> with a click handler. That left no
        real checkbox anywhere: the control was not a tab stop, Space did
        nothing, and there was no checked state for a screen reader to read, so
        keyboard users could not reach these toggles at all.

        Rendering inputNode puts Vuetify's own <input type="checkbox"> back. It
        is invisible and covers the control (opacity 0, absolutely positioned
        at 100% x 100%), so the icon still shows, while the tab stop, Space,
        aria-checked, the label's for/id association and the app's focus ring
        all come back with it. The icon no longer needs a click handler of its
        own, because the input is on top of it.
      -->
      <span class="icon-checkbox-control">
      <font-awesome-icon
          v-if="(model.value ? onIcon : offIcon)?.startsWith('fa-') && !hideIcon"
          :icon="model.value ? onIcon : offIcon"
          :class="['fa-icon', model.value ? 'icon-checkbox--checked' : '']"
          :color="model.value ? onColor : offColor"
        ></font-awesome-icon>
        <v-icon
          v-else-if="!hideIcon"
          :class="['md-icon', model.value ? 'icon-checkbox--checked' : '']"
          :color="model.value ? onColor : offColor"
        >{{ model.value ? onIcon : offIcon }}
      </v-icon>
      <div v-else :class="['icon-checkbox-circle-icon', model.value ? '' : 'disabled']" :style="{'--color':onColor}"></div>
    </span>
      <component :is="inputNode" />
    </template>
  </v-checkbox>
</template>

<script setup lang="ts">
import { computed } from 'vue';
export interface IconCheckboxProps {
  value: string;
  onIcon: string;
  offIcon: string;
  onColor?: string;
  offColor?: string;
  label: string;
  hideIcon?: boolean;
}

const modelValue = defineModel<boolean | string[]>({required: true});
const props = withDefaults(defineProps<IconCheckboxProps>(), {
  onColor: "white",
  offColor: "gray",
  hideIcon: false,
});

const isSelected = computed(() => {
  if (typeof modelValue.value === "boolean") {
    return modelValue.value;
  } else if (Array.isArray(modelValue.value)) { // it's an array
    const index = modelValue.value.indexOf(props.value);
    return index >= 0;
  }
  return false;
});
</script>

<style lang="less">
.icon-checkbox {
.icon-checkbox--checked {
  filter: drop-shadow(0 0 2px rgb(var(--v-theme-on-surface)));
}


.v-selection-control__input {
  // outline: 1px solid white;
}

.icon-checkbox-control {
  display: flex;
  align-items: center;
}

.icon-checkbox-circle-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: var(--color);
  border-radius: 50%;
  outline: 1px solid rgb(var(--v-theme-on-surface));
  cursor: pointer;
}

}

.v-checkbox.icon-checkbox.not-selected {
  
  .icon-checkbox-label {
    opacity: 0.38;
  }
  
  .icon-checkbox-circle-icon {
    opacity: 0.38;
    outline: 1px solid #4d4d4d;
  }
}

.v-checkbox.icon-checkbox:hover {
  // filter: drop-shadow(0px 0px 2px rgb(var(--v-theme-on-surface)));
  font-weight: bold;
}
</style>
