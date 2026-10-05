<template>
  <v-list>
    <!-- hide vestigial hover for now -->
    <!-- <v-hover
      v-for="(timeRange, index) in timeRanges"
      :key="index" v-slot="{ props }"
      close-delay="50"
      open-delay="250"
      > -->
    <!--
      tabindex="-1" keeps this out of the tab order - the card itself does
      nothing when activated - while still letting DatasetControls hand it
      focus after it is created, so the new time range announces itself.
    -->
    <v-list-item
      v-for="timeRange in timeRangesNewestFirst"
      :key="timeRange.id"
      :data-card-id="timeRange.id"
      tabindex="-1"
      class="my-2 rounded-lg time-range-v-list-item"
      density="compact"
      slim
    >
      <template #title>
        <div class="d-flex flex-row justify-space-between align-center">
          <span class="text-subtitle-2 font-weight-bold">
            {{ timeRange.name === 'Displayed Day' ? `Displayed Day: ${ formatTimeRange(timeRange.range) }` : (timeRange.name ?? formatTimeRange(timeRange.range)) }}
          </span>
          <v-btn
            v-if="hasDetails(timeRange)"
            class="float-right"
            :icon="showDetails[timeRange.id] ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            variant="text"
            density="compact"
            v-tooltip:top="showDetails[timeRange.id] ? 'Hide Details' : 'Show details'"
            @click.stop="showDetails[timeRange.id] = !showDetails[timeRange.id]"
          >
          </v-btn>
        </div>
      </template>
      <template #default>
        <TimeRangeCard
        class="mb-1"
        :name="timeRange.name === 'Displayed Day' ? `Displayed Day: ${ formatTimeRange(timeRange.range) }` : (timeRange.name ?? formatTimeRange(timeRange.range))"
        :time-range="timeRange"
        :show="showDetails[timeRange.id]"
        />
      <!-- </template> -->
      <!-- <template #append> -->
      <div class="datset-controls-action-buttons time-range-action-buttons justify-space-between">
        <v-btn
          v-if="timeRange.id !== 'displayed-day'"
          variant="plain"
          size="small"
          density="compact"
          v-tooltip:top="'Edit Name'"
          icon="mdi-pencil"
          color="white"
          @click.stop="() => emit('edit-time-range', timeRange)"
        ></v-btn>
        <v-tooltip
          :text="hasDatasets(timeRange) ? 'Cannot delete if used in a dataset' : 'Delete'"
          location="left"
        >
          <!--
            The wrapper div is here because a disabled button fires no mouse
            events, so the tooltip explaining why it is disabled would never
            show on hover. But Vuetify binds the activator's focus handler as a
            plain focus listener, which does not bubble, so focusing the button
            inside the wrapper never opened the tooltip and a keyboard user got
            nothing. Forwarding focus and blur to the handlers on the wrapper's
            props fixes that, and passing aria-describedby down puts the
            description on the thing a screen reader actually lands on.
          -->
          <template #activator="{ props }">
            <div class="d-flex" v-bind="props">
              <v-btn
                variant="plain"
                :icon="hasDatasets(timeRange) ? 'mdi-delete-off' : 'mdi-trash-can'"
                color="white"
                size="small"
                density="compact"
                :disabled="hasDatasets(timeRange)"
                :aria-describedby="props['aria-describedby']"
                @focus="props.onFocus?.($event)"
                @blur="props.onBlur?.($event)"
                @click.stop="() => emit('delete-time-range', timeRange)"
              ></v-btn>
            </div>
          </template>
        </v-tooltip>
      </div>
      </template>
    </v-list-item>
    <!-- </v-hover> -->
  </v-list>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { TimeRange, UserDataset } from "../types";
import { areEquivalentTimeRanges, formatTimeRange } from "../utils/timeRange";

import TimeRangeCard from "@/date_time_range_selection/TimeRangeCard.vue";

interface TimeRangesControlProps {
  timeRanges: TimeRange[];
  /** only used to decide whether a time range is safe to delete */
  datasets: UserDataset[];
}

const props = defineProps<TimeRangesControlProps>();

const emit = defineEmits<{
  (event: "edit-time-range", timeRange: TimeRange): void;
  (event: "delete-time-range", timeRange: TimeRange): void;
}>();

function hasDatasets(timeRange: TimeRange): boolean {
  return props.datasets.some(d => areEquivalentTimeRanges(d.timeRange, timeRange));
}

// show card details?
function hasDetails(timeRange: TimeRange): boolean {
  if (timeRange.config && timeRange.config.type === 'multiple') return true;
  // the description is the default, the name is what is customized
  if (timeRange.config && timeRange.config.type === 'single') return timeRange.name !== timeRange.description;
  return false;
}

// Newest first, to match the region and dataset lists: a card you just made
// sits next to the button that made it. Reverses a copy, so the store's order
// is untouched.
const timeRangesNewestFirst = computed(() => props.timeRanges.slice().reverse());

// Keyed by time range id rather than by position. It was an array indexed by
// the v-for index, and sized from props.datasets rather than props.timeRanges,
// so it was already the wrong length; with the list reversed, inserting at the
// top would also have shifted every card's open/closed state down by one.
const showDetails = ref<Record<string, boolean>>({});
</script>

<style scoped lang="less">
.datset-controls-action-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
}
.time-range-action-buttons {
  text-align: right;
}

.time-range-v-list-item:nth-child(odd) {
  background-color: #444444;
}
.time-range-v-list-item:nth-child(even) {
  background-color: #656565;
}

:deep(.v-list-item-title)
{
  font-size: 10pt;
}
</style>
