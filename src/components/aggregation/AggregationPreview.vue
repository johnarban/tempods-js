<template>
  <v-card variant="tonal" class="aggregation-preview">
    <v-card-title class="text-subtitle-1 pb-2">
      <v-icon class="mr-2">mdi-eye-outline</v-icon>
      Selection Preview
    </v-card-title>
    
    <v-card-text>
      <!-- Summary Stats -->
      <div class="preview-stats mb-4">
        <v-row dense>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-2">
              <div class="text-h6 text-primary">{{ previewData.selectedTimestamps.length }}</div>
              <div class="text-caption">Selected Points</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-2">
              <div class="text-h6 text-success">{{ previewData.aggregationGroups.length }}</div>
              <div class="text-caption">Output Groups</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-2">
              <div class="text-h6 text-info">{{ averageGroupSize }}</div>
              <div class="text-caption">Avg Group Size</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card variant="outlined" class="text-center pa-2">
              <div class="text-h6 text-warning">{{ compressionRatio }}%</div>
              <div class="text-caption">Compression</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Pattern Summary -->
      <div class="pattern-summary mb-4">
        <h5 class="text-subtitle-2 mb-2">Pattern Summary</h5>
        <v-chip-group>
          <v-chip
            v-for="day in enabledDays"
            :key="day.dayIndex"
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ day.dayName }}
          </v-chip>
        </v-chip-group>
        <div class="mt-2">
          <v-chip-group>
            <v-chip
              v-for="hour in enabledHours.slice(0, 6)"
              :key="hour.hour"
              size="small"
              color="secondary"
              variant="tonal"
            >
              {{ hour.displayTime }}
            </v-chip>
            <v-chip
              v-if="enabledHours.length > 6"
              size="small"
              color="secondary"
              variant="outlined"
            >
              +{{ enabledHours.length - 6 }} more
            </v-chip>
          </v-chip-group>
        </div>
      </div>

      <!-- Timeline Visualization -->
      <div class="timeline-visualization mb-4">
        <h5 class="text-subtitle-2 mb-2">Aggregation Groups Timeline</h5>
        <div class="timeline-container">
          <div
            v-for="(group, index) in previewData.aggregationGroups.slice(0, 10)"
            :key="group.id"
            class="timeline-group"
            :style="{ '--group-color': getGroupColor(index) }"
          >
            <div class="timeline-group-header">
              <span class="timeline-group-label">{{ group.label }}</span>
              <v-chip size="x-small" color="info" variant="tonal">
                {{ group.dataPointCount }} points
              </v-chip>
            </div>
            <div class="timeline-group-bar">
              <div class="timeline-group-fill"></div>
            </div>
            <div class="timeline-group-dates">
              <span class="text-caption">
                {{ formatDate(group.startTime) }} - {{ formatDate(group.endTime) }}
              </span>
            </div>
          </div>
          <div v-if="previewData.aggregationGroups.length > 10" class="text-caption text-center mt-2">
            ... and {{ previewData.aggregationGroups.length - 10 }} more groups
          </div>
        </div>
      </div>

      <!-- Data Quality Indicators -->
      <div class="data-quality mb-4">
        <h5 class="text-subtitle-2 mb-2">Data Quality</h5>
        <v-row dense>
          <v-col cols="6">
            <div class="quality-metric">
              <v-icon size="small" class="mr-2">mdi-chart-bell-curve</v-icon>
              <span>Coverage: {{ coveragePercentage }}%</span>
            </div>
          </v-col>
          <v-col cols="6">
            <div class="quality-metric">
              <v-icon size="small" class="mr-2">mdi-clock-check</v-icon>
              <span>Temporal Resolution: {{ temporalResolution }}</span>
            </div>
          </v-col>
        </v-row>
      </div>

      <!-- Advanced Options -->
      <v-expansion-panels variant="accordion" class="mt-4">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon class="mr-2">mdi-cog</v-icon>
            Advanced Options
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="6">
                <v-switch
                  v-model="advancedOptions.excludeWeekends"
                  label="Exclude Weekends"
                  density="compact"
                  @update:model-value="updateAdvancedOptions"
                />
              </v-col>
              <v-col cols="6">
                <v-switch
                  v-model="advancedOptions.excludeHolidays"
                  label="Exclude Holidays"
                  density="compact"
                  @update:model-value="updateAdvancedOptions"
                />
              </v-col>
            </v-row>
            <v-slider
              v-model="advancedOptions.minDataPointsPerGroup"
              label="Minimum Data Points per Group"
              :min="1"
              :max="50"
              step="1"
              thumb-label
              @update:model-value="updateAdvancedOptions"
            />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { 
  AggregationPreview as AggregationPreviewType,
  AggregationPattern 
} from '../../types/aggregation';

