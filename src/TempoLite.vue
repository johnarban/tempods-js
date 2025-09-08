<template>
  <v-app id="app">
    <div id="main-content">
      <div class="content-with-sidebars">
        <h1 id="title">TEMPO Data Aggregation</h1>
        
        <div id="map-container">
          <v-card id="map-contents" style="width:100%; height: 500px;">
            <v-toolbar density="compact" color="primary">
              <v-toolbar-title text="TEMPO Data Viewer"></v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn
                @click="showAggregationDialog = true"
                color="secondary"
                variant="outlined"
                size="small"
                :disabled="!currentUserSelection?.region"
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
          <span>Advanced Time Series Aggregation</span>
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
            :current-region="currentUserSelection?.region"
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

// UI state
const showAggregationDialog = ref(false);

// Mock data for testing
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

const currentUserSelection = ref<{ region?: { id: string; name: string } } | null>(null);

// Mock region creation
function createMockRegion() {
  currentUserSelection.value = {
    region: {
      id: 'test-region-1',
      name: 'Test Region'
    }
  };
}

// Aggregation event handlers
function onAggregationComplete(result: AggregatedResult) {
  console.log('Aggregation completed:', result);
  showAggregationDialog.value = false;
}

function onPatternSaved(pattern: AggregationPattern) {
  console.log('Pattern saved:', pattern);
}
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