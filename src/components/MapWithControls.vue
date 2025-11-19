<template>
  <div class="map-container">
    <map-colorbar-wrap
      :horizontal="display.width.value <= 750"
      :current-colormap="currentColormap"
      :color-map="colorMap"
      :start-value="currentColorbarOptions.stretch[0] / currentColorbarOptions.cbarScale"
      :end-value="currentColorbarOptions.stretch[1] / currentColorbarOptions.cbarScale"
      :molecule-label="currentColorbarOptions.label"
      :cbar-scale="currentColorbarOptions.cbarScale"
    >
      <v-card class="map-contents" style="width:100%; height: 100%;">
        <v-toolbar
          density="compact"
          color="var(--info-background)"
        >
          <v-toolbar-title :text="`TEMPO Data Viewer: ${mapTitle}`"></v-toolbar-title>
          <!-- switch for preview points -->
          <v-tooltip :text="selectionActive === 'rectangle' ? 'Cancel selection' : 'Select a region'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-select"
                :color="selectionActive === 'rectangle' ? 'info' : 'default'"
                :variant="selectionActive === 'rectangle' ? 'tonal' : 'text'"
                :disabled="selectionActive === 'point'"
                @click="activateRectangleSelectionMode"
              ></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip :text="selectionActive === 'point' ? 'Cancel selection' : 'Select a point'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-plus"
                :color="selectionActive === 'point' ? 'info' : 'default'"
                :variant="selectionActive === 'point' ? 'tonal' : 'text'"
                :disabled="selectionActive === 'rectangle'"
                @click="activatePointSelectionMode"
              ></v-btn>
            </template>
          </v-tooltip>
        </v-toolbar>
        <EsriMap
          :mapID="mapID"
          :initial="initState"
          :home="homeState"
          :show-roads="showRoads"
          :events="{
            'moveend': updateURL,
            'zoomend': updateURL,
          }"
          :timestamp="timestamp"
          molecule="no2"
          :opacity="opacity"
          :show-field-of-regard="showFieldOfRegard"
          @zoomhome="onZoomhome"
          @ready="onMapReady"
          @esri-layer="no2Layer = $event"
          @esri-timesteps-loaded="onEsriTimestepsLoaded"
          ref="maplibreMap"
          width="100%"
          height="450px"
          maplibre-layer-name="tempo-no2"
        />

        <div v-if="showFieldOfRegard" class="map-legend"><hr class="line-legend">TEMPO Field of Regard</div>
        <!-- show hide cloud data, disable if none is available -->

        <div class="location-and-sharing">
          <location-search
            v-model="searchOpen"
            small
            stay-open
            buttonSize="xl"
            persist-selected
            :search-provider="geocodingInfoForSearchLimited"
            @set-location="setLocationFromSearch"
            @error="(error: string) => searchErrorMessage = error"
          ></location-search>
        </div>
      </v-card>
    </map-colorbar-wrap>
    <div class="slider-row mx-16 mt-12">
      <v-slider
        class="time-slider"
        v-model="timeIndex"
        :min="minIndex"
        :max="maxIndex"
        :step="1"
        color="#068ede95"
        thumb-label="always"
        :track-size="10"
        show-ticks="always"
        hide-details
        @end="() => {
          timeSliderUsedCount += 1;
          // if (map) {
          //   setLayerVisibility(map as Map, activeLayer, true);
          // }
        }"
      >
        <template v-slot:thumb-label>
          <div class="thumb-label">
            {{ thumbLabel }}
          </div>
        </template>
      </v-slider>
      <icon-button
        class="play-pause"
        :fa-icon="playing ? 'pause' : 'play'"
        fa-size="sm"
        @activate="playing = !playing"
      ></icon-button>
    </div>
    <div class="d-flex flex-row">
      <map-controls
        class="flex-grow-1"
        @molecule="(mol: MoleculeType) => {
          molecule = mol;
          // if (map) {
          //   setLayerVisibility(map as Map, activeLayer, true);
          // }
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars */
import { computed, ref, toRaw, useTemplateRef, watch, type Ref, type WritableComputedRef } from "vue";
import { useDisplay } from 'vuetify';
import { storeToRefs } from "pinia";
import { MapBoxFeature, MapBoxFeatureCollection, MapBoxFeatureType, MapBoxForwardGeocodingOptions, geocodingInfoForSearch } from "@cosmicds/vue-toolkit";
import { Map, GeoJSONSource, type StyleLayer } from "maplibre-gl";
import { getTimezoneOffset } from "date-fns-tz";
import { v4 } from "uuid";

