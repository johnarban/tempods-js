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
              
              
              <!-- Folding Period Selection -->
              <v-select
              v-model="selectedFoldingPeriod"
              :items="foldingPeriodOptions"
              label="Folding Period"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-3"
              />
              
              <!-- Time Bin Selection -->
              <v-select
                v-model="selectedTimeBin"
                :items="timeBinOptions"
                label="Time Bin"
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
                  <div>Time Bin: {{ selectedTimeBin }}</div>
                  <div>Folding Period: {{ selectedFoldingPeriod }}</div>
                  <div>FoldedDate PeriodMs: {{ foldedData?.periodMs }}</div>
                  <div>Epoch Start: {{ foldedData?.epochStart }}</div>
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
                <plotly-graph
                  v-if="foldedData && foldedData.x && foldedData.y"
                  :datasets="[
                    { 
                      name: 'Folded Data',
                      x: foldedData.x,
                      y: foldedData.y
                    }
                  ]"
                  :show-errors="false"
                  :colors="['#333']"
                  :data-options="[
                    {mode: 'markers'}, // options for the original data
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
import { timeSeriesBinner } from '../utils/array_operations/binData';
import { timeSeriesFolder, timeseriesFoldAndBin } from '../utils/array_operations/foldData';
import { 
  userDatasetToArrays,
  resampledDataToPlotly,
  foldedDataRawToPlotly,
  foldedDataAggregatedToPlotly,
  getFoldedDataPointCount
} from '../esri/services/dataAdapters';
import type { BinSizes, FoldPeriods } from '../utils/calendar_utils';
import type { ResampledData } from '../utils/array_operations/binData';
import type { FoldedData } from '../utils/array_operations/foldData';
import PlotlyGraph from './PlotlyGraph.vue';
import type { Prettify, UserDataset, PlotltGraphDataSet, UnifiedRegion } from '../types';
import tz_lookup from '@photostructure/tz-lookup';
import { PerformanceLogger } from '@/utils/performance';

interface DataFoldingProps {
  selection: UserDataset | null;
}

const props = defineProps<DataFoldingProps>();

const emit = defineEmits<{
  (event: 'save', foldedSelection: UserDataset): void;
}>();

// Dialog state
const dialogOpen = defineModel<boolean>('modelValue', { type: Boolean, required: true });




// Time bin and folding period options
const timeBinOptions: {title: string, value: BinSizes}[] = [
  { title: 'Hour', value: 'hour' },
  { title: 'Day', value: 'day' },
  { title: 'Week', value: 'week' },
  { title: 'Month', value: 'month' },
  { title: 'Weekend/Weekday', value: 'weekendweekday' },
  { title: 'No binning', value: 'none' }  // Added option for no binning
];

const allFoldingPeriodOptions: {title: string, value: FoldPeriods}[] = [
  { title: 'Day', value: 'day' },
  { title: 'Week', value: 'week' },
  { title: 'Year', value: 'year' },
  { title: 'Weekday/Weekend', value: 'weekendweekday' },
  { title: 'No folding', value: 'none' },
];

// Computed property to filter valid folding periods based on selected time bin
const foldingPeriodOptions = computed(() => {
  const timeBin = selectedTimeBin.value;
  
  // Define valid combinations (removed month and season)
  // Record<BinSizes, FoldPeriods[]>
  const validCombinations: Record<'hour' | 'day' | 'week' | 'month' | 'none' | 'weekendweekday', FoldPeriods[]> = {
    'hour': ['day', 'week', 'year', 'none', 'weekendweekday'],
    'day': ['week', 'year', 'none'],
    'week': ['year', 'none'],
    'month': ['year', 'none'],
    'none': ['day', 'week', 'year', 'none', 'weekendweekday'],
    'weekendweekday': ['week','weekendweekday', 'none']
  };
  
  const validPeriods = validCombinations[timeBin] || [];
  return allFoldingPeriodOptions.filter(option => validPeriods.includes(option.value));
});


const methodOptions = [
  { title: 'Mean', value: 'mean' },
  { title: 'Median', value: 'median' },
  { title: 'Min', value: 'min' },
  { title: 'Max', value: 'max' },
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
const selectedTimeBin = ref<BinSizes>('weekendweekday');
const selectedFoldingPeriod = ref<FoldPeriods>('week');
const selectedMethod = ref<'mean' | 'median' | 'min' | 'max' | 'sum'>('mean');
const selectedTimezone = ref('US/Eastern');
const showErrors = ref(true);
const useSEM = ref(true);
const includeBinPhase = ref(true);
const alignToBinCenter = ref(false);
const useErrorBars = ref(false);

// Watch to ensure selected folding period is valid when time bin changes
watch(selectedTimeBin, () => {
  const validPeriods = foldingPeriodOptions.value.map(opt => opt.value);
  if (!validPeriods.includes(selectedFoldingPeriod.value)) {
    selectedFoldingPeriod.value = validPeriods[0] as FoldPeriods;
    console.log('Adjusted folding period to:', selectedFoldingPeriod.value);
  }
});

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
  return getFoldedDataPointCount(foldedData.value);
});

const canSave = computed(() => {
  return !!(props.selection && foldedData.value && foldedDataPointCount.value > 0);
});

const foldedDatasetName = computed(() => {
  if (!props.selection?.name) return 'Folded Data';
  return `Folded ${props.selection.name ?? props.selection.region.name} (${selectedTimeBin.value} of ${selectedFoldingPeriod.value}, ${selectedMethod.value})`;
});

