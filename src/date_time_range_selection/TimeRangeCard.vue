<!-- TimeRange Card to display time range configuration -->
<template>
  <v-hover v-slot="{ isHovering, props }">
    <div v-bind="props" class="time-range-card">
      
      <!-- Display Date -->
      <div v-if='timeRange?.config === undefined' class="time-range-config-name">
          {{ (name && name!=='') ? name : timeRange.name }} 
      </div>
      
        
      <!-- Single Date -->
      <div class="time-range-single" v-if="timeRange.config && timeRange.config.type==='single'">
        <div class="time-range-config-name">
          {{ (new Date(timeRange.config.singleDate)).toLocaleDateString(undefined, { timeZone: 'UTC'})}}
        </div>
      </div>
      
      
      <!-- Multiple Date -->
      <div class="time-range-multiple" v-if="timeRange.config && timeRange.config.type==='multiple'">
        <!-- Name -->
        <div class="time-range-config-name">
          {{ timeRange.name}}
        </div>
      
        <v-expand-transition>
          <div v-if="isHovering">
            <!-- Date Range -->
            <div class="time-range-config-item">
              <strong>Date Range:</strong> 
              {{ formatDate(timeRange.config.dateRange.start) }} - {{ formatDate(timeRange.config.dateRange.end) }}
            </div>
            
            <!-- Years -->
            <div v-if="timeRange.config.years" class="time-range-config-item">
              <strong>Years:</strong> {{ timeRange.config.years.join(', ') }}
            </div>
            
            <!-- Months -->
            <div v-if="timeRange.config.months" class="time-range-config-item">
              <strong>Months:</strong> {{ timeRange.config.months.map(s => s.slice(0,3)).join(', ') }} 
            </div>
            
            <!-- Weekdays -->
            <div v-if="timeRange.config.weekdays" class="time-range-config-item">
              <strong>Weekdays:</strong> {{ timeRange.config.weekdays.map(s => s.slice(0,3)).join(', ') }} 
            </div>
            
            <!-- Actual Time ranges -->
            <div v-if="timeRange.config.times" class="time-range-config-item">
              <strong>Times:</strong> {{ timeRange.config.times.join(', ') }}
            </div>
          </div>
        </v-expand-transition>
      </div>
    </div>
    
  </v-hover>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { TimeRangeConfig } from './date_time_range_generators';
import type { TimeRange } from '@/types';

const formatDate = (date: Date): string => {
  try {
    return (new Date(date)).toLocaleDateString(undefined, { timeZone: 'UTC' });
  } catch (e) {
    console.error('Format Date in TimeRangeCard', date);
    return String(date);
  }
};

const props = defineProps<{
  name?: string;
  timeRange: TimeRange;
}>();
// console.log('TimeRangeCard props:', props.timeRange.config);
</script>
    

<style land="less" scoped>
.time-range-card {
  border-radius: 8px;
  padding: 4px 16px;
  height: fit-content;
}

.time-range-config-name {
  font-weight: bold;
  margin-bottom: 8px;
}

.time-range-config-item {
  margin-bottom: 2px;
  font-size: 0.8em;
}
</style>