<template>
    <v-card>
      <v-toolbar
        density="compact"
        color="var(--info-background)"
      >
        <v-toolbar-title>Data Aggregation</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          @click="closeDialog"
        ></v-btn>
      </v-toolbar>
      
      <v-card-text class="pa-4">
        <v-row>
          <!-- Left Panel: Aggregation Options -->
          <v-col cols="12" md="4">
            <v-card variant="outlined" class="pa-3">
              <v-card-title class="text-h6 pa-0 mb-3">Aggregation Options</v-card-title>
              
              <!-- Time Window Selection -->
              <v-select
                v-model="selectedWindow"
                :items="windowOptions"
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
              
              <!-- Aggregation Method -->
              <v-select
                v-model="selectedMethod"
                :items="methodOptions"
                label="Aggregation Method"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Show Errors Toggle -->
              <v-checkbox
                v-model="showErrors"
                label="Show Error Bands"
                :disabled="selectedMethod == 'min' || selectedMethod == 'max'"
                density="compact"
                hide-details
                class="mb-3"
              />
              
              <!-- Original Error Display -->
              <v-select
                v-model="originalErrorType"
                :items="errorTypeItems"
                label="Original Error Display"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Aggregated Error Display -->
              <v-select
                v-model="aggregatedErrorType"
                :items="errorTypeItems"
                label="Aggregated Error Display"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-3"
              />
              
              <!-- Use Standard Errors Toggle -->
              <v-checkbox
                v-model="useSEM"
                label="Use SEM"
                density="compact"
                hide-details
                class="mb-3"
              />
              
              <!-- Preview Info -->
              <v-card height="fit-content" variant="tonal" class="pa-2 mb-3">
                <v-card-subtitle class="pa-0">Preview</v-card-subtitle>
                <div class="text-caption">
                  <div>Original points: {{ originalDataPointCount }}</div>
                  <div>Aggregated points: {{ aggregatedDataPointCount }}</div>
                  <div>Window: {{ selectedWindow }}</div>
                </div>
              </v-card>
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
                  :colors="[selection?.region.color ?? 'blue', '#444']"
                  :data-options="dataOptions"
                  :error-bar-styles="[
                    originalErrorType === 'bar' ? { thickness: 1, width: 0} : null,
                    aggregatedErrorType === 'bar' ? { thickness: 3, width: 0 } : null
                  ]"
                />
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <div class="d-flex ga-2">
          <v-btn
            color="primary"
            @click="saveAggregation"
            :disabled="!canSave"
            size="small"
          >
            Save Aggregation
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
      </v-card-actions>
    </v-card>


  
</template>

<script setup lang="ts">
// Generated by Copilot
import { ref, computed, watch, nextTick } from 'vue';
import { v4 } from 'uuid';
import { TimeSeriesResampler } from '../esri/services/binningAndFoldingClasses';
import PlotlyGraph from './PlotlyGraph.vue';
import type { UserDataset, TimeRange, UnifiedRegion } from '../types';
import type { AggregationMethod, TimeSeriesData} from '../esri/services/binningAndFoldingClasses';
import type { PlotltGraphDataSet } from '../types';
import type { Data } from 'plotly.js-dist-min';
import tz_lookup from '@photostructure/tz-lookup';

interface DataAggregationProps {
  selection: UserDataset | null;
}

const props = defineProps<DataAggregationProps>();

const emit = defineEmits<{
  (event: 'save', aggregatedSelection: UserDataset): void;
}>();

// Dialog state
const dialogOpen = defineModel<boolean>('modelValue', { type: Boolean, required: true });

