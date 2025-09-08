<template>
  <v-app id="app">
    <div id="main-content">
      <div class="content-with-sidebars">
        <h1 id="title">TEMPO NO₂ Data Aggregation</h1>
        
        <div id="map-container">
          <v-card id="map-contents" style="width:100%; height: 500px;">
            <v-toolbar density="compact" color="primary">
              <v-toolbar-title text="TEMPO NO₂ Data Viewer"></v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn
                @click="showAggregationDialog = true"
                color="secondary"
                variant="outlined"
                size="small"
                :disabled="!currentRegion"
              >
                <v-icon class="mr-1">mdi-chart-timeline-variant</v-icon>
                Advanced Aggregation
              </v-btn>
            </v-toolbar>
            
            <div style="height: 450px; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
              <div class="text-center">
                <v-icon size="64" color="grey">mdi-map</v-icon>
                <div class="text-h6 mt-2">Map Component Placeholder</div>
                <v-btn 
                  @click="createMockRegion"
                  color="primary"
                  class="mt-3"
                >
                  Create Test Region
                </v-btn>
                <div v-if="currentRegion" class="mt-2 text-success">
                  Region Selected: {{ currentRegion.name }}
                </div>
              </div>
            </div>
          </v-card>
        </div>
      </div>
    </div>

    <!-- Advanced Aggregation Dialog -->
    <v-dialog
      v-model="showAggregationDialog"
      max-width="1200"
      persistent
    >
      <v-card>
        <v-card-title class="d-flex justify-space-between">
          <span>Advanced NO₂ Time Series Aggregation</span>
          <v-btn
            icon="mdi-close"
            @click="showAggregationDialog = false"
            size="small"
          />
        </v-card-title>
        <v-card-text>
          <AggregationWorkflow
            v-if="showAggregationDialog"
            :available-timestamps="availableTimestamps"
            :current-region="currentRegion"
            @workflow-complete="onAggregationComplete"
            @pattern-saved="onPatternSaved"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AggregationWorkflow } from './components/aggregation';
import type { AggregatedResult, AggregationPattern } from './types/aggregation';
import { TempoDataService } from './esri/services/TempoDataService';
import { ESRI_URLS } from './esri/utils';

// UI state
const showAggregationDialog = ref(false);

// NO₂ specific data service
const no2Service = new TempoDataService(
  ESRI_URLS.no2.url,
  ESRI_URLS.no2.variable
);

// Mock data for testing - in real app this would come from ESRI service
const availableTimestamps = ref([
  Date.now() - 86400000 * 7, // 7 days ago
  Date.now() - 86400000 * 6,
  Date.now() - 86400000 * 5,
  Date.now() - 86400000 * 4,
  Date.now() - 86400000 * 3,
  Date.now() - 86400000 * 2,
  Date.now() - 86400000 * 1,
  Date.now()
]);

// Current region state
const currentRegion = ref<{ id: string; name: string; geometry: unknown } | null>(null);

// Mock region creation for testing
function createMockRegion() {
  currentRegion.value = {
    id: 'test-region-1',
    name: 'Test NO₂ Region',
    geometry: {
      xmin: -118.5,
      ymin: 33.7,
      xmax: -118.2,
      ymax: 34.1
    }
  };
}

// Aggregation event handlers
function onAggregationComplete(result: AggregatedResult) {
  console.log('NO₂ Aggregation completed:', result);
  showAggregationDialog.value = false;
  
  // Here you could save the results or update the UI
  // For example, display the aggregated time series on the map
}

function onPatternSaved(pattern: AggregationPattern) {
  console.log('NO₂ Pattern saved:', pattern);
}

// Initialize NO₂ service and load timestamps
async function initializeNo2Data() {
  try {
    await no2Service.updateMetadataCache();
    // In a real implementation, you would fetch actual timestamps from the service
    console.log('NO₂ service initialized');
  } catch (error) {
    console.error('Error initializing NO₂ service:', error);
  }
}

// Initialize on mount
initializeNo2Data();
</script>

<style scoped>
#main-content {
  padding: 20px;
}

.content-with-sidebars {
  max-width: 1200px;
  margin: 0 auto;
}

#title {
  text-align: center;
  margin-bottom: 20px;
  color: #1976d2;
}

#map-container {
  width: 100%;
}

#map-contents {
  border-radius: 8px;
  overflow: hidden;
}
</style>