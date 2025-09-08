<template>
  <v-card class="flexible-aggregation-interface" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <v-icon>mdi-chart-timeline-variant</v-icon>
        <span>Flexible Time Series Aggregation</span>
      </div>
      <v-btn-group density="compact" variant="outlined">
        <v-btn 
          :color="mode === 'create' ? 'primary' : 'default'"
          @click="mode = 'create'"
          size="small"
        >
          Create
        </v-btn>
        <v-btn 
          :color="mode === 'saved' ? 'primary' : 'default'"
          @click="mode = 'saved'"
          size="small"
        >
          Saved Patterns
        </v-btn>
      </v-btn-group>
    </v-card-title>

    <v-card-text>
      <!-- Create New Pattern Mode -->
      <div v-if="mode === 'create'">
        <!-- Pattern Name -->
        <v-text-field
          v-model="currentPattern.name"
          label="Pattern Name"
          placeholder="e.g., Weekday Rush Hours"
          density="compact"
          variant="outlined"
          class="mb-4"
        />

        <!-- Day Selection -->
        <div class="mb-6">
          <h4 class="text-subtitle-1 mb-3 d-flex align-center ga-2">
            <v-icon size="small">mdi-calendar-week</v-icon>
            Select Days of Week
          </h4>
          <div class="day-selection-grid">
            <v-checkbox
              v-for="day in currentPattern.selectedDays"
              :key="day.dayIndex"
              v-model="day.enabled"
              :label="day.dayName"
              density="compact"
              hide-details
              class="day-checkbox"
            />
          </div>
        </div>

        <!-- Hour Selection -->
        <div class="mb-6">
          <h4 class="text-subtitle-1 mb-3 d-flex align-center ga-2">
            <v-icon size="small">mdi-clock-outline</v-icon>
            Select Hours
          </h4>
          <div class="hour-selection-container">
            <div class="hour-selection-grid">
              <v-checkbox
                v-for="hour in currentPattern.selectedHours"
                :key="hour.hour"
                v-model="hour.enabled"
                :label="hour.displayTime"
                density="compact"
                hide-details
                class="hour-checkbox"
              />
            </div>
            <div class="hour-selection-actions mt-3">
              <v-btn-group density="compact" variant="outlined">
                <v-btn @click="selectBusinessHours" size="small">Business Hours</v-btn>
                <v-btn @click="selectRushHours" size="small">Rush Hours</v-btn>
                <v-btn @click="selectAllHours" size="small">All Hours</v-btn>
                <v-btn @click="clearHours" size="small">Clear</v-btn>
              </v-btn-group>
            </div>
          </div>
        </div>

        <!-- Date Range -->
        <div class="mb-6">
          <h4 class="text-subtitle-1 mb-3 d-flex align-center ga-2">
            <v-icon size="small">mdi-calendar-range</v-icon>
            Date Range
          </h4>
          <v-row>
            <v-col cols="6">
              <date-picker
                v-model="startDateObj"
                @update:model-value="updateStartDate"
                label="Start Date"
                :format="formatDateDisplay"
                text-input
                :teleport="true"
                dark
              />
            </v-col>
            <v-col cols="6">
              <date-picker
                v-model="endDateObj"
                @update:model-value="updateEndDate"
                label="End Date"
                :format="formatDateDisplay"
                text-input
                :teleport="true"
                dark
              />
            </v-col>
          </v-row>
        </div>

        <!-- Aggregation Settings -->
        <div class="mb-6">
          <h4 class="text-subtitle-1 mb-3 d-flex align-center ga-2">
            <v-icon size="small">mdi-function-variant</v-icon>
            Aggregation Settings
          </h4>
          <v-row>
            <v-col cols="6">
              <v-select
                v-model="currentPattern.aggregationMethod"
                :items="aggregationMethods"
                label="Aggregation Method"
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="currentPattern.aggregationPeriod"
                :items="aggregationPeriods"
                label="Aggregation Period"
                density="compact"
                variant="outlined"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Preview Section -->
        <div class="mb-6" v-if="previewData">
          <h4 class="text-subtitle-1 mb-3 d-flex align-center ga-2">
            <v-icon size="small">mdi-eye-outline</v-icon>
            Preview
          </h4>
          <AggregationPreview
            :preview-data="previewData"
            :pattern="currentPattern"
            @update-pattern="updatePattern"
          />
        </div>

        <!-- Actions -->
        <div class="d-flex ga-2">
          <v-btn
            color="primary"
            @click="generatePreview"
            :loading="loadingPreview"
            :disabled="!isPatternValid"
          >
            <v-icon class="mr-2">mdi-eye</v-icon>
            Preview Selection
          </v-btn>
          <v-btn
            color="success"
            @click="executeAggregation"
            :loading="loadingAggregation"
            :disabled="!previewData || !isPatternValid"
          >
            <v-icon class="mr-2">mdi-play</v-icon>
            Execute Aggregation
          </v-btn>
          <v-btn
            color="secondary"
            variant="outlined"
            @click="savePattern"
            :disabled="!isPatternValid"
          >
            <v-icon class="mr-2">mdi-content-save</v-icon>
            Save Pattern
          </v-btn>
        </div>
      </div>

      <!-- Saved Patterns Mode -->
      <div v-else-if="mode === 'saved'">
        <div class="text-center pa-6">
          <v-icon size="64" color="grey-darken-1" class="mb-3">
            mdi-folder-open-outline
          </v-icon>
          <div class="text-body-1 text-medium-emphasis mb-2">
            Saved patterns feature coming soon
          </div>
          <div class="text-body-2 text-disabled">
            For now, use the Create tab to build aggregation patterns
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { v4 } from 'uuid';
import DatePicker from '@vuepic/vue-datepicker';
import AggregationPreview from './AggregationPreview';
import { useFlexibleAggregation } from '../../composables/useFlexibleAggregation';
import type { 
  AggregationPattern, 
  AggregationPreview as AggregationPreviewType,
  AggregatedResult,
  SavedAggregationPattern,
  AggregationMethod,
  AggregationPeriod,
  DayOfWeekSelection,
  HourSelection
} from '../../types/aggregation';