import type { LatLngPair, PointSelectionInfo, RectangleSelectionInfo, SelectionType } from "@/types";
import { type MoleculeType, MOLECULE_OPTIONS } from "@/esri/utils";
import { colorbarOptions } from "@/esri/ImageLayerConfig";
import { colormap } from "@/colormaps/utils";
import { useTempoStore } from "@/stores/app";
import { useLocationMarker } from "@/composables/maplibre/useMarker";
import { useRectangleSelection } from "@/composables/maplibre/useRectangleSelection";
import { addRectangleLayer, addPointLayer, regionBounds, fitBounds, removeRectangleLayer, removePointLayer } from "@/composables/maplibre/utils";
import { usePointSelection } from "@/composables/maplibre/usePointSelection";
import { COLORS } from "@/utils/color";
import { EsriSampler } from "@/esri/services/sampling";
import { useMultiMarker } from '@/composables/maplibre/useMultiMarker';

import { setLayerOpacity, setLayerVisibility } from "@/maplibre_controls";

import EsriMap from "@/components/EsriMap.vue";
import MapColorbarWrap from "@/components/MapColorbarWrap.vue";

type MapType = Map | null;
type MapTypeRef = Ref<MapType>;
const maplibreMap = useTemplateRef<InstanceType<typeof EsriMap>>("maplibreMap");
const map = ref<MapType>(null);

type Timeout = ReturnType<typeof setTimeout>;

const mapID = `map-${v4().replace("-", "")}`;

const store = useTempoStore();
const {
  regions,
  regionOpacity,
  regionVisibility,
  timestamp,
  timeIndex,
  minIndex,
  maxIndex,
  date,
  selectedTimezone,
  timeSliderUsedCount,
  playButtonClickedCount,
  timestamps,
  timestampsLoaded,
  selectionActive,
  regionsCreatedCount,
  maxSampleCount,
  focusRegion,
  initState,
  homeState,
  showFieldOfRegard,
  showRoads,
  showSamplingPreviewMarkers,
  singleDateSelected,
  showAdvancedLayers,
  showRGBMode,
} = storeToRefs(store);

const molecule = ref<MoleculeType>("no2");
const currentTempoDataService = computed(() => store.getTempoDataService(molecule.value));

function createSelectionComputed(selection: SelectionType): WritableComputedRef<boolean> {
  return computed({
    get() {
      return selectionActive.value === selection;
    },
    set(value: boolean) {
      if (value === (selectionActive.value !== selection)) {
        selectionActive.value = value ? selection : null;
      }
    },
  });
}

const pointSelectionActive = createSelectionComputed("point");
const rectangleSelectionActive = createSelectionComputed("rectangle");

const { selectionInfo: rectangleInfo } = useRectangleSelection(map as MapTypeRef, "red", rectangleSelectionActive);
const { selectionInfo: pointInfo } = usePointSelection(map as MapTypeRef, pointSelectionActive);

type UnifiedRegionType = typeof regions.value[number];

const display = useDisplay();

import { addPowerPlants } from "@/composables/addPowerPlants";
import { addHMSFire } from "@/composables/addHMSFire";

const pp = addPowerPlants(map as Ref<Map | null> | null, false);
import { addQUI } from '@/composables/addAQI';

