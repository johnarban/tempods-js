<template>
  <!-- <v-dialog
    v-model="dialogOpen"
    max-width="90vw"
    max-height="90vh"
    persistent
    scrollable
  > -->
    <v-card>
      <v-toolbar
        density="compact"
        color="var(--info-background)"
      >
        <v-toolbar-title>Data Folding</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          @click="closeDialog"
        ></v-btn>
      </v-toolbar>
      
      <v-card-text class="pa-4">
        <v-row>
          <!-- Left Panel: Folding Options -->
          <v-col cols="12" md="4">
            <v-card variant="outlined" class="pa-3">
              <v-card-title class="text-h6 pa-0 mb-3">Folding Options</v-card-title>
              
              <!-- Time Window Selection -->
              <v-select
                v-model="selectedFoldType"
                :items="foldingOptions"
                label="Time Window"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Timezone Selection -->
              <div class="selected-timezone-details d-flex mb-4">
                  <v-checkbox
                    v-model="useTzCenter"
                    :label="`Use timezone of region center: ${tzCenter}`"
                    density="compact"
                    hide-details
                    class="mb-1"
                  />
                </div>
              <v-select
                v-if="!useTzCenter"
                v-model="selectedTimezone"
                :items="timezoneOptions"
                label="Timezone"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Folding Method -->
              <v-select
                v-model="selectedMethod"
                :items="methodOptions"
                label="Folding Method"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Show Errors Toggle -->
              <div class="d-flex flex-row flex-wrap">
              <v-checkbox
                v-model="showErrors"
                label="Show Errors"
                density="compact"
                :disabled="selectedMethod == 'min' || selectedMethod == 'max'"
                hide-details
                class="mb-3"
              />
              
              <v-checkbox
                v-model="useErrorBars"
                label="Use Error Bars"
                density="compact"
                hide-details
                class="mb-3"
              />
              
              <!-- Show Errors Toggle -->
              <v-checkbox
                v-model="useSEM"
                label="Use SEM"
                density="compact"
                hide-details
                class="mb-3"
              />
              
              <v-checkbox
                v-model="includeBinPhase"
                label="Use True Time"
                density="compact"
                hide-details
                class="mb-3"
              />
              
              <v-checkbox
                v-model="alignToBinCenter"
                label="Center bins"
                density="compact"
                hide-details
                class="mb-3"
              />
              </div>
              <!-- Preview Info -->
              <v-card height="fit-content" variant="tonal" class="pa-2 mb-3">
                <v-card-subtitle class="pa-0">Preview</v-card-subtitle>
                <div class="text-caption">
                  <div>Original points: {{ originalDataPointCount }}</div>
                  <div>Aggregated points: {{ foldedDataPointCount }}</div>
                  <div>Window: {{ selectedFoldType }}</div>
                </div>
              </v-card>
              
              <!-- Action Buttons -->
              <div class="d-flex ga-2">
                <v-btn
                  color="primary"
                  @click="saveFolding"
                  :disabled="!canSave"
                  size="small"
                >
                  Save Folding
                </v-btn>
                <v-btn
                  color="secondary"
                  variant="outlined"
                  @click="closeDialog"
                  size="small"
                >
                  Cancel
                </v-btn>
              </div>
            </v-card>
          </v-col>
          
          <!-- Right Panel: Timeseries Graph -->
          <v-col cols="12" md="8">
            <v-card variant="outlined" class="pa-3" style="height: 500px;">
              <v-card-title>
                Time Series Comparison
              </v-card-title>
              <div style="height: calc(100% - 40px);">
                <plotly-graph
                  :datasets="graphData"
                  :show-errors="showErrors"
                  :colors="[selection?.region.color ?? 'blue', '#333']"
                  :data-options="[
                    {mode: 'markers'}, // options for the original data
                    {mode: 'lines+markers'} // options for the folded data
                    ]"
                  :error-bar-styles="[
                    {'thickness': 1, 'width': 0}, // original data error bar style
                    { 'thickness': 3, 'width': 0 } // folded data error bar style
                  ]"
                />
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  <!-- </v-dialog> -->
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ref, computed, watch, nextTick } from 'vue';
import { v4 } from 'uuid';
import { TimeSeriesFolder, sortfoldBinContent } from '../esri/services/binningAndFoldingClasses';
import PlotlyGraph from './PlotlyGraph.vue';
import type { Prettify, UserDataset, PlotltGraphDataSet, UnifiedRegion } from '../types';
import type { AggregationMethod, TimeSeriesData, FoldedTimeSeriesData , FoldType, FoldBinContent} from '../esri/services/binningAndFoldingClasses';
import tz_lookup from '@photostructure/tz-lookup';

