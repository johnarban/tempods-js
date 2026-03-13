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
          <v-icon size="x-small">mdi-menu</v-icon>
        </div>
        <layer-control-item
          :map="mapRef"
          :layer-id="element"
          :display-name="displayNameTransform(element)"
          :synced-items="getConnectedItems(element)"
          :disabled="serviceDown(element)"
        >
          <template #warning
            v-if="warningMessage(element)"
          >
            <v-tooltip :text="warningMessage(element)!">
              <template #activator="{ props }">
                <v-icon 
                  v-if="!serviceLoading(element)" 
                  class="pointer-events-auto" 
                  v-bind="props" 
                  color="error">
                    mdi-alert
                </v-icon>
                <v-progress-circular 
                  v-else
                  class="pointer-events-auto" 
                  v-bind="props"
                  size="20"
                  width="5"
                  color="on-surface"
                  indeterminate
                />
              </template>
            </v-tooltip>
          </template>
          <template #info
            v-if="layerInfo[element]"
          >
            <div v-html="layerInfo[element]"></div>
          </template>
          <template #extras="{ visible }"
          >
            <local-scope
              v-if="element.startsWith(tempoPrefix)"
              :cbar="colorbarOptions[element.slice(tempoPrefix.length)]"
            >
              <template #default="{ cbar }">
                <colorbar-horizontal
                  v-show="visible"
                  :cmap-name="showRGBMode ? cbar.rgbcolormap : cbar.colormap"
                  :cmap="colormapFunction(showRGBMode ? cbar.rgbcolormap : cbar.colormap)"
                  background-color="transparent"
                  height="15px"
                  font-size="9pt"
                  :nsteps="255"
                  :start-value="String((showRGBMode ? cbar.rgbstretch : cbar.stretch)[0] / cbar.cbarScale)"
                  :end-value="String((showRGBMode ? cbar.rgbstretch : cbar.stretch)[1] / cbar.cbarScale)"
                  :extend="false"
                >
                  <template #label>
                    <span v-html="cbarLabel(cbar.cbarScale, cbar.unit)"></span>
                  </template>
                </colorbar-horizontal>
              </template>
            </local-scope>
            <!-- Legend -->

            <NarrowExpansionPanel v-show="visible" :item="element" v-if="hasLegend.includes(element)" :label="element==='power-plants-layer' ? 'Show Filter' : 'Show Legend'">
              <land-use-legend  v-if="element === 'land-use'"  />
              <AQILegend v-if="element === 'aqi-layer-aqi'" />
              <power-plants-filter-control :map="mapRef" v-if="element === 'power-plants-layer'"/>
              <pop-dens-legend v-if="element === 'pop-dens'" mini/>
            </NarrowExpansionPanel>

          </template>
        </layer-control-item>
      </div>
    </template>
  </draggable>
</template>


<script setup lang="ts">
import { computed, type MaybeRef,  toValue, toRef } from 'vue';
import { storeToRefs } from "pinia";
import draggable from 'vuedraggable';
import M from 'maplibre-gl';

import { useMaplibreLayerOrderControl } from "@/composables/useMaplibreLayerOrderControl";
import { capitalizeWords } from "@/utils/names";
import { parseTempoVersion } from "@/esri/utils";
import { colorbarOptions } from "@/esri/ImageLayerConfig";
import { colormapFunction } from "@/colormaps/utils";
import { useTempoStore } from "@/stores/app";
import NarrowExpansionPanel from './NarrowExpansionPanel.vue';
import LandUseLegend from './LandUseLegend.vue';
import AQILegend from './AQILegend.vue';
import PopDensLegend from './PopDensLegend.vue';


const store = useTempoStore();
const { showRGBMode, layersReady, layerRangeWarnings } = storeToRefs(store);

interface Props {
  mapRef: M.Map | null;
  order: MaybeRef<string[]>;
}

const props = defineProps<Props>();
const mapRef = toRef(() => props.mapRef);

// https://vuejs.org/guide/typescript/composition-api.html#typing-component-emits

interface Emits {
  (e: 'change', newOrder: string[]): void;
}
const _emit = defineEmits<Emits>();

  
const connections = {
  'stamen-toner-lines': ['coastline-custom', 'states-custom', 'stamen-toner-lines'],
};
const getConnectedItems = (layer: string): string[] => {
  return connections[layer] ?? [];
};

const { 
  currentOrder, 
  controller 
} = useMaplibreLayerOrderControl(
  mapRef, 
  toValue(props.order),
  false,
  Object.entries(connections).map(([key, value]) => [key, value])
  
);

const tempoPrefix = "tempo-";

const displayOrder = computed({
  get(): string[] {
    return currentOrder.value.slice().reverse();
  },
  set(value: string[]) {
    controller.value?.setManagedOrder(value.slice().reverse());
  }
});