// base it of singleDateSelected
const airQualityUrl = computed(() => {
  const date = store.singleDateSelected;
  if (!date) {
    return 'https://s3-us-west-1.amazonaws.com/files.airnowtech.org/airnow/2025/20250914/KMLPointMaps_PM2.5-24hr.kml';
  }

  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `https://s3-us-west-1.amazonaws.com/files.airnowtech.org/airnow/${year}/${year}${month}${day}/KMLPointMaps_PM2.5-24hr.kml`;
});
const aqiLayer = addQUI(airQualityUrl.value, { 
  propertyToShow: 'aqi', 
  labelMinZoom: 5, 
  layerName: 'aqi', 
  visible: false,
  showLabel: true, 
  showPopup: true
});

// Ensure date/url changes trigger a reload, even if initial load failed
watch(airQualityUrl, (newUrl) => {
  aqiLayer.setUrl(newUrl).catch(() => {/* ignore */});
});


import { addPopulationDensityLayer } from '@/composables/addPopulationDensity';
const popLayer = addPopulationDensityLayer();

import { addLandUseLayer } from "@/composables/addLandUse";
const sentinalLandUseLayer = addLandUseLayer();

const hmsFire = addHMSFire(singleDateSelected, {
  layerName: 'hms-fire',
  visible: false,
  showPopup: true,
  showLabel: false,
});

import { type UseEsriLayer, useEsriLayer } from "@/esri/maplibre/useEsriImageLayer";
// just use the hcho layer for now
const hchoLayer = useEsriLayer('hcho', timestamp, 1, true, 'tempo-hcho', false);
const ozoneLayer = useEsriLayer('o3', timestamp, 1, true, 'tempo-o3', false);
const no2Layer = ref<UseEsriLayer | null>(null);

function addAdvancedLayers(m: Map | null) {
  if (m === null) return;
  // pp.addheatmapLayer();
  // pp.togglePowerPlants(false);
  aqiLayer.addToMap(m);
  popLayer.addEsriSource(m);
  sentinalLandUseLayer.addEsriSource(m);
  hmsFire.addToMap(m);
  hchoLayer.addEsriSource(m);
  ozoneLayer.addEsriSource(m);
  // Only move if target layer exists (avoid errors if initial KML load failed)
  try {
    if (m.getLayer('kml-layer-aqi')) {
      m.moveLayer('states-custom','kml-layer-aqi');
    }
  } catch {
    // ignore
  }
  
  pp.addLayer();
  // pp.togglePowerPlants(false);
}

function removeAdvancedLayers(m: Map | null) {
  if (m === null) return;
  aqiLayer.removeFromMap(m);
  popLayer.removeEsriSource();
  sentinalLandUseLayer.removeEsriSource();
  hmsFire.removeFromMap(m);
  hchoLayer.removeEsriSource();
  ozoneLayer.removeEsriSource();
  pp.removeLayer();
}

const onMapReady = (m: Map) => {
  console.log('Map ready event received');
  map.value = m; // ESRI source already added by EsriMap
  if (showAdvancedLayers.value) addAdvancedLayers(m);
  updateRegionLayers(regions.value);
};

watch(showAdvancedLayers, (value) => {
  if (value) {
    addAdvancedLayers(map.value as Map | null);
    return;
  }
  removeAdvancedLayers(map.value as Map | null);
  
  
});

watch(molecule, (newMolecule) => {
  if (map.value) {
    hchoLayer.setVisibility(newMolecule === 'hcho');
    ozoneLayer.setVisibility(newMolecule === 'o3');
    no2Layer.value?.setVisibility(newMolecule === 'no2');
    // map.value.moveLayer(`tempo-${newMolecule}`, 'tempo-no2');
  }
});

const activeLayer = computed(() => `tempo-${molecule.value}`);

import { stretches, colorramps, type ColorRamps } from "@/esri/ImageLayerConfig";
const rgbstretches = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'NO2_Troposphere': [0, 7_500_000_000_000_000],
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'Ozone_Column_Amount': [250, 430], // +- 2 sigma
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'HCHO': [1_000_000_000_000_000, 15_000_000_000_000_000],
} as Record<string, [number, number]>;
const rgbcolorramps = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'NO2_Troposphere': 'magentafromwhite',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'Ozone_Column_Amount': 'cyanfromwhite', 
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'HCHO': 'yellowfromwhite',
} as Record<string, ColorRamps>;
  