// Aggregation options
const windowOptions = [
  { title: 'Daily', value: '1d' },
  { title: 'Weekly', value: '1w' },
  { title: 'Monthly', value: '1m' }
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
const selectedWindow = ref('1d');
const selectedMethod = ref<AggregationMethod>('mean');
const selectedTimezone = ref('US/Eastern');
const showErrors = ref(true);
const useSEM = ref(true);
const originalErrorType = ref<'band' | 'bar'>('bar');
const aggregatedErrorType = ref<'band' | 'bar'>('bar');
const errorTypeItems = [
  { title: 'Error Band', value: 'band' },
  { title: 'Error Bars', value: 'bar' }
];


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

const aggregatedDataPointCount = computed(() => {
  if (!aggregatedData.value) return 0;
  return Object.keys(aggregatedData.value.values).length;
});

const canSave = computed(() => {
  return props.selection && aggregatedData.value && aggregatedDataPointCount.value > 0;
});

// Aggregated data
const aggregatedData = ref<TimeSeriesData | null>(null);
const aggregatedSelection = ref<UserDataset | null>(null);
// Graph data for display - now a ref that gets manually updated
const graphData = ref<PlotltGraphDataSet[]>([]);

// Per-dataset visual overrides (match length of graphData)
const dataOptions = computed<Partial<Data>[]>(() => {
  const opts: Partial<Data>[] = [];
  if (graphData.value.length > 0) {
    opts.push({ mode: 'markers' }); // Original selection (markers only)
  }
  // keep lines for aggregated data
  if (graphData.value.length > 1) {
    opts.push({ mode: 'lines+markers' }); 
  }
  return opts;
});


function selectionSamplesToDataSet(selection: UserDataset, errorType: 'band' | 'bar'): Omit<PlotltGraphDataSet, 'name'> {
  return timeSeriesDataToDataSet(selectionToTimeseries(selection), errorType);
}

function timeSeriesDataToDataSet(timeseries: TimeSeriesData, errorType: 'band' | 'bar'): Omit<PlotltGraphDataSet, 'name'> {
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
  return { x, y, lower, upper, errorType };
}

// Function to update graph data
function updateGraphData() {
  console.log("Updating graph data");
  if (!props.selection) {
    graphData.value = [];
    return;
  }
  const o = selectionSamplesToDataSet(props.selection, originalErrorType.value);
  (o as PlotltGraphDataSet).name = props.selection.name || 'Original Data';
  const data = [o as PlotltGraphDataSet];
  
  if (aggregatedData.value) {
    const t= timeSeriesDataToDataSet(aggregatedData.value, aggregatedErrorType.value);
    (t as PlotltGraphDataSet).name = aggregatedSelection.value?.name || 'Aggregated Data';
    data.push(t as PlotltGraphDataSet);
  }
  
  graphData.value = data;
  console.log("Graph data updated with", data.length, "datasets");
}

// Create a time range for the aggregated data
function createAggregatedTimeRange(): TimeRange {
  if (!props.selection) {
    throw new Error('No selection available');
  }
  
  const originalRange = props.selection.timeRange.range;
  const ranges = Array.isArray(originalRange) ? originalRange : [originalRange];
  
  return {
    id: v4(),
    name: `Aggregated (${selectedWindow.value})`,
    description: `Aggregated data with ${selectedWindow.value} window`,
    range: ranges,
    type: 'aggregated'
  };
}

// Watch for changes in aggregation parameters
watch([selectedWindow, selectedMethod, selectedTimezone, useSEM], () => {
  updateAggregatedData();
}, { immediate: true });

function selectionToTimeseries(selection: UserDataset): TimeSeriesData {
  return {
    values: selection.samples || {},
    errors: selection.errors || {},
    locations: selection.locations || [],
    geometryType: selection.region.geometryType || 'rectangle'
  };
}

// Update aggregated data when parameters change
function updateAggregatedData() {
  console.log("Updating aggregated data with window:", selectedWindow.value, "method:", selectedMethod.value, "timezone:", selectedTimezone.value);
  if (!props.selection?.samples) {
    aggregatedData.value = null;
    aggregatedSelection.value = null;
    graphData.value = [];
    return;
  }
  
  
  
  try {
    
    // Convert the selection data to TimeSeriesData format
    const timeSeriesData = selectionToTimeseries(props.selection);
    
    
    const grouper = new TimeSeriesResampler(
      selectedWindow.value,
      selectedTimezone.value,
      selectedMethod.value,
      useSEM.value ? 'sem' : 'std', true);
    aggregatedData.value = grouper.groupData(timeSeriesData);
      
    
    
    
    
    aggregatedSelection.value = {
      id: v4(),
      region: {...props.selection.region, color: '#444', name: 'Aggregated'  } as typeof props.selection.region, // Different color for aggregated
      timeRange: createAggregatedTimeRange(),
      molecule: props.selection.molecule,
      samples: aggregatedData.value.values,
      errors: aggregatedData.value.errors,
      locations: aggregatedData.value.locations
    };
    
  } catch (error) {
    console.error('Error aggregating data:', error);
    aggregatedData.value = null;
    aggregatedSelection.value = null;
  }
  
  // Update graph data after aggregation
  updateGraphData();
}
const aggDatasetName = computed(() => {
  if (!props.selection?.name) return 'Binned Data';
  return `Aggregated ${props.selection.name} (${selectedWindow.value}, ${selectedMethod.value})`;
});

// Save the aggregation
function saveAggregation() {
  if (!canSave.value || !props.selection) return;
  
  const aggregatedSelection: UserDataset = {
    id: v4(),
    region: props.selection.region,
    timeRange: createAggregatedTimeRange(),
    molecule: props.selection.molecule,
    samples: aggregatedData.value!.values,
    errors: aggregatedData.value!.errors,
    locations: aggregatedData.value!.locations,
    name: aggDatasetName.value,
  };
  
  emit('save', aggregatedSelection);
  closeDialog();
}

// Close dialog
function closeDialog() {
  dialogOpen.value = false;
  // Reset state
  nextTick(() => {
    aggregatedData.value = null;
  });
}

// Watch for selection changes
watch(() => props.selection, () => {
  if (props.selection) {
    updateAggregatedData();
    if (useTzCenter.value && regionCenter.value.lat !== 0 && regionCenter.value.lon !== 0) {
      const tz = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);
      if (tz) {
        selectedTimezone.value = tz;
      }
    }
  }
}, { immediate: true });

// Watch error type selects
watch([originalErrorType, aggregatedErrorType], () => updateGraphData());
</script>

<style scoped>
</style>
