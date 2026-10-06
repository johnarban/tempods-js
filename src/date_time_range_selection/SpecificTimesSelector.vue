<template>
  <div class="mt-2 dtrs-flex-time-box">
    <!-- pa-0: v-col adds 12px of padding on each side by default, which is
         24px of a panel that can be under 200px wide. -->
    <v-col class="pa-0">
    <v-radio-group
      v-model="allDay"
      direction="horizontal"
      hide-details
      class="mb-2"
      >
      <v-radio
        label="Entire Day"
        :value="true"
      >
        <template #label="{label}">
          <div class="radio-info-label">
          <div>{{ label }}</div>
          <info-button>
            <div>
              <p>
                TEMPO only collects data during daylight hours. 
                Depending on the time of year, different time ranges will be available on a given day
              </p>
            </div>
          </info-button>
        </div>
        </template>
      </v-radio>
      <v-radio
        label="Specific Times"
        :value="false"
      >
        <template #label="{label}">
          <div class="radio-info-label">
          <div>{{label}}</div>
          <info-button>
            <div>
              <p>
                Select the times of day you want to include data for. TEMPO will only collect data during daylight hours.
                The times you pick will be used for each region and corrected for timezone differences. For example, creating
                a time range of 9:00-11:00 would pull data from 9:00-11:00 Eastern Time for New York, and 9:00-11:00 Pacific Time for Los Angeles.
              </p>
              <br />
              <p>
                If the region you request data from happens to span multiple timezones, we will use the timezone in the center of the region.
              </p>
            </div>
          </info-button>
          </div>
        </template>
      </v-radio>
    </v-radio-group>
    <v-combobox
      v-if="!allDay"
      v-model="selectedTimesRef"
      :items="timeOptions"
      label="Add/select times"
      multiple
      chips
      closable-chips
      density="compact"
      variant="outlined"
      hint="Times selected or entered will be local to each region"
      persistent-hint
      @update:model-value="normalizeTimes"
    />
    <!-- <div v-else class="dtrs-all-day-label">
      All Times Selected
    </div> -->
  </v-col>
    
    <!-- <div class="pm-wrapper">
      <input
        id="dtrs-time-plus-minus"
        type="checkbox"
        v-model="timePlusMinus"
        :true-value="12"
        :false-value="0.5"
      />
      <label for="dtrs-time-plus-minus">All Day</label>
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import { DEFAULT_TOLERANCE, ALL_DAY_TOLERANCE } from './date_time_range_generators';
import { _normalizeTimes } from '@/utils/parse_time_strings';
import InfoButton from '@/components/InfoButton.vue';

function timeFormat(hour: number, minute: number, ampm = true): string {
  if (ampm) {
    // from 24 hour to am/pm
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    if (minute === 0) {
      return `${h12} ${ampm}`;
    }
    return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
  } else {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
}

const selectedTimes = defineModel<string[]>({
  type: Array as () => string[]
});
const timePlusMinus = defineModel<[number, number]>('timePlusMinus', {
  type: Array as unknown as () => [number, number],
  default: () => [...DEFAULT_TOLERANCE]
});
const timeOptions = ref<string[]>(Array.from({ length: 15 }, (_, h) => timeFormat(h + 6, 0, true))); // 6:00 to 20:00

const allDay = computed({
  get: () => timePlusMinus.value[0] === ALL_DAY_TOLERANCE[0] && timePlusMinus.value[1] === ALL_DAY_TOLERANCE[1],
  set: (val: boolean) => {
    timePlusMinus.value = val ? [...ALL_DAY_TOLERANCE] : [...DEFAULT_TOLERANCE];
  }
});

const _selectedTimesRef = ref<string[]>([]);
const selectedTimesRef = computed({
  get: () => {
    if (allDay.value) return timeOptions.value;
    return _selectedTimesRef.value;
  },
  set: (value: string[]) => {
    // console.log('selectedTimesRef set to', value);
    _selectedTimesRef.value = value;
  }
});


watch(selectedTimesRef, (value: string[]) => {
  // console.log('selectedTimesRef changed to', value);
  if (allDay.value) {
    selectedTimes.value = [];
    return;
  }
  selectedTimes.value = value;
});

// Normalize entered times to HH:MM 24h (flexible entry via copilot)
function normalizeTimes(values: string[]) {
  const normalized = _normalizeTimes(values, timeFormat);
  const unique = Array.from(new Set(normalized));
  selectedTimesRef.value = unique;
  return unique;
}
</script>

<style scoped>
.dtrs-flex-time-box {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
}

.pm-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.pm-wrapper > span {
  font-size: 1.2em;
  line-height: 1;
}

/* The info icons line up in a column at the right edge of the card.
   Vuetify's label is content-sized (flex: 0 1 auto, measured 107px in a 182px
   row), so justify-content: space-between had no free space to distribute -
   which is why lining the icons up used to need a fixed-width label, and why
   that label then could not shrink. Letting the label fill the row gives
   space-between something to work with, so the icons align and the text is
   still free to shrink and wrap.

   :has() keeps this off the combobox's own floating label, which is a
   .v-label in this same card. */
.dtrs-flex-time-box :deep(.v-label:has(.radio-info-label)) {
  flex: 1 1 auto;
  min-width: 0;
}

.radio-info-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  /* A flex item will not shrink below its content unless told to. */
  min-width: 0;
}

.radio-info-label > div {
  /* Was width: 16ch, which measured 155px and stayed 155px at every panel
     width - the row could not shrink, so below about 280px of panel the row
     ran off the right edge and the panel started scrolling sideways
     (measured: at 240px, scrollWidth 250 vs clientWidth 226). Letting the
     text shrink and wrap is what keeps it inside the card.

     The alignment the fixed width gave is kept, by the rule above. */
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>