watch(showRGBMode, (cMode) => {
  
  hchoLayer.renderOptions.value.colormap = (cMode ? rgbcolorramps : colorramps)['HCHO'];
  ozoneLayer.renderOptions.value.colormap = (cMode ? rgbcolorramps : colorramps)['Ozone_Column_Amount'];
  if (no2Layer.value) {
    no2Layer.value.renderOptions.colormap = (cMode ? rgbcolorramps : colorramps)['NO2_Troposphere'];
  }
  hchoLayer.renderOptions.value.range = (cMode ? rgbstretches : stretches)['HCHO'];
  ozoneLayer.renderOptions.value.range = (cMode ? rgbstretches : stretches)['Ozone_Column_Amount'];
  if (no2Layer.value) {
    no2Layer.value.renderOptions.range = (cMode ? rgbstretches : stretches)['NO2_Troposphere'];
  }

});

const showLocationMarker = ref(true);
const {
  setMarker,
  removeMarker,
  locationMarker,
} = useLocationMarker(map as Ref<Map | null>, showLocationMarker.value);

const opacity = ref(0.9);
const playing = ref(false);
const playInterval = ref<Timeout | null>(null);


const searchOpen = ref(true);
const searchErrorMessage = ref<string | null>(null);
function activateRectangleSelectionMode() {
  rectangleSelectionActive.value = !rectangleSelectionActive.value;
}

function activatePointSelectionMode() {
  pointSelectionActive.value = !pointSelectionActive.value;
}

const regionLayers: Record<string, GeoJSONSource> = {};

// const colorMap = computed(() => colorbarOptions[molecule.value].colormap.toLowerCase());
const colorMap = computed(() => {
  const mol = molecule.value == 'no2' 
    ? 'NO2_Troposphere' : molecule.value == 'hcho' 
      ? 'HCHO' : 'Ozone_Column_Amount';
  return showRGBMode.value ? rgbcolorramps[mol].toLowerCase() : colorramps[mol].toLowerCase();
});

type ColorbarOptionsKey = keyof typeof colorbarOptions;
const currentColorbarOptions = computed<typeof colorbarOptions[ColorbarOptionsKey]>(() => {
  const mol = molecule.value == 'no2' 
    ? 'NO2_Troposphere' : molecule.value == 'hcho' 
      ? 'HCHO' : 'Ozone_Column_Amount';
  return {
    ...colorbarOptions[molecule.value],
    colormap: showRGBMode.value ? rgbcolorramps[mol] : colorramps[mol],
    stretch: showRGBMode.value ? rgbstretches[mol] : stretches[mol],
  };
});

watch(currentColorbarOptions, (cc) => {
  console.log('current colorbar options changed to', cc);
});

