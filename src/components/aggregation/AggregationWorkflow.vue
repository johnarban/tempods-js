<template>
  <div class="aggregation-workflow">
    <!-- Workflow Steps -->
    <v-stepper
      v-model="currentStep"
      class="mb-4"
      elevation="2"
    >
      <v-stepper-header>
        <v-stepper-item
          :complete="currentStep > 1"
          :value="1"
          title="Configure Pattern"
          subtitle="Select days, hours, and aggregation settings"
        />
        <v-divider />
        <v-stepper-item
          :complete="currentStep > 2"
          :value="2"
          title="Preview Selection"
          subtitle="Review selected data points and groups"
        />
        <v-divider />
        <v-stepper-item
          :complete="currentStep > 3"
          :value="3"
          title="Execute & Review"
          subtitle="Run aggregation and analyze results"
        />
      </v-stepper-header>

      <v-stepper-window>
        <!-- Step 1: Configure Pattern -->
        <v-stepper-window-item :value="1">
          <FlexibleAggregationInterface
            :available-timestamps="availableTimestamps"
            :current-region="currentRegion"
            @aggregation-complete="onAggregationComplete"
            @pattern-saved="onPatternSaved"
            ref="aggregationInterface"
          />
          <div class="stepper-actions mt-4">
            <v-btn
              color="primary"
              @click="moveToPreview"
              :disabled="!canMoveToPreview"
            >
              Next: Preview Selection
            </v-btn>
          </div>
        </v-stepper-window-item>

        <!-- Step 2: Preview Selection -->
        <v-stepper-window-item :value="2">
          <AggregationPreview
            v-if="previewData"
            :preview-data="previewData"
            :pattern="currentPattern"
            @update-pattern="updatePattern"
          />
          <div class="stepper-actions mt-4">
            <v-btn
              variant="outlined"
              @click="currentStep = 1"
            >
              Back: Edit Pattern
            </v-btn>
            <v-btn
              color="primary"
              @click="executeAggregation"
              :loading="executingAggregation"
              :disabled="!previewData"
              class="ml-2"
            >
              Execute Aggregation
            </v-btn>
          </div>
        </v-stepper-window-item>

        <!-- Step 3: Results -->
        <v-stepper-window-item :value="3">
          <AggregationResultsViewer
            v-if="aggregationResults"
            :results="aggregationResults"
            @group-selected="onGroupSelected"
          />
          <div class="stepper-actions mt-4">
            <v-btn
              variant="outlined"
              @click="currentStep = 2"
            >
              Back: Preview
            </v-btn>
            <v-btn
              color="success"
              @click="saveAndFinish"
              class="ml-2"
            >
              Save & Finish
            </v-btn>
            <v-btn
              color="primary"
              variant="outlined"
              @click="startNewAggregation"
              class="ml-2"
            >
              New Aggregation
            </v-btn>
          </div>
        </v-stepper-window-item>
      </v-stepper-window>
    </v-stepper>

    <!-- Quick Actions Sidebar -->
    <v-navigation-drawer
      v-model="showQuickActions"
      location="right"
      temporary
      width="300"
    >
      <v-list>
        <v-list-subheader>Quick Actions</v-list-subheader>
        
        <v-list-item @click="loadTemplate('business-hours')">
          <v-list-item-title>Business Hours Template</v-list-item-title>
          <v-list-item-subtitle>Mon-Fri, 9 AM - 5 PM</v-list-item-subtitle>
        </v-list-item>
        
        <v-list-item @click="loadTemplate('rush-hours')">
          <v-list-item-title>Rush Hours Template</v-list-item-title>
          <v-list-item-subtitle>7-9 AM, 5-7 PM weekdays</v-list-item-subtitle>
        </v-list-item>
        
        <v-list-item @click="loadTemplate('weekend-pattern')">
          <v-list-item-title>Weekend Pattern</v-list-item-title>
          <v-list-item-subtitle>Sat-Sun, all hours</v-list-item-subtitle>
        </v-list-item>
        
        <v-divider class="my-2" />
        
        <v-list-item @click="showHelp = true">
          <v-list-item-title>Help & Examples</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Help Dialog -->
    <v-dialog v-model="showHelp" max-width="600">
      <v-card>
        <v-card-title>Aggregation Help & Examples</v-card-title>
        <v-card-text>
          <AggregationHelpContent />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showHelp = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Floating Action Button -->
    <v-fab
      icon="mdi-help"
      location="bottom end"
      size="small"
      color="info"
      @click="showQuickActions = !showQuickActions"
      class="aggregation-fab"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FlexibleAggregationInterface from './FlexibleAggregationInterface';