const props = defineProps<{
  availableTimestamps: number[];
  currentRegion?: any; // Current selected region for data fetching
}>();

const emit = defineEmits<{
  'aggregation-complete': [result: AggregatedResult];
  'pattern-saved': [pattern: AggregationPattern];
}>();

// Composable for aggregation logic
const {
  generatePreview: generatePreviewData,
  executeAggregation: executeAggregationData,
  savePattern: savePatternData,
  loadSavedPatterns,
  validatePattern
} = useFlexibleAggregation();

// UI State
const mode = ref<'create' | 'saved'>('create');
const loadingPreview = ref(false);
const loadingAggregation = ref(false);
const previewData = ref<AggregationPreviewType | null>(null);
const savedPatterns = ref<SavedAggregationPattern[]>([]);

// Date objects for date pickers
const startDateObj = ref<Date>(new Date());
const endDateObj = ref<Date>(new Date());

// Current pattern being edited
const currentPattern = ref<AggregationPattern>({
  id: '',
  name: '',
  description: '',
  selectedDays: [],
  selectedHours: [],
  dateRange: {
    start: new Date(),
    end: new Date()
  },
  aggregationMethod: 'mean',
  aggregationPeriod: 'weekly',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  created: new Date(),
  modified: new Date()
});

// Options for dropdowns
const aggregationMethods = [
  { title: 'Average (Mean)', value: 'mean' as AggregationMethod },
  { title: 'Median', value: 'median' as AggregationMethod },
  { title: 'Sum', value: 'sum' as AggregationMethod },
  { title: 'Minimum', value: 'min' as AggregationMethod },
  { title: 'Maximum', value: 'max' as AggregationMethod },
  { title: 'Count', value: 'count' as AggregationMethod }
];

const aggregationPeriods = [
  { title: 'No Grouping', value: 'none' as AggregationPeriod },
  { title: 'Daily', value: 'daily' as AggregationPeriod },
  { title: 'Weekly', value: 'weekly' as AggregationPeriod },
  { title: 'Bi-weekly', value: 'biweekly' as AggregationPeriod },
  { title: 'Monthly', value: 'monthly' as AggregationPeriod },
  { title: 'Quarterly', value: 'quarterly' as AggregationPeriod }
];

// Computed properties
const isPatternValid = computed(() => {
  return validatePattern(currentPattern.value);
});