const layerNames: Record<string, string | undefined> = {
  "tempo-no2": "TEMPO NO2",
  "aqi-layer-aqi": "Air Quality Index",
  "power-plants-heatmap": "Power Plants",
  "power-plants-layer": "Power Plants",
  "stamen-toner-lines": "Roads & Boundaries",
  "stamen-toner-labels": "Place Labels",
  "pop-dens": "Population Density",
  "land-use": "Land Use",
  "pace-chlor": "PACE Chlor",
  "pace-color": "PACE Color",
  "pace-dirt": "PACE Detritus",
  "hms-fire": "Fire Detections",
  'tempo-hcho': "TEMPO HCHO",
  'tempo-o3': "TEMPO Ozone",
};

const layerInfo: Record<string, string | undefined> = {
  "tempo-no2": `<h3>TEMPO Nitrogen Dioxide (NO<sub>2</sub>) Data Layer</h3>
                <br/>
                This data layer shows the amount of nitrogen dioxide (NO<sub>2</sub>) in the lower part of the Earth’s atmosphere, called the troposphere. This measurement represents the total number of nitrogen dioxide molecules in a column of air above one square centimeter on the Earth’s surface (molecules/cm2). NO<sub>2</sub> is an air pollutant that can affect both air quality and human health. It is produced by burning fossil fuels (ie. vehicles and power plants), fires, and even lightning.
                <br/><br/>
                TEMPO’s sensor captures this data at about 2 km by 4.75 km at the center of the field of regard (FOR). The data is processed into a Level 3 product with a resolution of 0.02 by 0.02 degrees, and the imagery you see is displayed at about 2 km resolution. To ensure accuracy, the layer is filtered, and only includes high-quality data points, based on key quality checks and sunlight conditions (solar zenith angle).`,
  "tempo-hcho": `<h3>TEMPO Formaldehyde (HCHO) Data Layer</h3>
                 <br/>
                 This layer shows the total amount of formaldehyde in a vertical column of Earth’s atmosphere. The measurement represents the number of formaldehyde molecules in a column of air above each square centimeter of Earth’s surface. Formaldehyde is a Volatile Organic Compound (VOC), a major category of air pollutant that impacts human health and is a precursor to ozone. It is produced by natural sources (trees) as well as man-made sources, such as exhaust from cars, manufacturing plants, and oil and gas extraction.
                 <br/><br/>
                 TEMPO collects this information at about 2 km by 4.75 km near the center of its viewing area. The data is processed into a Level 3 product with a resolution of 0.02 by 0.02 degrees. The imagery you see is displayed at about 2 km resolution. To ensure accuracy, the layer only includes high-quality data points, filtered using key quality checks, sunlight conditions, and cloud coverage.`,
  "tempo-o3": `<h3>TEMPO Ozone (O3) Data Layer</h3>
               <br/>
               This layer shows the total amount of ozone in a vertical column of Earth’s atmosphere, measured in Dobson Units (DU). In the upper atmosphere, ozone plays an important role in protecting life on Earth by absorbing harmful ultraviolet radiation, but in the troposphere ozone is an air pollutant that can affect plant, animal, and human health. Ozone in the troposphere is produced when NO<sub>2</sub> and volatile organic compounds, like HCHO interact in sunlight.
               <br/><br/>
               TEMPO collects ozone measurements at about 2 km by 4.75 km near the center of its viewing area. The data is processed into a Level 3 product with a resolution of 0.02 by 0.02 degrees, and the imagery you see is displayed at about 2 km resolution. To ensure accuracy, the layer only includes high-quality data points, filtered using sunlight conditions (solar zenith angles less than 80°).`,
  "hms-fire": `This layer displays where potential fires have been identified using data from the NOAA Hazard Mapping System. Multiple satellites are used to detect these active fires. However, these sensors are sensitive to both heat sources and reflected sunlight. Industrial sources like steel mills and reflective surfaces like solar panels may create similar signals, but are typically filtered out during data processing. Fire detections can be impacted by environmental factors including cloud cover, dense smoke, and the terrain.
                <br/><br/>
                The colors represent the fire’s radiative power (FRP), which is a measure of the heat energy released by the fire, expressed in megawatts (MW). Higher FRP values often indicate more intense burning within a group of fire pixels, though these values can vary depending on imaging conditions. If FRP data isn’t available for a location, a placeholder value is used.
                <br/><br/>
                Source: NOAA Hazard Mapping System Fire And Smoke Product (<a href="https://www.ospo.noaa.gov/products/land/hms.html" target="_blank" rel="noopener noreferrer">link</a>)
                <br/><br/>
                Satellites: GOES/ABI, the JPSS/VIIRS and EOS/MODIS`,
  "land-use": `This layer shows a global map of land use and land cover (LULC) created from high-resolution Sentinel-2 satellite imagery. The annual map is generated using Impact Observatory’s AI land classification model which was trained on billions of pixels each labeled by a person and provided by the National Geographic Society.
                <br/><br/>
                The land cover categories include: Water, Trees, Flooded Vegetation, Crops, Built Areas, Bare Ground, Snow/Ice, Clouds, and Rangeland.
                <br/><br/>
                Source: ESA Sentinel-2, model produced by ESRI and Impact Observatory (<a href="https://livingatlas.arcgis.com/landcoverexplorer/" target="_blank" rel="noopener noreferrer">link</a>)`,
  "pop-dens": `This layer shows the estimates of human population density, indicated as the number of people per square kilometer, based on official national census and population data. The layer was created using data from ~13.5 million administrative units worldwide.
                 <br/><br/>
                 Source: Created by Center for International Earth Science Information Network - CIESIN - Columbia University. Published by NASA Socioeconomic Data and Applications Center (<a href="https://www.arcgis.com/home/item.html?id=a9fea1ecd1ba4f7db80a0f667fbc508b" target="_blank" rel="noopener noreferrer">link</a>)`,
  "aqi-layer-aqi": `This layer shows the air quality index (AQI) using six color coded categories, each representing a range of values. Higher AQI values indicate higher levels of air pollution.  The AQI for each pollutant is based on health standards set for that pollutant and the scientific information that supports that standard. For ozone, the AQI is calculated on an 8-hour average while for particle pollution it uses a 24-hour average. The reported AQI is the PM2.5 AQI index (from <strong>P</strong>articulate <strong>M</strong>atter less then 2.5 micro-meters in size).
                    <br/><br/>
                    Source: Air Quality monitors in the U.S, Canada, and Mexico (<a href="https://gispub.epa.gov/airnow/index.html?tab=3&monitors=pm25&xmin=-22773986.638966657&xmax=-6121721.4048757255&ymin=-2287422.7865274334&ymax=10881759.942665514" target="_blank" rel="noopener noreferrer">link</a>) via the EPA`,
  "power-plants-layer": `This layer shows all of the operable electric power plants in the United States with a maximum combined generating capacity of at least 30 megawatts (MW) or more (anywhere from ~400-800 homes a year). They are categorized by their energy source. The layer includes plants that are currently running, on standby, or are temporarily out of service.
                         <br/><br/>
                         The three major categories for generating electricity are fossil fuels, nuclear energy, and renewable energy sources.
                         <br/><br/>
                         Source: U.S. Energy Information Administration (EIA)</a>, provided by FEMA Geospatial Resource Center (<a href="https://gis-fema.hub.arcgis.com/datasets/b063316fac7345dba4bae96eaa813b2f/about" target="_blank" rel="noopener noreferrer">link</a>). Last accessed Oct. 16, 2025`,

};