interface DataFoldingProps {
  selection: UserDataset | null;
}

const props = defineProps<DataFoldingProps>();

const emit = defineEmits<{
  (event: 'save', foldedSelection: UserDataset): void;
}>();

// Dialog state
const dialogOpen = defineModel<boolean>('modelValue', { type: Boolean, required: true });

// Folding options
const foldingOptions = [
  { title: 'By Hour', value: 'hourOfDay' },
  { title: 'By Day of Week', value: 'dayOfWeek' },
  { title: 'By Hour of Week', value: 'hourOfWeek' },
  { title: 'Weekday vs Weekend', value: 'weekdayWeekend' }
];

const methodOptions = [
  { title: 'Mean', value: 'mean' },
  { title: 'Median', value: 'median' },
  { title: 'Min', value: 'min' },
  { title: 'Max', value: 'max' }
];

const timezoneOptions = [
  { title: 'US/Eastern', value: 'US/Eastern' },
  { title: 'US/Central', value: 'US/Central' },
  { title: 'US/Mountain', value: 'US/Mountain' },
  { title: 'US/Arizona', value: 'US/Arizona' },
  { title: 'US/Pacific', value: 'US/Pacific' },
  { title: 'UTC', value: 'UTC' }
];

// Reactive state
const selectedFoldType = ref<FoldType>('hourOfDay');
const selectedMethod = ref<AggregationMethod>('mean');
const selectedTimezone = ref('US/Eastern');
const showErrors = ref(true);
const useSEM = ref(true);
const includeBinPhase = ref(true);
const alignToBinCenter = ref(false);
const useErrorBars = ref(false);

const regionCenter = computed(() => {
  const region = props.selection?.region as UnifiedRegion;
  
  if (region && region.geometryType === 'point') {
    return { lat: region.geometryInfo.y, lon: region.geometryInfo.x };
  }
  
  if (region && region.geometryType === 'rectangle') {
    const { xmin, ymin, xmax, ymax } = region.geometryInfo;
    return { lat: (ymin + ymax) / 2, lon: (xmin + xmax) / 2 };
  }
  
  return { lat: 0, lon: 0 };
});



const useTzCenter = ref(true);
const tzCenter = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);

if (regionCenter.value.lat !== 0 || regionCenter.value.lon !== 0) {
  const tz = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);
  if (tz && useTzCenter.value) {
    selectedTimezone.value = tz;
  }
}

watch(useTzCenter, (newVal) => {
  if (newVal && regionCenter.value.lat !== 0 && regionCenter.value.lon !== 0) {
    const tz = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);
    if (tz) {
      selectedTimezone.value = tz;
    }
  }
});

// Computed properties
const originalDataPointCount = computed(() => {
  if (!props.selection?.samples) return 0;
  return Object.keys(props.selection.samples).length;
});

const foldedDataPointCount = computed(() => {
  if (!foldedData.value) return 0;
  return Object.keys(foldedData.value.values).length;
});

const canSave = computed(() => {
  return !!(props.selection && foldedData.value && foldedDataPointCount.value > 0);
});

const foldedDatasetName = computed(() => {
  if (!props.selection?.name) return 'Folded Data';
  return `Folded ${props.selection.name ?? props.selection.region.name} (${selectedFoldType.value}, ${selectedMethod.value})`;
});

// Aggregated data
const foldedData = ref<FoldedTimeSeriesData | null>(null);
const foldedSelection = ref<null>(null);
// Graph data for display - now a ref that gets manually updated
const graphData = ref<PlotltGraphDataSet[]>([]);