// Methods
function initializePattern() {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  currentPattern.value = {
    id: v4(),
    name: '',
    description: '',
    selectedDays: dayNames.map((name, index) => ({
      enabled: index >= 1 && index <= 5, // Default to weekdays
      dayIndex: index,
      dayName: name
    })),
    selectedHours: Array.from({ length: 24 }, (_, hour) => ({
      enabled: hour >= 9 && hour <= 17, // Default to business hours
      hour,
      minute: 0,
      displayTime: new Date(0, 0, 0, hour, 0).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      })
    })),
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    },
    aggregationMethod: 'mean',
    aggregationPeriod: 'weekly',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    created: new Date(),
    modified: new Date()
  };

  startDateObj.value = currentPattern.value.dateRange.start;
  endDateObj.value = currentPattern.value.dateRange.end;
}

function selectBusinessHours() {
  currentPattern.value.selectedHours.forEach(hour => {
    hour.enabled = hour.hour >= 9 && hour.hour <= 17;
  });
}

function selectRushHours() {
  currentPattern.value.selectedHours.forEach(hour => {
    hour.enabled = (hour.hour >= 7 && hour.hour <= 9) || (hour.hour >= 17 && hour.hour <= 19);
  });
}

function selectAllHours() {
  currentPattern.value.selectedHours.forEach(hour => {
    hour.enabled = true;
  });
}

function clearHours() {
  currentPattern.value.selectedHours.forEach(hour => {
    hour.enabled = false;
  });
}

function updateStartDate(date: Date) {
  if (date) {
    startDateObj.value = date;
    currentPattern.value.dateRange.start = date;
  }
}

function updateEndDate(date: Date) {
  if (date) {
    endDateObj.value = date;
    currentPattern.value.dateRange.end = date;
  }
}

function updatePattern(updatedPattern: Partial<AggregationPattern>) {
  Object.assign(currentPattern.value, updatedPattern);
  currentPattern.value.modified = new Date();
}

async function generatePreview() {
  loadingPreview.value = true;
  try {
    previewData.value = await generatePreviewData(
      currentPattern.value,
      props.availableTimestamps
    );
  } catch (error) {
    console.error('Error generating preview:', error);
  } finally {
    loadingPreview.value = false;
  }
}

async function executeAggregation() {
  if (!previewData.value || !props.currentRegion) return;
  
  loadingAggregation.value = true;
  try {
    const result = await executeAggregationData(
      currentPattern.value,
      previewData.value,
      props.currentRegion
    );
    emit('aggregation-complete', result);
  } catch (error) {
    console.error('Error executing aggregation:', error);
  } finally {
    loadingAggregation.value = false;
  }
}

async function savePattern() {
  try {
    await savePatternData(currentPattern.value);
    emit('pattern-saved', currentPattern.value);
    await loadSavedPatternsData();
  } catch (error) {
    console.error('Error saving pattern:', error);
  }
}

function loadPattern(pattern: AggregationPattern) {
  currentPattern.value = { ...pattern };
  startDateObj.value = pattern.dateRange.start;
  endDateObj.value = pattern.dateRange.end;
  mode.value = 'create';
  previewData.value = null; // Clear preview when loading new pattern
}

function deletePattern(patternId: string) {
  // Implementation would remove from storage
  loadSavedPatternsData();
}

function duplicatePattern(pattern: AggregationPattern) {
  const duplicated = {
    ...pattern,
    id: v4(),
    name: `${pattern.name} (Copy)`,
    created: new Date(),
    modified: new Date()
  };
  loadPattern(duplicated);
}

async function loadSavedPatternsData() {
  try {
    savedPatterns.value = await loadSavedPatterns();
  } catch (error) {
    console.error('Error loading saved patterns:', error);
  }
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Lifecycle
onMounted(() => {
  initializePattern();
  loadSavedPatternsData();
});

// Auto-generate preview when pattern changes
watch(
  () => [
    currentPattern.value.selectedDays.map(d => d.enabled),
    currentPattern.value.selectedHours.map(h => h.enabled),
    currentPattern.value.dateRange,
    currentPattern.value.aggregationPeriod
  ],
  () => {
    if (isPatternValid.value) {
      generatePreview();
    }
  },
  { deep: true }
);
</script>

<style scoped>
.flexible-aggregation-interface {
  max-width: 800px;
}

.day-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.hour-selection-container {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 16px;
}

.hour-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.day-checkbox, .hour-checkbox {
  margin: 0;
}

.hour-selection-actions {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 12px;
}
</style>