const props = defineProps<{
  previewData: AggregationPreviewType;
  pattern: AggregationPattern;
}>();

const emit = defineEmits<{
  'update-pattern': [pattern: Partial<AggregationPattern>];
}>();

const advancedOptions = ref({
  excludeWeekends: false,
  excludeHolidays: false,
  minDataPointsPerGroup: 5
});

const enabledDays = computed(() => 
  props.pattern.selectedDays.filter(day => day.enabled)
);

const enabledHours = computed(() => 
  props.pattern.selectedHours.filter(hour => hour.enabled)
);

const averageGroupSize = computed(() => {
  if (props.previewData.aggregationGroups.length === 0) return 0;
  const total = props.previewData.aggregationGroups.reduce((sum, group) => sum + group.dataPointCount, 0);
  return Math.round(total / props.previewData.aggregationGroups.length);
});

const compressionRatio = computed(() => {
  if (props.previewData.totalDataPoints === 0) return 0;
  return Math.round((1 - props.previewData.estimatedOutputSize / props.previewData.totalDataPoints) * 100);
});

const coveragePercentage = computed(() => {
  // Calculate what percentage of the requested time slots have data
  const totalPossibleSlots = enabledDays.value.length * enabledHours.value.length;
  const daysInRange = Math.ceil((props.pattern.dateRange.end.getTime() - props.pattern.dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
  const totalExpectedPoints = totalPossibleSlots * daysInRange;
  
  if (totalExpectedPoints === 0) return 0;
  return Math.round((props.previewData.selectedTimestamps.length / totalExpectedPoints) * 100);
});

const temporalResolution = computed(() => {
  if (props.previewData.aggregationGroups.length <= 1) return 'Single point';
  
  const avgInterval = props.previewData.aggregationGroups.reduce((sum, group, index) => {
    if (index === 0) return sum;
    const prevGroup = props.previewData.aggregationGroups[index - 1];
    return sum + (group.startTime - prevGroup.endTime);
  }, 0) / (props.previewData.aggregationGroups.length - 1);
  
  const days = avgInterval / (24 * 60 * 60 * 1000);
  if (days < 1) return `${Math.round(days * 24)} hours`;
  if (days < 7) return `${Math.round(days)} days`;
  return `${Math.round(days / 7)} weeks`;
});

function getGroupColor(index: number): string {
  const colors = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7'];
  return colors[index % colors.length];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function updateAdvancedOptions() {
  // Emit pattern updates based on advanced options
  emit('update-pattern', {
    // Add advanced options to pattern if needed
  });
}
</script>

<style scoped>
.aggregation-preview {
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
}

.preview-stats .v-card {
  min-height: 80px;
}

.timeline-container {
  max-height: 300px;
  overflow-y: auto;
}

.timeline-group {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.5);
}

.timeline-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-group-label {
  font-weight: 500;
  font-size: 0.875rem;
}

.timeline-group-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.timeline-group-fill {
  height: 100%;
  background: var(--group-color);
  width: 100%;
  border-radius: 2px;
}

.timeline-group-dates {
  text-align: center;
}

.quality-metric {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
}
</style>