function timeseriesToDataSet(timeseries: TimeSeriesData): Omit<PlotltGraphDataSet, 'name'> {
  const x: PlotltGraphDataSet['x'] = [];
  const y: PlotltGraphDataSet['y'] = [];
  const lower: PlotltGraphDataSet['lower'] = [];
  const upper: PlotltGraphDataSet['upper'] = [];

  // tsa, tsb are the timestamps as strings
  const sortedEntries = Object.entries(timeseries.values).sort(([tsa, _a], [tsb, _b]) => parseInt(tsa) - parseInt(tsb));
  // get the first timestamp
  sortedEntries.forEach(([timestamp, aggValue]) => {
    y.push(aggValue.value);
    x.push(new Date(parseInt(timestamp)));
    const error = timeseries.errors[timestamp];
    lower.push(error?.lower ?? null);
    upper.push(error?.upper ?? null);
  });

  return { x, y, lower, upper };
}

function foldedTimesSeriesToDataSet(foldedTimeSeries: FoldedTimeSeriesData): Omit<PlotltGraphDataSet, 'name'> {
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const upper: (number | null)[] = [];

  // tsa, tsb are the timestamps as strings
  const sortedEntries = Object.entries(foldedTimeSeries.bins).sort(([binIndexa, _a], [binIndexb, _b]) => parseInt(binIndexa) - parseInt(binIndexb));

  console.log(`[OLD DataFolding] foldedTimesSeriesToDataSet: bins count=${sortedEntries.length}, foldType=${foldedTimeSeries.foldType}`);

  sortedEntries.forEach(([binIndex, _binContent]) => {
    const idx = parseInt(binIndex);
    const xValue = idx + (alignToBinCenter.value ? 0.5 : 0);
    x.push(xValue);
    y.push(foldedTimeSeries.values[idx].value);
    const error = foldedTimeSeries.errors[idx];
    lower.push(error?.lower ?? null);
    upper.push(error?.upper ?? null);
  });

  console.log(`[OLD DataFolding] Aggregated output: x range=[${Math.min(...x.filter(v => v !== null) as number[])}, ${Math.max(...x.filter(v => v !== null) as number[])}], x.length=${x.length}`);
  console.log(`[OLD DataFolding] Sample x values: [${x.slice(0, 10).join(', ')}]`);
  console.log(`[OLD DataFolding] Sample y values: [${y.slice(0, 5).join(', ')}]`);

  return { x, y, lower, upper, errorType: useErrorBars.value ? 'bar' : 'band'  };
}

function checkMonotonicIncreasing(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) {
      return false;
    }
  }
  return true;
}
  
function foldedTimeSeriesRawToDataSet(foldedTimeSeries: FoldedTimeSeriesData): Omit<PlotltGraphDataSet, 'name'> {
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const upper: (number | null)[] = [];

  // tsa, tsb are the timestamps as strings
  const sortedEntries = Object.entries(foldedTimeSeries.bins).sort(([binIndexa, _a], [binIndexb, _b]) => parseInt(binIndexa) - parseInt(binIndexb));

  console.log(`[OLD DataFolding] foldedTimeSeriesRawToDataSet: bins count=${sortedEntries.length}, foldType=${foldedTimeSeries.foldType}, includeBinPhase=${includeBinPhase.value}`);

  sortedEntries.forEach(([binIndex, binContent]) => {
    const sortedBinContent = sortfoldBinContent(binContent);
    const idx = sortedBinContent.bin;
    const bins = sortedBinContent as Prettify<FoldBinContent>;
    bins.rawValues.forEach((rv, index) => {
      const xValue = bins.bin + (includeBinPhase.value ? bins.binPhase[index] : 0);
      x.push(xValue);
      y.push(rv);
    });
    bins.lowers.forEach(low => {
      lower.push(low ?? null);
    });
    bins.uppers.forEach(up => {
      upper.push(up ?? null);
    });
    // const error = foldedTimeSeries.errors[idx];
    // lower.push(error?.lower ?? null);
    // upper.push(error?.upper ?? null);
  });
  
  console.log(`[OLD DataFolding] Raw output: x range=[${Math.min(...x.filter(v => v !== null) as number[])}, ${Math.max(...x.filter(v => v !== null) as number[])}], x.length=${x.length}`);
  console.log(`[OLD DataFolding] Sample raw x values: [${x.slice(0, 10).join(', ')}]`);
  console.log(`[OLD DataFolding] Sample raw y values: [${y.slice(0, 5).join(', ')}]`);
  
  // Ensure x is strictly increasing for Plotly
  // if (!checkMonotonicIncreasing(x)) {
  //   console.error("X values are not strictly increasing, adjusting for Plotly compatibility.");
  // }
  
  return { x, y, lower, upper, errorType: 'bar' };
}