const currentColormap = computed(() => {
  return (x: number): string => {
    let rgb: number[] = [128, 128, 128];
    try {
      rgb = colormap(colorMap.value as AllAvailableColorMaps, 0, 1, x);
    }
    catch {
      console.log("no valid colormap. returning gray");
    }
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]},1)`;
  };
});

watch(colorMap, (value) => {
  console.log('color map changed to', value);
});

const mapTitle = computed(() => {
  const currentMolecule = MOLECULE_OPTIONS.find(m => m.value === molecule.value);
  if (!currentMolecule) {
    return '';
  }
  return currentMolecule.title;
});

// TODO: Maybe there's a built-in Date function to get this formatting?
const thumbLabel = computed(() => {
  if (date.value === null || timestamp.value === null) {
    return '';
  }
  const offset = getTimezoneOffset(selectedTimezone.value, date.value);
  const dateObj = new Date(timestamp.value + offset);
  const hours = dateObj.getUTCHours();
  const amPm = hours >= 12 ? "PM" : "AM";
  let hourValue = hours % 12;
  if (hourValue === 0) {
    hourValue = 12;
  }
  return `${date.value.getUTCMonth() + 1}/${dateObj.getUTCDate()}/${dateObj.getUTCFullYear()} ${hourValue}:${dateObj.getUTCMinutes().toString().padStart(2, '0')} ${amPm}`;
});

const defaultMapboxOptions = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  types: ["place", "postcode"] as MapBoxFeatureType[],
  countries: ["US", "CA", "MX", "CU", "BM", "HT", "DO"],
  limit: 5,
};
async function geocodingInfoForSearchLimited(searchText: string, options?: MapBoxForwardGeocodingOptions): Promise<MapBoxFeatureCollection | null> {
  const token = process.env.VUE_APP_MAPBOX_ACCESS_TOKEN;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const opts = options ?? { ...defaultMapboxOptions, access_token: token ?? "" };
  return geocodingInfoForSearch(searchText, opts).catch(_err => null);
}

function setLocationFromSearch(items: [MapBoxFeature | null, string]) {
  const [feature, text] = items;
  if (feature !== null) {
    // Latitude, Longitude order
    const coordinates: LatLngPair = [feature.center[1], feature.center[0]] as LatLngPair;
    maplibreMap.value?.setView(coordinates, 12);
    setMarker(coordinates);
    store.userSelectedLocations.push(text);
  }
}

function onZoomhome() {
  if (locationMarker.value !== null) {
    removeMarker();
  }
}

const currentUrl = ref(window.location.href);
function updateURL() {
  if (map.value) {
    const center = map.value.getCenter();
    let stateObj = null as Record<string, string> | null;
    stateObj = {
      lat: `${center.lat.toFixed(4)}`,
      lon: `${center.lng.toFixed(4)}`,
      zoom: `${map.value.getZoom()}`,
      t: `${timestamp.value}`
    };
    const url = new URL(location.origin);
    const searchParams = new URLSearchParams(stateObj ?? {});
    // const hash = window.location.hash;
    // url.hash = hash;
    url.pathname = location.pathname;
    window.history.replaceState(null, '', url.toString());
    url.search = searchParams.toString();
    currentUrl.value = url.toString();
    // window.history.replaceState(stateObj, '', url);
  }
}

// ESRI timesteps arrive from EsriMap component; store directly in timestamps
function onEsriTimestepsLoaded(steps: number[]) {
  if (!Array.isArray(steps) || steps.length === 0) return;
  const sorted = steps.slice().sort();
  timestamps.value = sorted;
  if (timeIndex.value >= sorted.length) {
    timeIndex.value = 0;
  }
  timestampsLoaded.value = true;
}

watch(playing, (val: boolean) => {
  if (val) {
    play();
    playButtonClickedCount.value += 1;
  } else {
    pause();
  }
});

function play() {
  playInterval.value = setInterval(() => {
    if (timeIndex.value >= maxIndex.value) {
      if (playInterval.value) {
        // clearInterval(this.playInterval);
        // this.playInterval = null;
        // let it loop
        timeIndex.value = minIndex.value;
      }
    } else {
      timeIndex.value += 1;
    }
  }, 1000);
}


function pause() {
  if (playInterval.value) {
    clearInterval(playInterval.value);
  }
}

function rectangleIsDegenerate(info: RectangleSelectionInfo): boolean {
  return info.xmax === info.xmin || info.ymax === info.ymin;
}

function addLayer(
  info: RectangleSelectionInfo | PointSelectionInfo,
  geometryType: "rectangle" | "point",
  color: string,
): { layer: GeoJSONSource } {
  const isRect = geometryType === 'rectangle';
  const layerInfo = isRect ?
    addRectangleLayer((map.value as MapType)!, info as RectangleSelectionInfo, color, regionOpacity.value, regionVisibility.value) :
    addPointLayer((map.value as MapType)!, info as PointSelectionInfo, color, regionVisibility.value);
  map.value?.moveLayer(layerInfo.layer.id);
  return layerInfo;
}

function removeLayer(
  layer: StyleLayer,
  geometryType: "rectangle" | "point",
) {
  const isRect = geometryType === 'rectangle';
  if (isRect) {
    removeRectangleLayer((map.value as MapType)!, layer);
  } else {
    removePointLayer((map.value as MapType)!, layer);
  }
}

function createRegion(info: RectangleSelectionInfo | PointSelectionInfo, geometryType: "rectangle" | "point"): UnifiedRegionType {
  const color = COLORS[regionsCreatedCount.value % COLORS.length];
  regionsCreatedCount.value += 1;

  const id = v4();
  const { layer } = addLayer(info, geometryType, color);
  regionLayers[id] = layer;
  return {
    id,
    name: `${geometryType === "rectangle" ? 'Region' : 'Point'} ${regionsCreatedCount.value}`,
    geometryInfo: toRaw(info),
    geometryType: geometryType,
    color,
  };
}

function getRegionsDifference(arr1: UnifiedRegionType[], arr2: UnifiedRegionType[]): UnifiedRegionType[] {
  const ids2 = arr2.map(r => r.id);
  return arr1.filter(element => !ids2.includes(element.id));
}

let existingRegions: UnifiedRegionType[] = [];
function updateRegionLayers(newRegions: UnifiedRegionType[]) {
  const added = getRegionsDifference(newRegions, existingRegions);
  const removed = getRegionsDifference(existingRegions, newRegions);
  added.forEach(region => {
    if (map.value && !regionLayers[region.id]) {
      const { layer } = addLayer(region.geometryInfo, region.geometryType, region.color);
      regionLayers[region.id] = layer;
    }
  });

  removed.forEach(region => {
    if (map.value && regionLayers[region.id]) {
      removeLayer(regionLayers[region.id] as unknown as StyleLayer, region.geometryType);
      delete regionLayers[region.id];
    }
  });
  existingRegions = [...newRegions];
}

watch(regions, updateRegionLayers, { deep: true });

watch(regionOpacity, (opacity: number) => {
  if (map.value !== null) {
    Object.values(regionLayers).forEach(layer => {
      setLayerOpacity(map.value as Map, layer.id, opacity);
    });
    setLayerOpacity(map.value as Map, "predicted-samples-locations-layer", opacity);
  }
});

watch(regionVisibility, (visible: boolean) => {
  if (map.value !== null) {
    Object.values(regionLayers).forEach(layer => {
      setLayerVisibility(map.value as Map, layer.id, visible);
    });
    setLayerVisibility(map.value as Map, "predicted-samples-locations-layer", visible);
  }
});

watch(rectangleInfo, (info: RectangleSelectionInfo | null) => {
  if (info === null || map.value === null) {
    rectangleSelectionActive.value = false;
    return;
  }
  if (rectangleIsDegenerate(info)) {
    // make it a point selection instead
    // TODO: only implement when we have a solution to only do this on a double-click
    // pointInfo.value = {
    //   x: info.xmin,
    //   y: info.ymin
    // };
    rectangleSelectionActive.value = false;
    return;
  }

  const newRegion = createRegion(info, "rectangle");
  store.addRegion(newRegion);
  rectangleSelectionActive.value = false;
  
  // do not permit editing a region on a selection
  // handleSelectionRegionEdit(info);
  

});

// Add watcher for point selection
watch(pointInfo, (info: PointSelectionInfo | null) => {
  if (info === null || map.value === null) {
    pointSelectionActive.value = false;
    return;
  }
  const newRegion = createRegion(info, "point"); 
  store.addRegion(newRegion);
  pointSelectionActive.value = false;
});

const samplingPreviewMarkers = useMultiMarker(map as MapTypeRef , {
  shape: 'circle',
  color: '#0000ff',
  fillColor: '#0000ff',
  fillOpacity: 0.5,
  opacity: regionOpacity.value,
  radius: 0.02 / 2, // degrees
  scale: 'world',
  outlineColor: '#0000ff',
  label: 'predicted-samples-locations'
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const sampler = ref<EsriSampler>(null);
currentTempoDataService.value.withMetadataCache().then(meta => {
  sampler.value = new EsriSampler(meta);
});

watch([showSamplingPreviewMarkers, regions, ()=> regions.value.length], (newVal) => {
  const tempoDataService = currentTempoDataService.value;
  const show = newVal[0];
  const regs = newVal[1];
  samplingPreviewMarkers.clearMarkers();
  let locations: {x: number, y:number}[] = [];
  if (sampler.value && show && regs.length > 0) {
    regs.forEach(r => {
      if (r.geometryType === 'rectangle') {
        sampler.value.setGeometry(r.geometryInfo);
        if (tempoDataService.meta) {
          sampler.value.setMetadata(tempoDataService.meta);
        }
        locations = [...locations, ...sampler.value.getSampleLocationsGrid(maxSampleCount.value)];
        // samplingPreviewMarkers.addMarkers(locations);
      }
    });
    samplingPreviewMarkers.addMarkers(locations);
  }
});

// TODO: This may need to be revisited when there are two maps
watch(focusRegion, region => {
  if (region !== null) {
    const bounds = regionBounds(region);
    fitBounds(map.value, bounds, true);
    focusRegion.value = null;
  }
});

</script>

<style lang="less">
.map-container {
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px;

  .location-and-sharing {
    position: absolute;
    bottom: 0;
    z-index: 1000;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
  }

  .forward-geocoding-container {
    width: 250px;
    border: 2px solid black;
  }

  .map-show-hide-controls {
    z-index: 1000;
    position: absolute;
    top: calc(48px + 1rem);
    right: 80px;
  }

  .map-legend {
    position: absolute;
    top: 48px;
    right: 80px;
    width: fit-content;
    z-index: 1000;

    display: flex;
    align-items: center;
    gap: 0.5rem;

    color: black;
    background-color: #fff5;
    padding-left: 0.5rem;
    padding-right: 0.25rem;

    backdrop-filter: blur(5px);

    hr.line-legend {
      display: inline-block;
      border: 0.5px solid #c10124;
      width: 3rem;
    }
  }

  .controls-card {
    padding: 1rem;
    border: 1px solid #068ede;
  }

  .slider-row {
    display: flex;
    flex-direction: row;
    padding-left: 0;
  }

  >.play-pause {
    height: fit-content;
    align-self: center;
    padding-inline: 0.5rem;
    margin-left: 0.75rem;
    width: 2.5rem;
    color: var(--accent-color);
    border: 2px solid var(--accent-color);
  }

  .play-pause[disabled] {
    filter: grayscale(100%);
    cursor: progress;
    cursor: not-allowed;
  }

  .icon-wrapper {
    padding-inline: 0.5rem !important;
  }
}

.time-slider {

  .v-slider-thumb {

    .v-slider-thumb__surface::after {
      background-image: url("@/assets/smithsonian.png");
      background-size: 30px 30px;
      height: 30px;
      width: 30px;
    }

    .v-slider-thumb__label {
      background-color: var(--accent-color-2);
      border: 0.25rem solid var(--accent-color);
      width: max-content;
      height: 2.5rem;
      font-size: 1rem;

      &::before {
        color: var(--accent-color);
      }
    }
  }

  .v-slider-track__tick {
    background-color: var(--accent-color);
    /* Change color */
    height: 15px;
    /* Change size */
    width: 4px;
    margin-top: 0 !important;
    // top: -10%;
  }

  .v-slider {

    .v-slider.v-input--horizontal {
      grid-template-rows: auto 0px;
    }

    .v-slider.v-input--horizontal .v-slider-thumb__label {
      // top: calc(var(--v-slider-thumb-size) * 1.5);
      z-index: 2000;
    }

    .v-slider.v-input--horizontal .v-slider-thumb__label::before {
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-top: 6px solid currentColor;
      bottom: -15px;
    }
  }
}

#opacity-slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-left: 7%;
  padding-right: 7%;
  gap: 2px;

  .v-slider {
    margin-right: 0;
    width: 100%;
  }

  #opacity-slider-label {
    opacity: 0.7;
    width: fit-content;
  }
}

.hms-popup {
  font-size: 14px;
  line-height: 1.4;
  max-width: 200px;
  color: black;
}

@import "@/styles/maplibre-layer-control.css";
</style>
