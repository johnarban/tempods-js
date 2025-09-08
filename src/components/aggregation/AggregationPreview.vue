<template>
  <v-card class="aggregation-preview" elevation="1">
    <v-card-title class="d-flex align-center ga-2">
      <v-icon>mdi-eye-outline</v-icon>
      <span>Aggregation Preview</span>
    </v-card-title>
    
    <v-card-text>
      <div class="preview-summary mb-4">
        <v-row>
          <v-col cols="4">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ previewData.totalDataPoints }}</div>
              <div class="text-caption">Total Data Points</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ previewData.aggregationGroups }}</div>
              <div class="text-caption">Aggregation Groups</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card variant="outlined" class="text-center pa-3">
              <div class="text-h6">{{ previewData.dateRange.start.toLocaleDateString() }} - {{ previewData.dateRange.end.toLocaleDateString() }}</div>
              <div class="text-caption">Date Range</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <div class="preview-details">
        <h4 class="text-subtitle-1 mb-2">Selected Pattern Summary</h4>
        <v-chip-group>
          <v-chip
            v-for="day in pattern.selectedDays.filter(d => d.enabled)"
            :key="day.dayIndex"
            size="small"
            color="primary"
            variant="outlined"
          >
            {{ day.dayName }}
          </v-chip>
        </v-chip-group>
        
        <div class="mt-3">
          <div class="text-body-2 mb-1">Selected Hours:</div>
          <div class="hour-preview">
            <v-chip
              v-for="hour in pattern.selectedHours.filter(h => h.enabled).slice(0, 5)"
              :key="hour.hour"
              size="small"
              color="secondary"
              variant="outlined"
              class="mr-1 mb-1"
            >
              {{ hour.displayTime }}
            </v-chip>
            <v-chip
              v-if="pattern.selectedHours.filter(h => h.enabled).length > 5"
              size="small"
              variant="outlined"
              class="mr-1 mb-1"
            >
              +{{ pattern.selectedHours.filter(h => h.enabled).length - 5 }} more
            </v-chip>
          </div>
        </div>

        <div class="mt-3">
          <v-row>
            <v-col cols="6">
              <div class="text-body-2">Aggregation Method:</div>
              <div class="text-body-1 font-weight-medium">{{ pattern.aggregationMethod.toUpperCase() }}</div>
            </v-col>
            <v-col cols="6">
              <div class="text-body-2">Aggregation Period:</div>
              <div class="text-body-1 font-weight-medium">{{ pattern.aggregationPeriod.toUpperCase() }}</div>
            </v-col>
          </v-row>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.aggregation-preview {
  max-width: 100%;
}

.preview-summary .v-card {
  height: 100%;
}

.hour-preview {
  max-height: 100px;
  overflow-y: auto;
}
</style>