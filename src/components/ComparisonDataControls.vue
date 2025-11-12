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
        :order="['power-plants-heatmap', 'aqi-layer-aqi', 'pop-dens', 'land-use',  'hms-fire', 'esri-source', 'stamen-toner-lines']"
      >
      </layer-order-control>
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
} = storeToRefs(store);
</script>