import AggregationPreview from './AggregationPreview';
import AggregationResultsViewer from './AggregationResultsViewer';
import AggregationHelpContent from './AggregationHelpContent';
import type { 
  AggregationPattern,
  AggregationPreview as AggregationPreviewType,
  AggregatedResult,
  AggregationResultGroup
} from '../../types/aggregation';

const props = defineProps<{
  availableTimestamps: number[];
  currentRegion?: any;
}>();

const emit = defineEmits<{
  'workflow-complete': [result: AggregatedResult];
  'pattern-saved': [pattern: AggregationPattern];
}>();

// Workflow state
const currentStep = ref(1);
const previewData = ref<AggregationPreviewType | null>(null);
const currentPattern = ref<AggregationPattern | null>(null);
const aggregationResults = ref<AggregatedResult | null>(null);
const executingAggregation = ref(false);

// UI state
const showQuickActions = ref(false);
const showHelp = ref(false);
const aggregationInterface = ref();

// Computed
const canMoveToPreview = computed(() => {
  return currentPattern.value && previewData.value;
});

// Methods
async function moveToPreview() {
  if (aggregationInterface.value) {
    await aggregationInterface.value.generatePreview();
    currentStep.value = 2;
  }
}

async function executeAggregation() {
  if (!previewData.value || !currentPattern.value) return;
  
  executingAggregation.value = true;
  try {
    // This would call the actual aggregation logic
    aggregationResults.value = await aggregationInterface.value.executeAggregation();
    currentStep.value = 3;
  } catch (error) {
    console.error('Error executing aggregation:', error);
  } finally {
    executingAggregation.value = false;
  }
}

function onAggregationComplete(result: AggregatedResult) {
  aggregationResults.value = result;
  currentStep.value = 3;
}

function onPatternSaved(pattern: AggregationPattern) {
  emit('pattern-saved', pattern);
}

function updatePattern(updatedPattern: Partial<AggregationPattern>) {
  if (currentPattern.value) {
    Object.assign(currentPattern.value, updatedPattern);
  }
}

function onGroupSelected(group: AggregationResultGroup) {
  // Handle group selection (e.g., highlight on map, show details)
  console.log('Group selected:', group);
}

function saveAndFinish() {
  if (aggregationResults.value) {
    emit('workflow-complete', aggregationResults.value);
  }
}

function startNewAggregation() {
  currentStep.value = 1;
  previewData.value = null;
  currentPattern.value = null;
  aggregationResults.value = null;
}

function loadTemplate(templateType: string) {
  // Implementation would load predefined templates
  console.log('Loading template:', templateType);
  showQuickActions.value = false;
}

function exportResults() {
  if (!aggregationResults.value) return;
  
  const csvData = convertToCSV();
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aggregation_results_${aggregationResults.value.metadata.pattern.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function convertToCSV(): string {
  if (!aggregationResults.value) return '';
  
  const headers = [
    'Group Label',
    'Timestamp',
    'Date',
    'Value',
    'Error Lower',
    'Error Upper',
    'Sample Size'
  ];
  
  const rows = aggregationResults.value.groups.map(group => [
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
.aggregation-workflow {
  max-width: 1200px;
  margin: 0 auto;
}

.stepper-actions {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0;
}

.aggregation-fab {
  position: fixed !important;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}
</style>