// Function to update graph data
function updateGraphData() {
  console.log("Updating graph data");
  if (!props.selection) {
    graphData.value = [];
    return;
  }
  
  // const data = [timeseriesToDataSet(selectionToTimeseries(props.selection))]; // Original data
  const data: PlotltGraphDataSet[] = [];
  
  if (foldedData.value) {
    const t = foldedTimeSeriesRawToDataSet(foldedData.value); // Raw folded data
    (t as PlotltGraphDataSet).name = props.selection.name || 'Original Data';
    data.push(t as PlotltGraphDataSet); // Raw folded data
    const f = foldedTimesSeriesToDataSet(foldedData.value); // Summary folded data
    (f as PlotltGraphDataSet).name = foldedDatasetName.value;
    data.push(f as PlotltGraphDataSet); // Summary folded data
  }
  
  graphData.value = data;
  console.log("Graph data updated with", data.length, "datasets");
  
  // Log the actual graph data for debugging - apples to apples comparison
  if (data.length > 0) {
    console.log("[OLD updateGraphData] Dataset 0 (raw):", {
      name: data[0].name,
      xLength: data[0].x.length,
      xSample: data[0].x.slice(0, 20),
      xRange: data[0].x.length > 0 ? [Math.min(...(data[0].x.filter(v => typeof v === 'number') as number[])), Math.max(...(data[0].x.filter(v => typeof v === 'number') as number[]))] : [],
      ySample: data[0].y.slice(0, 10)
    });
    
    // Create sorted version for comparison
    const indices = [...Array(data[0].x.length).keys()].sort((a, b) => {
      const xa = data[0].x[a] as number;
      const xb = data[0].x[b] as number;
      return xa - xb;
    });
    console.log("[OLD RAW SORTED] First 5 non-null values:");
    let count = 0;
    for (let i = 0; i < indices.length && count < 5; i++) {
      const idx = indices[i];
      if (data[0].y[idx] !== null) {
        console.log(`  [${count}] x=${data[0].x[idx]}, y=${data[0].y[idx]}, upper=${data[0].upper?.[idx]}`);
        count++;
      }
    }
  }
  if (data.length > 1) {
    console.log("[OLD updateGraphData] Dataset 1 (aggregated):", {
      name: data[1].name,
      xLength: data[1].x.length,
      xSample: data[1].x.slice(0, 20),
      xRange: data[1].x.length > 0 ? [Math.min(...(data[1].x.filter(v => typeof v === 'number') as number[])), Math.max(...(data[1].x.filter(v => typeof v === 'number') as number[]))] : [],
      ySample: data[1].y.slice(0, 10)
    });
    
    // Create sorted version for comparison
    const indices = [...Array(data[1].x.length).keys()].sort((a, b) => {
      const xa = data[1].x[a] as number;
      const xb = data[1].x[b] as number;
      return xa - xb;
    });
    console.log("[OLD AGGREGATED SORTED] First 5 non-null values:");
    let count = 0;
    for (let i = 0; i < indices.length && count < 5; i++) {
      const idx = indices[i];
      if (data[1].y[idx] !== null) {
        console.log(`  [${count}] x=${data[1].x[idx]}, y=${data[1].y[idx]}, upper=${data[1].upper?.[idx]}`);
        count++;
      }
    }
  }
}

// Create a time range for the folded data
function createFoldedTimeRange() {
  if (!props.selection) {
    throw new Error('No selection available');
  }
  
  const originalRange = props.selection.timeRange.range;
  const ranges = Array.isArray(originalRange) ? originalRange : [originalRange];
  
  return {
    id: v4(),
    name: `Folded (${selectedFoldType.value})`,
    description: `Folded data (${selectedFoldType.value}) ${selectedMethod.value}`,
    range: ranges,
    type: 'folded'
  };
}

