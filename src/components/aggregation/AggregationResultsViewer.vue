<template>
  <v-card class="aggregation-results" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <v-icon>mdi-chart-line</v-icon>
        <span>Aggregation Results</span>
      </div>
      <v-btn-group density="compact" variant="outlined">
        <v-btn @click="exportResults" size="small">
          <v-icon class="mr-1">mdi-download</v-icon>
          Export CSV
        </v-btn>
      </v-btn-group>
    </v-card-title>

    <v-card-text>
      <!-- Results Summary -->
      <div class="results-summary mb-4">
        <v-row>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ results.groups.length }}</div>
              <div class="text-caption">Result Groups</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ totalSamples }}</div>
              <div class="text-caption">Total Samples</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ averageValue.toFixed(2) }}</div>
              <div class="text-caption">Average Value</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ results.metadata.pattern.aggregationMethod.toUpperCase() }}</div>
              <div class="text-caption">Method Used</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Results Table -->
      <div class="results-table">
        <h4 class="text-subtitle-1 mb-3">Detailed Results</h4>
        <v-data-table
          :headers="tableHeaders"
          :items="results.groups"
          :items-per-page="10"
          class="elevation-1"
          @click:row="onRowClick"
        >
          <template v-slot:item.timestamp="{ item }">
            {{ new Date(item.timestamp).toLocaleString() }}
          </template>
          <template v-slot:item.value="{ item }">
            {{ item.value?.toFixed(3) || 'N/A' }}
          </template>
          <template v-slot:item.error="{ item }">
            <span v-if="item.error.lower !== null && item.error.upper !== null">
              ±{{ ((item.error.upper - item.error.lower) / 2).toFixed(3) }}
            </span>
            <span v-else>N/A</span>
          </template>
        </v-data-table>
      </div>

      <!-- Simple Chart Placeholder -->
      <div class="results-chart mt-4">
        <h4 class="text-subtitle-1 mb-3">Time Series Chart</h4>
        <v-card variant="outlined" class="chart-placeholder pa-8 text-center">
          <v-icon size="64" color="grey-darken-1" class="mb-3">
            mdi-chart-line
          </v-icon>
          <div class="text-body-1 text-medium-emphasis mb-2">
            Interactive Chart Coming Soon
          </div>
          <div class="text-body-2 text-disabled">
            For now, export the data to view in external tools
          </div>
        </v-card>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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

// Computed properties
const totalSamples = computed(() => {
  return props.results.groups.reduce((sum, group) => sum + group.sampleSize, 0);
});

const averageValue = computed(() => {
  const validValues = props.results.groups
    .map(g => g.value)
    .filter(v => v !== null && v !== undefined) as number[];
  
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
});

const tableHeaders = [
  { title: 'Group', key: 'label', sortable: true },
  { title: 'Timestamp', key: 'timestamp', sortable: true },
  { title: 'Value', key: 'value', sortable: true },
  { title: 'Error', key: 'error', sortable: false },
  { title: 'Samples', key: 'sampleSize', sortable: true }
];

// Methods
function onRowClick(event: Event, { item }: { item: AggregationResultGroup }) {
  emit('group-selected', item);
}

function exportResults() {
  const csvData = convertToCSV();
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aggregation_results_${props.results.metadata.pattern.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function convertToCSV(): string {
  const headers = [
    'Group Label',
    'Timestamp',
    'Date',
    'Value',
    'Error Lower',
    'Error Upper',
    'Sample Size'
  ];
  
  const rows = props.results.groups.map(group => [
    group.label,
    group.timestamp,
    new Date(group.timestamp).toISOString(),
    group.value?.toString() || 'null',
    group.error.lower?.toString() || 'null',
    group.error.upper?.toString() || 'null',
    group.sampleSize
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
</script>

<style scoped>
.aggregation-results {
  max-width: 100%;
}

.results-summary .v-card {
  height: 100%;
}

.chart-placeholder {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.results-table :deep(.v-data-table__tr) {
  cursor: pointer;
}

.results-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.1);
}
</style>