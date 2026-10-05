<!-- TimeRange Card to display time range configuration -->
<template>
    <div class="time-range-card">
      
      <!-- Display Date -->
      <div v-if='timeRange?.config === undefined' class="time-range-config-name">
          {{ (name && name!=='') ? name : timeRange.name }} 
      </div>
      
        
      <!-- Single Date -->
      <v-expand-transition>
        <div class="time-range-single" v-if="timeRange.config && timeRange.config.type==='single' && showDetails">
          <div class="time-range-config-item">
            {{ (new Date(timeRange.config.singleDate)).toLocaleDateString(undefined, { timeZone: 'UTC'})}}
          </div>
        </div>
      </v-expand-transition>
      
      
      <!-- Multiple Date -->
      <div class="time-range-multiple" v-if="timeRange.config && timeRange.config.type==='multiple'">
        <!-- Name -->
        <div class="time-range-config-name">
          {{ timeRange.name}}
        </div>
      
        <v-expand-transition>
          <!--
            No @click here any more. Clicking the body of the details was a
            second way to collapse them, but a block of text is not a control:
            it was not focusable and nothing announced it as clickable. The
            button above and the chevron in TimeRangesControl both still
            toggle, and both are reachable from the keyboard.
          -->
          <div v-if="showDetails">
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
        <v-expand-transition>
          <!--
            This says "click to..." so it is a button, not a div: as a div it
            was not focusable, had no keyboard path and announced as plain
            text. A real <button> gets Enter and Space from the browser.
          -->
          <button
            type="button"
            class="time-range-show-details"
            v-if="isHovering"
            :aria-expanded="showDetails"
            @click="onShowClick"
          >
            Click to {{ showDetails ? 'hide' : 'show' }} details
          </button>
        </v-expand-transition>
        
        
      </div>
    </div>
</template>

<script setup lang="ts">
import {  ref, watch } from 'vue';
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
  isHovering?: boolean;
  show: boolean;
}>();
// console.log('TimeRangeCard props:', props.timeRange.config);

const showDetails = ref(false);
function onShowClick() {
  showDetails.value = !showDetails.value;
}

watch(() => props.show, (newVal) => {
  showDetails.value = newVal;
});
</script>
    

<style land="less" scoped>
.time-range-card {
  padding: 0px;
  height: fit-content;
}

.time-range-config-name {
  font-weight: normal;
  margin: 0;
  display: none;
}

.time-range-config-item {
  margin-bottom: 2px;
  font-size: 0.8em;
}

.time-range-show-details {
  font-size: 0.7em;
  background-color: cadetblue;
  border-radius: 4px;
  /* It is a <button> now, so undo the chrome a button brings and keep it
     looking like the inline text it was. The focus ring is left to the global
     :focus-visible rule. */
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  color: inherit;
  font-family: inherit;
  text-align: inherit;
  cursor: pointer;
}
</style>