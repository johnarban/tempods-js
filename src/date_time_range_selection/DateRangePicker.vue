<template>
  <!-- TODO -- make the date pickers have sharper colors -->
  <div id="dual-date-range-picker">
    <div class="ddrp__picker mb-4">
      <!-- A heading, not a label: vue-datepicker generates its own input, so
           there is no id to point a `for` at. The input gets its accessible
           name from the picker's ariaLabels prop below instead. That prop is
           spelled in camelCase deliberately - written as :aria-labels it looks
           like an ARIA attribute, which it is not, and the a11y linter rejects
           it as an invalid one. -->
      <div class="text-subtitle-2 mb-2 d-block">Start Date</div>
      <date-picker
        class="cds__date-picker"
        ref="startDateCalendar"
        :ariaLabels="{ input: 'Start Date' }"
        :model-value="startDateObj"
        @internal-model-change="handleStartDateChange"
        :allowed-dates="allowedDates"
        :formats="{'input': format, 'preview': format }"
        :input-attrs="{ clearable }"
        :text-input="textInput"
        :teleport="true"
        :arrow-navigation="true"
        @open="startKeyboard.onOpen"
        @update-month-year="startKeyboard.onMonthChange"
        @closed="startKeyboard.onClosed"
        :dark="dark"
        :year-range="yearRange"
        :time-config="{ enableTimePicker: false }"
        :max-date="endDateObj ?? new Date()"
        :week-start="0"
        prevent-min-max-navigation
        six-weeks
      >
        <!--
          This slot REPLACES the picker's own action buttons, Cancel included,
          so overriding it to add Latest left Escape as the only way out with
          nothing on screen saying so. Cancel goes first, where the picker puts
          it by default.
        -->
        <template #action-buttons>
          <button
            class="dp__action_button dp__action-cancel"
            type="button"
            @click="() => startDateCalendar?.closeMenu()"
          >
            Cancel
          </button>
          <button
            class="dp__action_button dp__action-latest"
            @click="() => allowedDates ? handleStartDateChange(allowedDates[allowedDates.length - 1]) : null"
            :disabled="!allowedDates || !!(endDateObj && (allowedDates[allowedDates.length - 1] > endDateObj))"
            elevation="0"
            size="sm"
          >
            Latest
          </button>
        </template>
      </date-picker>
    </div>
    
    <div class="ddrp__picker mb-4">
      <!-- A heading, not a label: vue-datepicker generates its own input, so
           there is no id to point a `for` at. The input gets its accessible
           name from the picker's ariaLabels prop below instead. That prop is
           spelled in camelCase deliberately - written as :aria-labels it looks
           like an ARIA attribute, which it is not, and the a11y linter rejects
           it as an invalid one. -->
      <div class="text-subtitle-2 mb-2 d-block">End Date</div>
      <date-picker
        class="cds__date-picker"
        ref="endDateCalendar"
        :ariaLabels="{ input: 'End Date' }"
        :model-value="endDateObj"
        @internal-model-change="handleEndDateChange"
        :allowed-dates="allowedDates"
        :formats="{input: format, preview: format}"
        :input-attrs="{ clearable }"
        :teleport="true"
        :arrow-navigation="true"
        @open="endKeyboard.onOpen"
        @update-month-year="endKeyboard.onMonthChange"
        @closed="endKeyboard.onClosed"
        :dark="dark"
        :year-range="yearRange"
        :time-config="{ enableTimePicker: false }"
        :min-date="startDateObj ?? new Date(0)"
        :week-start="0"
        prevent-min-max-navigation
        six-weeks
      >
        <template #action-buttons>
          <button
            class="dp__action_button dp__action-cancel"
            type="button"
            @click="() => endDateCalendar?.closeMenu()"
          >
            Cancel
          </button>
          <button
            class="dp__action_button dp__action-latest"
            @click="() => allowedDates ? handleEndDateChange(allowedDates[allowedDates.length - 1]) : null"
            :disabled="!allowedDates"
            elevation="0"
            size="sm"
          >
            Latest
          </button>
        </template>
      </date-picker>
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDatePickerKeyboard } from '@/composables/useDatePickerKeyboard';


const props = defineProps<{
  startDate?: Date | null;
  endDate?: Date | null;
  allowedDates?: Date[];
  formatFunction?: (date: Date) => string;
  clearable?: boolean;
  textInput?: boolean;
  teleport?: boolean;
  dark?: boolean;
  yearRange?: [number, number];
}>();

const format = (date: Date | null) => {
  if (date === null) {
    throw new Error('Date is null' );
  }
  if (props.formatFunction) {
    return props.formatFunction(date);
  }
  return date.toLocaleDateString();
};

const emit = defineEmits<{
  'update:startDate': [date: Date | null];
  'update:endDate': [date: Date | null];
}>();


const startDateCalendar = ref();
const endDateCalendar = ref();

// One instance per picker: each has to hand focus back to its own input, and
// each closes its own menu after a date is chosen.
const startKeyboard = useDatePickerKeyboard(startDateCalendar);
const endKeyboard = useDatePickerKeyboard(endDateCalendar);
const startDateObj = ref<Date | null>(props.startDate ?? null);
const endDateObj = ref<Date | null>(props.endDate ?? null);
const errMessage = ref<string>('');


function handleStartDateChange(value: Date | null) {
  if (value !== null && value.getTime() !== startDateObj.value?.getTime()) {
    if (endDateObj.value && value > endDateObj.value) {
      errMessage.value = 'Start date cannot be after end date.';
      console.error(errMessage.value);
      return;
    }
    startDateObj.value = value;
    emit('update:startDate', value);
    startKeyboard.closeAfterSelection();
  }
}

function handleEndDateChange(value: Date | null) {
  if (value !== null && value.getTime() !== endDateObj.value?.getTime()) {
    if (startDateObj.value && value < startDateObj.value) {
      errMessage.value = 'End date cannot be before start date.';
      console.error(errMessage.value);
      return;
    }
    
    endDateObj.value = value;
    emit('update:endDate', value);
    endKeyboard.closeAfterSelection();
  }
}




watch(() => props.startDate, (newDate) => {
  if (newDate?.getTime() !== startDateObj.value?.getTime()) {
    startDateObj.value = newDate ?? null;
  }
});

watch(() => props.endDate, (newDate) => {
  if (newDate?.getTime() !== endDateObj.value?.getTime()) {
    endDateObj.value = newDate ?? null;
  }
});

</script>

<style>
#dual-date-range-picker {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 8px;
  flex-wrap: wrap;
}

#dual-date-range-picker > div.ddrp__picker {
  flex-basis: 48%;
  min-width: 150px;
}


</style>
