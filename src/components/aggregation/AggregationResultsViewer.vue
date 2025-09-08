<template>
  <v-card class="aggregation-results-viewer" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <v-icon>mdi-chart-line</v-icon>
        <span>Aggregation Results</span>
      </div>
      <div class="d-flex ga-2">
        <v-btn
          icon="mdi-download"
          size="small"
          variant="outlined"
          @click="exportResults"
          title="Export Results"
        />
        <v-btn
          icon="mdi-chart-box-outline"
          size="small"
          variant="outlined"
          @click="showVisualization = !showVisualization"
          :color="showVisualization ? 'primary' : 'default'"
          title="Toggle Visualization"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <!-- Results Summary -->
      <div class="results-summary mb-4">
        <v-row dense>
          <v-col cols="3">
            <v-card variant="tonal" class="text-center pa-3">
              <div class="text-h6 text-primary">{{ results.groups.length }}</div>
              <div class="text-caption">Aggregated Points</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="tonal" class="text-center pa-3">
              <div class="text-h6 text-success">{{ results.metadata.totalInputPoints }}</div>
              <div class="text-caption">Input Points</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="tonal" class="text-center pa-3">
              <div class="text-h6 text-info">{{ compressionRatio }}%</div>
              <div class="text-caption">Compression</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="tonal" class="text-center pa-3">
              <div class="text-h6 text-warning">{{ averageSampleSize }}</div>
              <div class="text-caption">Avg Sample Size</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Pattern Info -->
      <div class="pattern-info mb-4">
        <v-card variant="outlined" class="pa-3">
          <h5 class="text-subtitle-1 mb-2">{{ results.metadata.pattern.name }}</h5>
          <div class="d-flex flex-wrap ga-1 mb-2">
            <v-chip size="small" color="primary" variant="tonal">
              {{ results.metadata.pattern.aggregationMethod }}
            </v-chip>
            <v-chip size="small" color="secondary" variant="tonal">
              {{ results.metadata.pattern.aggregationPeriod }}
            </v-chip>
            <v-chip size="small" color="info" variant="tonal">
              {{ enabledDaysCount }} days/week
            </v-chip>
            <v-chip size="small" color="success" variant="tonal">
              {{ enabledHoursCount }} hours/day
            </v-chip>
          </div>
          <div class="text-caption text-disabled">
            Generated on {{ formatDate(results.metadata.aggregationDate) }}
          </div>
        </v-card>
      </div>

      <!-- Visualization Toggle -->
      <v-expand-transition>
        <div v-if="showVisualization" class="visualization-section mb-4">
          <AggregationChart
            :results="results"
            :show-error-bars="showErrorBars"
            :chart-type="chartType"
          />
          <div class="chart-controls mt-2">
            <v-row>
              <v-col cols="6">
                <v-select
                  v-model="chartType"
                  :items="chartTypes"
                  label="Chart Type"
                  density="compact"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="6" class="d-flex align-center">
                <v-switch
                  v-model="showErrorBars"
                  label="Show Error Bars"
                  density="compact"
                />
              </v-col>
            </v-row>
          </div>
        </div>
      </v-expand-transition>

      <!-- Results Table -->
      <div class="results-table">
        <h5 class="text-subtitle-1 mb-3">Detailed Results</h5>
        <v-data-table
          :headers="tableHeaders"
          :items="results.groups"
          :items-per-page="10"
          class="elevation-1"
          density="compact"
        >
          <template #item.timestamp="{ item }">
            {{ formatDateTime(item.timestamp) }}
          </template>
          <template #item.value="{ item }">
            <span v-if="item.value !== null">
              {{ formatValue(item.value) }}
            </span>
            <span v-else class="text-disabled">N/A</span>
          </template>
          <template #item.error="{ item }">
            <span v-if="item.error.upper !== null">
              ± {{ formatValue(item.error.upper) }}
            </span>
            <span v-else class="text-disabled">N/A</span>
          </template>
          <template #item.dateRange="{ item }">
            <div class="text-caption">
              {{ formatDate(item.dateRange.start) }} -<br>
              {{ formatDate(item.dateRange.end) }}
            </div>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-information"
              size="x-small"
              variant="text"
              @click="showGroupDetails(item)"
            />
          </template>
        </v-data-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AggregationChart from './AggregationChart.vue';
import type { 
  AggregatedResult,
  AggregationResultGroup 
} from '../../types/aggregation';

const props = defineProps<{
  results: AggregatedResult;
}>();

const emit = defineEmits<{
  'group-selected': [group: AggregationResultGroup];
}>();

// UI State
const showVisualization = ref(true);
const showErrorBars = ref(true);
const chartType = ref('line');

// Chart options
const chartTypes = [
  { title: 'Line Chart', value: 'line' },
  { title: 'Bar Chart', value: 'bar' },
  { title: 'Scatter Plot', value: 'scatter' }
];

// Table configuration
const tableHeaders = [
  { title: 'Group', key: 'label', sortable: true },
  { title: 'Date', key: 'timestamp', sortable: true },
  { title: 'Value', key: 'value', sortable: true },
  { title: 'Error', key: 'error', sortable: false },
  { title: 'Sample Size', key: 'sampleSize', sortable: true },
  { title: 'Date Range', key: 'dateRange', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed properties
const compressionRatio = computed(() => {
  if (props.results.metadata.totalInputPoints === 0) return 0;
  return Math.round((1 - props.results.metadata.totalOutputPoints / props.results.metadata.totalInputPoints) * 100);
});

const averageSampleSize = computed(() => {
  if (props.results.groups.length === 0) return 0;
  const total = props.results.groups.reduce((sum, group) => sum + group.sampleSize, 0);
  return Math.round(total / props.results.groups.length);
});

const enabledDaysCount = computed(() => 
  props.results.metadata.pattern.selectedDays.filter(day => day.enabled).length
);

const enabledHoursCount = computed(() => 
  props.results.metadata.pattern.selectedHours.filter(hour => hour.enabled).length
);

// Methods
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatValue(value: number): string {
  if (value >= 1e6) {
    return (value / 1e6).toFixed(2) + 'M';
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(2) + 'K';
  } else {
    return value.toFixed(2);
  }
}

function showGroupDetails(group: AggregationResultGroup) {
  emit('group-selected', group);
}

function exportResults() {
  const dataStr = JSON.stringify(props.results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aggregation_results_${props.results.metadata.pattern.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.aggregation-results-viewer {
  max-width: 1000px;
}

.results-summary .v-card {
  min-height: 80px;
}

.pattern-info {
  background: rgba(var(--v-theme-primary), 0.05);
}

.visualization-section {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 16px;
}

.chart-controls {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 12px;
}
</style>