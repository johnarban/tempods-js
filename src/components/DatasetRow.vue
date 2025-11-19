<template>
  <v-hover
    v-slot="{ isHovering, props }"
  >
    <v-list-item
      v-bind="props"
      class="selection-item"
      :style="{ 'background-color': selection.region.color }"
      :ripple="touchscreen"
      @click="() => {
        if (touchscreen) {
          openSelection = (openSelection == selection.id) ? null : selection.id;
        }
      }"
      lines="two"
    >
      <template #default>
        <div>
          <v-chip size="small">{{ selection.region.name }}</v-chip>
          <v-chip size="small">{{ moleculeName(selection.molecule) }}</v-chip>
          <v-chip v-if="selection.timeRange" size="small" class="text-caption">
            {{ selection.timeRange.description }}
          </v-chip>
        </div>
        <div
          v-if="selection.loading || !selection.samples"
          class="dataset-loading"
        >
          <v-progress-linear
            :class="['dataset-loading-progress', !(selection.loading && selection.samples) ? 'dataset-loading-failed' : '']"
            :active="selection.loading || !selection.samples"
            :color="selection.loading ? 'primary' : 'red'"
            :indeterminate="selection.loading"
            :value="!selection.loading ? 100 : 0"
            :striped="!selection.loading"
            bottom
            rounded
            height="20"
          >
            <template #default>
              <span class="text-subtitle-2">
                {{ selection.loading ? 'Data Loading' : (!selection.samples ? 'Error Loading Data' : '') }}
              </span>
            </template>
          </v-progress-linear>
          <div v-if="!(selection.loading || selection.samples)">
            <v-tooltip
              text="Failure info"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  icon="mdi-help-circle"
                  variant="plain"
                  @click="() => sampleErrorID = selection.id"
                ></v-btn>
              </template>
            </v-tooltip>
            <v-tooltip
              text="Remove selection"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  icon="mdi-trash-can"
                  variant="plain"
                  @click="emit('delete', selection)"
                ></v-btn>
              </template>
            </v-tooltip>
          </div>
        </div>

        <v-expand-transition>
          <div
            class="selection-icons"
            v-show="selection.samples && (touchscreen ? openSelection == selection.id : isHovering)"
          >
            <v-tooltip
              text="Get Center Point Sample"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  :loading="loadingPointSample === selection.id"
                  icon="mdi-image-filter-center-focus"
                  variant="plain"
                  @click="emit('fetch-center', selection)"
                ></v-btn>
              </template>
            </v-tooltip> 
            <v-tooltip
              text="Show table"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  icon="mdi-table"
                  :disabled="!selection.samples"
                  variant="plain"
                  @click="emit('table', selection)"
                ></v-btn>
              </template>
            </v-tooltip>
            <v-tooltip
              text="Show graph"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  icon="mdi-chart-line"
                  :disabled="!selection.samples"
                  variant="plain"
                  @click="emit('chart', selection)"
                ></v-btn>
              </template>
            </v-tooltip>
            <v-tooltip
              text="Remove selection"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  icon="mdi-trash-can"
                  variant="plain"
                  @click="emit('delete', selection)"
                ></v-btn>
              </template>
            </v-tooltip>
          </div>
        </v-expand-transition>
        <v-dialog
          :model-value="infoOpen"
          max-width="50%"
        >
          <v-card>
            <v-toolbar
              density="compact"
            >
              <v-toolbar-title text="Error Loading Data"></v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn
                icon="mdi-close"
                @click="infoOpen = false"
              >
              </v-btn>
            </v-toolbar>
            <v-card-text>
              There was an error loading data for this selection. Either there is no data for the
              region/time range/molecule combination that you selected, or there was an error loading
              data from the server. You can delete this selection and try making a new one.
            </v-card-text>
          </v-card>
        </v-dialog>
      </template>
    </v-list-item>
  </v-hover>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { UserSelection } from "../types";
import { MOLECULE_OPTIONS, type MoleculeType } from "../esri/utils";

interface Props {
  touchscreen?: boolean;
  selection: UserSelection;
}

withDefaults(defineProps<Props>(), {
  touchscreen: false,
});

const infoOpen = ref(false);

const emit = defineEmits<{
  (event: "delete", selection: UserSelection): void;
  (event: "fetch-center", selection: UserSelection): void;
  (event: "table", selection: UserSelection): void;
  (event: "chart", selection: UserSelection): void;
  (event: "error-info", selection: UserSelection): void;
}>();

function moleculeName(molecule: MoleculeType): string {
  return MOLECULE_OPTIONS.find(m => m.value == molecule)?.title ?? "";
}
</script>
