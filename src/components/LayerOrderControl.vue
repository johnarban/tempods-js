<template>
  <draggable 
    v-model="displayOrder" 
    handle=".drag-handle"
    class="layer-order"
    :item-key="(item) => item"
  >
    <template #item="{ element }">
      <div class="layer-order-row">
        <div class="drag-handle">
          <v-icon>mdi-menu</v-icon>
        </div>
        <layer-control-item
          :map="mapRef"
          :layer-id="element"
          :info="layerInfo[element]"
          :display-name="displayNameTransform(element)"
        >
          <template #actions="{ visible }">
            <div v-if="powerPlantLayerIds.includes(element)">
              <v-btn-toggle
                v-model="powerPlantMode"
                density="compact"
                color="primary"
                :disabled="!visible"
              >
                <v-btn>Heatmap</v-btn>
                <v-btn>Points</v-btn>
              </v-btn-toggle>
            </div>
          </template>
        </layer-control-item>
      </div>
    </template>
  </draggable>
</template>


<script setup lang="ts">
import { computed, type MaybeRef, ref, toValue, toRef, watch } from 'vue';
import draggable from 'vuedraggable';
import M from 'maplibre-gl';

import { useMaplibreLayerOrderControl } from "@/composables/useMaplibreLayerOrderControl";
import { getLayerOpacity, setLayerOpacity, setLayerVisibility } from "@/maplibre_controls";
import { capitalizeWords } from "@/utils/names";

interface Props {
  mapRef: M.Map | null;
  order: MaybeRef<string[]>;
}

const props = defineProps<Props>();
const mapRef = toRef(() => props.mapRef);

const powerPlantMode = ref(0);
const powerPlantLayerIds = ["power-plants-heatmap", "power-plants-layer"];

// https://vuejs.org/guide/typescript/composition-api.html#typing-component-emits

interface Emits {
  (e: 'change', newOrder: string[]): void;
}
const _emit = defineEmits<Emits>();
const { 
  currentOrder, 
  controller 
} = useMaplibreLayerOrderControl(mapRef, toValue(props.order), true);

const displayOrder = computed({
  get(): string[] {
    return currentOrder.value.slice().reverse();
  },
  set(value: string[]) {
    controller?.setOrder(value.slice().reverse());
  }
});

const layerNames: Record<string, string | undefined> = {
  "esri-source": "TEMPO Data",
  "aqi-layer-aqi": "Air Quality Index",
  "power-plants-heatmap": "Power Plants",
  "power-plants-layer": "Power Plants",
  "stamen-toner-lines": "Roads",
  "pop-dens": "Population Density",
  "land-use": "Sentinel Land Use",
  "hms-fire": "Fire Detections",
};

const layerInfo: Record<string, string | undefined> = {
  "aqi-layer-aqi": 'From <a href="https://www.airnow.gov/aqi/aqi-basics/">EPA</a>; taken once per day',
};

function displayNameTransform(layerId: string): string {
  return layerNames[layerId] ?? capitalizeWords(layerId.replace(/-/g, " "));
}

watch(powerPlantMode, (mode: number, oldMode: number) => {
  const oldLayerId = powerPlantLayerIds[oldMode];
  const order = [...currentOrder.value];
  const index = order.indexOf(oldLayerId);
  const newLayerId = powerPlantLayerIds[mode];
  if (index >= 0) {
    order[index] = newLayerId;
  }
  if (mapRef.value) {
    setLayerOpacity(mapRef.value, newLayerId, getLayerOpacity(mapRef.value, oldLayerId));
    setLayerVisibility(mapRef.value, oldLayerId, false);
    setLayerVisibility(mapRef.value, newLayerId, true);
  }
  currentOrder.value = order;
  controller?.setOrder(order);
});
</script>


<style scoped>
ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
  margin-left: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  height: fit-content;
}

li {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  cursor: move;
  margin: 10px 0;
}

.drag-handle {
  font-size: 20pt;

  &:hover {
    cursor: grab;
  }
}

.layer-order {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layer-order-row {
  background: #404040;
  border: 1px solid white;
  border-radius: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
}

.mlc-layer-item {
  border-left: 1px solid white;
  padding: 5px;
}
</style>
