<template>
  <div class="map-view">
    <h2>Explore Map View</h2>
    <p class="my-2">Select a date and timezone to display</p>
    <div class="map-view-controls">
      <div class="date-view-controls mt-2">
        <div class="d-flex flex-row align-center">
          <v-radio-group v-model="radio">
            <date-picker
              class="cds__date-picker tall"
              ref="calendar"
              :model-value="singleDateSelected"
              @internal-model-change="(value: Date) => {
                if (value != null && value.getTime() != singleDateSelected.getTime()) {
                  radio = null;
                  singleDateSelected = value;
                  closeCalendarAfterSelection();
                }
              }"
              :allowed-dates="uniqueDays"
              :teleport="true"
              :arrow-navigation="true"
              @open="focusCalendarMenu"
              @update-month-year="onCalendarMonthChange"
              @closed="returnFocusToInput"
              :input-attrs="{clearable: false}"
              :time-config="{ enableTimePicker: false }"
              :multi-dates="false"
              :transitions="false"
              :formats="{'input': (date: Date | null) => date?.toDateString(), 'preview': (date: Date | null) => date?.toDateString()}"
              :week-start="0"
              no-today
              dark
              :year-range="[uniqueDays[0]?.getFullYear(), uniqueDays[uniqueDays.length - 1]?.getFullYear()]"
              six-weeks
            >
              <!--
                This slot REPLACES vue-datepicker's own action buttons, and its
                Cancel button lives in there -- so overriding it to add Latest
                quietly left Escape as the only way out of the calendar, with
                nothing on screen to say so. Cancel goes back first, which is
                where the picker puts it by default.
              -->
              <template #action-buttons>
                <button
                  class="dp__action_button dp__action-cancel"
                  type="button"
                  @click="() => calendar?.closeMenu()"
                >
                  Cancel
                </button>
                <button
                  class="dp__action_button dp__action-latest"
                  type="button"
                  @click="selectLatestDate"
                  :disabled="singleDateSelected === uniqueDays[uniqueDays.length - 1]"
                >
                  Latest
              </button>
              </template>
              <!-- <template #action-extra="{ selectCurrentDate }">
              
              </template> -->
            </date-picker>
            <!-- time chips to select time specifically for esri times -->
          </v-radio-group>
        </div>        
        <!--
          add buttons to increment and decrement the singledateselected

          No @keyup.enter on these: a v-btn renders a real <button>, and the
          browser already fires a click when Enter is pressed on one. Handling
          Enter as well ran the step twice, so each press moved two days
          (measured: Enter -2, Space -1, mouse -1). Space is fine either way,
          because its native click arrives on keyup and never matched the
          .enter modifier. Only things that are not real buttons - a v-icon
          with role="button", say - need Enter wired up by hand.
        -->
        <div class="d-flex flex-row align-center my-2">
          <v-tooltip :disabled="touchscreen" text="Previous Date">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                class="rounded-icon-wrapper"
                @click="store.moveBackwardOneDay"
                :disabled="singleDateSelected === uniqueDays[0]"
                color="#009ade"
                variant="outlined"
                elevation="0"
                size="md"
              >
                <v-icon>mdi-chevron-double-left</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          <v-spacer></v-spacer>
          <v-tooltip :disabled="touchscreen" text="Get Data for latest available day">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                style="padding-inline: 4px;"
                @click="() => singleDateSelected = uniqueDays[uniqueDays.length - 1]"
                :disabled="singleDateSelected === uniqueDays[uniqueDays.length - 1]"
                color="#009ade"
                variant="outlined"
                elevation="0"
                size="md"
              >
                Latest Available Data
              </v-btn>
            </template>
          </v-tooltip>
          <v-spacer></v-spacer>
          <v-tooltip :disabled="touchscreen" text="Next Date">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                class="rounded-icon-wrapper"
                @click="store.moveForwardOneDay"
                :disabled="singleDateSelected === uniqueDays[uniqueDays.length - 1]"
                color="#009ade"
                variant="outlined"
                elevation="0"
                size="md"
              >
                <v-icon>mdi-chevron-double-right</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </div>
      <div class="map-dropdown-container d-flex flex-row flex-wrap">
        <!--
          menu-props z-index: the tour's step is the Timezone dropdown, and the
          menu is teleported to <body>, so it lands outside the cutout Shepherd
          makes in its modal overlay. At Vuetify's default the overlay (z-index
          9997) paints over the open menu, which greys the options out, and its
          <path> is the topmost element at each option, so clicks never reach
          them - choosing a timezone during the tour did nothing. 10000 clears
          both the overlay and Shepherd's own step dialog at 9999.
        -->
        <v-select
          v-model="selectedTimezone"
          class="map-dropdowns timezone-dropdown"
          label="Timezone"
          :items="timezoneOptions"
          item-title="name"
          item-value="tz"
          :menu-props="{ zIndex: 10000 }"
          hide-details
          dense
          variant="outlined"
        ></v-select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { supportsTouchscreen } from "@cosmicds/vue-toolkit";

