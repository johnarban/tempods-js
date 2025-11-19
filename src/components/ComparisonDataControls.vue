<template>
  <div class="comparison-data-controls">
    <p class="my-3">
      Choose other datasets to view with the TEMPO Data. Drag cards to re-order data layers.
    </p>
    <div
      v-for="(map, index) in maps"
      :key="index"
    >
      <layer-order-control
        :mapRef="map"
        :order="['power-plants-layer', 'aqi-layer-aqi', 'pop-dens', 'land-use','hms-fire', 'tempo-o3', 'tempo-hcho', 'tempo-no2', 'stamen-toner-lines']"
      >
      </layer-order-control>
      <!-- center with d-block mx-auto -->
      <v-btn
        class="my-2 d-block mx-auto"
        @click="showAdvancedLayers = !showAdvancedLayers"
        @keyup.enter="showAdvancedLayers = !showAdvancedLayers"
        :text="showAdvancedLayers ? 'Show me less' : 'Show me more!'"
        density="default"
        hide-details
        :color="accentColor2"
      >
      </v-btn>
      <v-checkbox
        v-model="showRGBMode"
        label="Use single-color TEMPO layers"
        density="compact"
        hide-details
      >
      </v-checkbox>
      <v-checkbox
        v-model="showFieldOfRegard"
        label="Show TEMPO field of regard"
        density="compact"
        hide-details
      >
      </v-checkbox>
      <power-plants-filter-control
        :map="map"
        layer-id="power-plants-heatmap"
      >
      </power-plants-filter-control>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useTempoStore } from "@/stores/app";

const store = useTempoStore();
const {
  maps,
  showFieldOfRegard,
  showAdvancedLayers,
  showRGBMode,
  accentColor2
} = storeToRefs(store);
</script>