// Watch for changes in folding parameters
watch([
  selectedFoldType, 
  selectedMethod, 
  selectedTimezone, 
  useSEM, 
  includeBinPhase, 
  alignToBinCenter, 
  useErrorBars
], () => {
  updateAggregatedData();
  if (useTzCenter.value && regionCenter.value.lat !== 0 && regionCenter.value.lon !== 0) {
    const tz = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);
    if (tz) {
      selectedTimezone.value = tz;
    }
  }
}, { immediate: true });

function selectionToTimeseries(selection: UserDataset): TimeSeriesData {
  return {
    values: selection.samples || {},
    errors: selection.errors || {},
    locations: selection.locations || [],
    geometryType: selection.region.geometryType || 'rectangle'
  };
}

// Update folded data when parameters change
function updateAggregatedData() {
  console.log("Updating folded data with window:", selectedFoldType.value, "method:", selectedMethod.value, "timezone:", selectedTimezone.value);
  if (!props.selection?.samples) {
    foldedData.value = null;
    return;
  }
  
  try {
    
    // Convert the selection data to TimeSeriesData format
    const timeSeriesData = selectionToTimeseries(props.selection);
    
    
    const grouper = new TimeSeriesFolder(
      selectedFoldType.value, 
      selectedTimezone.value, 
      selectedMethod.value, 
      useSEM.value ? 'sem' : 'std', true);
    foldedData.value = grouper.foldData(timeSeriesData);
      
    
    
    
    
    // foldedSelection.value = {
    //   id: v4(),
    //   region: props.selection.region,
    //   timeRange: createAggregatedTimeRange(),
    //   molecule: props.selection.molecule,
    //   samples: foldedData.value.values,
    //   errors: foldedData.value.errors,
    //   locations: foldedData.value.locations
    // };
    
  } catch (error) {
    console.error('Error aggregating data:', error);
    foldedData.value = null;
    foldedSelection.value = null;
  }
  
  // Update graph data after folding
  updateGraphData();
  console.log("graphData after update:", graphData.value);
}

// Save the folding
function saveFolding() {
  
  if (!canSave.value || !props.selection || !foldedData.value) return;
  const oldAlignToBinCenter = alignToBinCenter.value;
  // Ensure alignToBinCenter is false when saving, as we want to store raw bin indices
  alignToBinCenter.value = false;
  
  // Precompute datasets so parent consumers don't need to transform again.
  // We intentionally do NOT fabricate Dates for bins; x values remain numeric bin indices / phases.
  const rawDataset = foldedTimeSeriesRawToDataSet(foldedData.value);
  (rawDataset as PlotltGraphDataSet).name = props.selection.name || 'Original Data';
  const summaryDataset = foldedTimesSeriesToDataSet(foldedData.value);
  (summaryDataset as PlotltGraphDataSet).name = foldedDatasetName.value;

  const foldedSelection: UserDataset = {
    id: v4(),
    region: { ...props.selection.region, name: props.selection.region.name } as typeof props.selection.region,
    timeRange: createFoldedTimeRange(),
    molecule: props.selection.molecule,
    loading: false, // folded data is immediately available
    // samples/errors intentionally omitted for folded since bins are synthetic; rely on plotlyDatasets
    locations: foldedData.value.locations,
    name: foldedDatasetName.value,
    folded: {
      foldType: selectedFoldType.value,
      method: selectedMethod.value,
      timezone: selectedTimezone.value,
      useSEM: useSEM.value,
      includeBinPhase: includeBinPhase.value,
      alignToBinCenter: alignToBinCenter.value,
      useErrorBars: useErrorBars.value,
      raw: foldedData.value
    },
    plotlyDatasets: [rawDataset as PlotltGraphDataSet, summaryDataset as PlotltGraphDataSet]
  };
  console.log(foldedSelection);
  emit('save', foldedSelection);
  alignToBinCenter.value = oldAlignToBinCenter;
  closeDialog();
}

// Close dialog
function closeDialog() {
  dialogOpen.value = false;
  // Reset state
  nextTick(() => {
    foldedData.value = null;
  });
}

// Watch for selection changes
watch(() => props.selection, () => {
  if (props.selection) {
    updateAggregatedData();
  }
}, { immediate: true });
</script>

<style scoped>

</style>