const hasLegend = ['land-use', 'aqi-layer-aqi', 'power-plants-layer', 'pop-dens'];

function displayNameTransform(layerId: string): string {
  return layerNames[layerId] ?? capitalizeWords(layerId.replace(/-/g, " "));
}

function statusSummary(layerId: string): { loading: string[]; failed: string[]; values: (boolean | null)[] } {
  const readiness = layersReady.value.get(layerId);
  if (!readiness) {
    return { loading: [], failed: [], values: [] };
  }

  const loading = new Set<string>();
  const failed = new Set<string>();

  for (const [url, ready] of readiness) {
    const label = parseTempoVersion(url) ?? 'service';
    if (ready === null) {
      loading.add(label);
    } else if (ready === false) {
      failed.add(label);
    }
  }

  return {
    loading: [...loading],
    failed: [...failed],
    values: [...readiness.values()],
  };
}

function serviceLoading(layerId: string): boolean {
  const summary = statusSummary(layerId);
  return summary.loading.length > 0;
}

function serviceWarning(summary: { loading: string[]; failed: string[]; values: (boolean | null)[] }): string | null {
  if (summary.values.length === 0 || summary.values.every((ready) => ready === true)) {
    return null;
  }
  if (summary.loading.length > 0 && summary.failed.length === 0) {
    return `Service status loading (${summary.loading.join(", ")})`;
  }
  if (summary.failed.length > 0 && summary.loading.length > 0) {
    return `Unavailable: ${summary.failed.join(", ")}. Still checking: ${summary.loading.join(", ")}.`;
  }
  if (summary.failed.length > 0 && summary.values.every((ready) => ready === false)) {
    return `The service supporting this layer is down (${summary.failed.join(", ")}). No data is available.`;
  }
  if (summary.failed.length > 0) {
    return `Some data may be unavailable (${summary.failed.join(", ")}).`;
  }
  return null;
}

function warningMessage(layerId: string): string | null {
  const summary = statusSummary(layerId);
  const rangeWarning = layerRangeWarnings.value.get(layerId);
  const rangeText = rangeWarning ?? "";
  const serviceText = serviceWarning(summary);
  if (!rangeText && !serviceText) {
    return null;
  }
  return rangeText && serviceText ? `${rangeText} | ${serviceText}` : `${rangeText}${serviceText}`;
}

function serviceDown(layerId: string): boolean {
  const readiness = statusSummary(layerId).values;
  // if readiness is empty, we haven't checked it yet, so don't disable yet
  if (readiness.length === 0) {
    return false;
  }
  // if all are explicitly false, disable the layer toggle
  if (readiness.every(ready => ready === false)) {
    return true;
  }
  return false;
}

function cbarLabel(cbarScale: number, unit: string) {
  const power = cbarScale > 1 ? `10<sup>${Math.round(Math.log10(cbarScale))}</sup>` : "";
  return `${power} ${unit}`;
}

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
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

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
  padding: 2px;
}

#power-plant-filter-controls {
  box-sizing: border-box;
}
</style>