import { type MoleculeType } from "@/esri/utils";
import { useTempoStore } from "@/stores/app";
import { useDatePickerKeyboard } from "@/composables/useDatePickerKeyboard";
// import { useEsriTimesteps } from "@/composables/useEsriTimesteps";

// import TimeChips from "@/components/TimeChips.vue";

const store = useTempoStore();
const {
  singleDateSelected,
  uniqueDays,
  selectedTimezone,
  timezoneOptions,
} = storeToRefs(store);

const emit = defineEmits<{
  (event: "molecule", molecule: MoleculeType): void;
}>();

const molecule = ref<MoleculeType>('no2');

const radio = ref<number | null>(null);
const touchscreen = supportsTouchscreen();

const calendar = ref<typeof VueDatePicker | null>(null);

// The menu is teleported to <body> so the scrolling controls panel can't clip it,
// but that also drops it at the end of the document's tab order: measured 8 Tab
// presses from the input to reach the calendar, against 2 when it renders in
// place. Moving focus into the menu as it opens fixes that and beats both -- the
// keyboard is on the calendar straight away -- and putting focus back on the
// input when it closes keeps the reader's place in the page.
// Only one picker menu can be open at a time, so the open one is unambiguous;
// vue-datepicker exposes no per-instance handle on the teleported node.
//
// This also fixes the calendar being unreachable during a tour. Teleporting puts
// the menu outside both the tour popup and the tour's highlighted target, and
// Shepherd's Tab handler wraps focus between those two ranges -- so with a tour
// step up, every Tab stayed in the tour. Once focus is inside the menu Shepherd
// has no listener there and Tab moves through the calendar normally.
//
// The calendar's keyboard handling - moving focus into the menu on open,
// keeping days with no data out of the tab order, putting focus back on close,
// and closing after a date is picked - is shared with the three pickers in the
// date range creator. See useDatePickerKeyboard for why each piece is needed.
const {
  onOpen: focusCalendarMenu,
  onMonthChange: onCalendarMonthChange,
  onClosed: returnFocusToInput,
  closeAfterSelection: closeCalendarAfterSelection,
} = useDatePickerKeyboard(calendar);

// "Latest" is a shortcut for picking the last available day, so it ends the same
// way choosing that day in the grid does. It sets singleDateSelected directly
// rather than going through the picker, so it never reached the
// internal-model-change handler where the close lives -- which left the calendar
// open afterwards with focus nowhere, a dead end for anyone on a keyboard.
// Closing before setting the date, rather than after: changing the date makes
// the picker re-initialise, and that re-render puts the menu back up over a
// close issued alongside it. Selecting a day in the grid gets away with a
// deferred close because it runs inside the picker's own handling; this button
// runs outside it, and from keyup the frames do not line up -- the date applied
// and the calendar stayed open. Closing first has no race to lose.
function selectLatestDate() {
  const latest = uniqueDays.value[uniqueDays.value.length - 1];
  if (latest == null) {
    return;
  }
  calendar.value?.closeMenu();
  radio.value = null;
  singleDateSelected.value = latest;
}


watch(molecule, (newMol: MoleculeType) => {
  emit("molecule", newMol);
});
</script>

<style lang="less">

.map-view {
  margin: 1rem;
}

.map-view-controls {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1rem;
}

.date-view-controls {
  flex: 0 0 auto; /* Don't shrink, don't grow, auto width */
  min-width: 220px; /* Minimum width before parent wraps */
}

.cds__date-picker .tall {
  height: 58px;
}

.map-dropdown-container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1rem;
  flex: 1 1 210px; 

  .map-dropdowns {

    font-family: var(--dp-font-family);
    height: 56px !important;

    .v-field--variant-outlined .v-field__outline__start, .v-field--variant-outlined .v-field__outline__end {
      border-color: rgba(255, 255, 255, 0.7);
      opacity: 1;
    }

    .v-field--variant-outlined .v-field__outline__notch {
      border-bottom: solid 1px rgba(255, 255, 255, 0.7);
    }

    .v-field--variant-outlined .v-field__outline__notch::after {
      border-bottom: solid 1px rgba(255, 255, 255, 0.6);
    }

    &.timezone-dropdown {
      width: 220px !important;
      max-width: 220px !important;
    }

    &.molecule-dropdown {
      width: 220px !important;
      max-width: 220px !important;
    }

  }
}

</style>