// Aggregated data
const foldedData = ref<FoldedData | null>(null);
const foldedSelection = ref<null>(null);
// Graph data for display - now a ref that gets manually updated
const graphData = ref<PlotltGraphDataSet[]>([]);

// Function to update graph data
function updateGraphData() {
  if (!props.selection || !foldedData.value) {
    graphData.value = [];
    return;
  }
  
  const data: PlotltGraphDataSet[] = [];
  
  const rawDataset = foldedDataRawToPlotly(
    foldedData.value,
    props.selection.name || 'Original Data',
    alignToBinCenter.value, // Apply centering when includeBinPhase=false
    includeBinPhase.value
  );
  
  // Aggregated data: ALWAYS hide phase (modulo applied), can be centered
  const aggregatedDataset = foldedDataAggregatedToPlotly(
    foldedData.value,
    `${props.selection.name || 'Data'} (Aggregated)`,
    alignToBinCenter.value, // Only aggregated data can be centered
    useErrorBars.value,
    selectedTimeBin.value
  );
  
  data.push(rawDataset, aggregatedDataset);
  
  graphData.value = data;
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
    name: `Folded (${selectedTimeBin.value} of ${selectedFoldingPeriod.value})`,
    description: `Folded data (${selectedTimeBin.value} of ${selectedFoldingPeriod.value}) ${selectedMethod.value}`,
    range: ranges,
    type: 'folded'
  };
}

// Watch for changes in folding parameters
// watch([
//   selectedTimeBin,
//   selectedFoldingPeriod,
//   selectedMethod, 
//   selectedTimezone, 
//   useSEM, 
//   includeBinPhase, 
//   alignToBinCenter, 
//   useErrorBars
// ], () => {
//   updateAggregatedData();
//   if (useTzCenter.value && regionCenter.value.lat !== 0 && regionCenter.value.lon !== 0) {
//     const tz = tz_lookup(regionCenter.value.lat, regionCenter.value.lon);
//     if (tz) {
//       selectedTimezone.value = tz;
//     }
//   }
// }, { immediate: true });

// Only recalculate when data-affecting parameters change
watch([selectedTimeBin, selectedFoldingPeriod, selectedMethod, selectedTimezone, useSEM], 
  updateAggregatedData, { immediate: true });

// Handle display-only changes separately
watch([useErrorBars, alignToBinCenter, includeBinPhase], updateGraphData);



// Update folded data when parameters change
function updateAggregatedData() {
  console.log("Updating folded data with time bin:", selectedTimeBin.value, "folding period:", selectedFoldingPeriod.value, "method:", selectedMethod.value, "timezone:", selectedTimezone.value);
  if (!props.selection?.samples) {
    foldedData.value = null;
    return;
  }
  
  try {
    // Convert UserDataset to arrays
    const { x, y, e } = userDatasetToArrays(props.selection);
    
    const errorFunc = useSEM.value ? 'standardError' : 'stdev';
    
    foldedData.value = timeseriesFoldAndBin(
      x,
      y,
      e,
      selectedTimezone.value,
      { binSize: selectedFoldingPeriod.value as FoldPeriods },
      selectedTimeBin.value,
      selectedMethod.value,
      errorFunc
    );
    
  } catch (error) {
    console.error('Error aggregating data:', error);
    foldedData.value = null;
    foldedSelection.value = null;
  }
  
  // Update graph data after folding
  updateGraphData();
}

// Save the folding
function saveFolding() {
  
  if (!canSave.value || !props.selection || !foldedData.value) return;
  const oldAlignToBinCenter = alignToBinCenter.value;
  const oldIncludeBinPhase = includeBinPhase.value;
  
  // Ensure alignToBinCenter and includeBinPhase are false when saving, as we want to store raw values
  alignToBinCenter.value = false;
  includeBinPhase.value = false;
  
  // Generate the datasets using the same logic as updateGraphData
  const rawDataset = foldedDataRawToPlotly(
    foldedData.value,
    props.selection.name || 'Original Data',
    false, // alignToBinCenter - always false when saving
    false  // includeBinPhase - always false when saving
  );
  
  // Aggregated data: always hide phase, never centered when saving
  const summaryDataset = foldedDataAggregatedToPlotly(
    foldedData.value,
    foldedDatasetName.value,
    false, // alignToBinCenter - always false when saving
    useErrorBars.value,
    selectedTimeBin.value
  );

  const foldedSelection: UserDataset = {
    id: v4(),
    region: { ...props.selection.region, name: props.selection.region.name } as typeof props.selection.region,
    timeRange: createFoldedTimeRange(),
    molecule: props.selection.molecule,
    loading: false, // folded data is immediately available
    // samples/errors intentionally omitted for folded since data structure is different
    locations: props.selection.locations, // use original locations
    name: foldedDatasetName.value,
    folded: {
      timeBin: selectedTimeBin.value,
      foldingPeriod: selectedFoldingPeriod.value,
      method: selectedMethod.value,
      timezone: selectedTimezone.value,
      useSEM: useSEM.value,
      includeBinPhase: includeBinPhase.value,
      alignToBinCenter: alignToBinCenter.value,
      useErrorBars: useErrorBars.value,
      raw: foldedData.value
    },
    plotlyDatasets: [rawDataset, summaryDataset]
  };
  console.log(foldedSelection);
  emit('save', foldedSelection);
  
  // Restore original values
  alignToBinCenter.value = oldAlignToBinCenter;
  includeBinPhase.value = oldIncludeBinPhase;
  
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
