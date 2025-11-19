<template>
  <v-checkbox
    v-model="modelValue"
    :value="value"
    v-bind="props"
  >
    <template #label>
      <span @click="() => update()">
        {{ label }}
      </span>
    </template>
    <template #input="{ model }">
      <!-- Using <component :is="..."/> didn't work with v-icon for some reason -->
      <font-awesome-icon
          v-if="(model.value ? onIcon : offIcon)?.startsWith('fa-')"
          :icon="model.value ? onIcon : offIcon"
          :class="['fa-icon', model.value ? 'icon-checkbox--checked' : '']"
          :color="model.value ? onColor : offColor"
          @click="model.value = !model.value"
        ></font-awesome-icon>
        <v-icon
          v-else
          :class="['md-icon', model.value ? 'icon-checkbox--checked' : '']"
          :color="model.value ? onColor : offColor"
          @click="model.value = !model.value"
        >{{ model ? onIcon : offIcon }}
      </v-icon>
    </template>
  </v-checkbox>
</template>

<script setup lang="ts">
export interface IconCheckboxProps {
  value: string;
  onIcon: string;
  offIcon: string;
  onColor?: string;
  offColor?: string;
  label: string;
}

const modelValue = defineModel();
const props = withDefaults(defineProps<IconCheckboxProps>(), {
  onColor: "white",
  offColor: "gray",
});

function update() {
  if (typeof modelValue.value === "boolean") {
    modelValue.value = !modelValue.value;
  } else { // it's an array
    const index = modelValue.value.indexOf(props.value);
    if (index >= 0) {
      modelValue.value = modelValue.value.slice(0, index).concat(modelValue.value.slice(index + 1));
    } else {
      modelValue.value = [...modelValue.value, props.value];
    }
  }
}
</script>

<style scoped>
.icon-checkbox--checked {
  filter: drop-shadow(0 0 2px rgb(var(--v-theme-on-surface)));
}
</style>
