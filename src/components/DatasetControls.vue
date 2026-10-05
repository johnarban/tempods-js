<template>
  <div id="dataset-sections" :style="cssVars">
    <div id="add-region-time">
      <p>
        Select a Region, Time Range, and Molecule to create a dataset of your choice!
      </p>
    <v-dialog
      v-model="showConfirmReset"
      max-width="35%"
    >
      <v-card class="popup-card--outline">
        <v-card-text>
          Are you sure you want to delete all of your selections? 
          This will remove all of your regions, time ranges, 
          and datasets, and cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="error"
            @click.stop="showConfirmReset = false"
          >
            No
          </v-btn>
          <v-btn
            color="success"
            @click.stop="() => {
              store.reset();
              serializeTempoStore(store);
              showConfirmReset = false;
            }"
          >
            Yes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
      <v-expansion-panels
        v-model="openPanels"
        variant="accordion"
        id="user-options-panels"
        multiple
      > 
        <v-expansion-panel
          title="Regions"
          class="mt-3 h3-panel-titles"
        >
          <template #title>
            My  Regions
            <popup-info-button
                info-text="Click the region card to go to that region on the map. Click the pen to rename a region. Click the trash can to delete a region. If an existing dataset is using a region, it cannot be deleted."
                :width="popupCardWidth"
              >
              </popup-info-button>
          </template>
          <template #text>
            <div id="add-region-buttons">
              <v-btn
                size="small"
                :active="selectionActive === 'rectangle'"
                :disabled="selectionActive === 'point'"
                :color="accentColor2"
                @click.stop="() => {
                  selectionActive = (selectionActive === 'rectangle') ? null : 'rectangle';
                }"
              >
                <template #prepend>
                  <v-icon v-if="selectionActive !== 'rectangle'" icon="mdi-plus"></v-icon>
                </template>
                {{ selectionActive === 'rectangle' ? "Cancel" : "New Region" }}
              </v-btn>
              <popup-info-button
                info-html="<p>To select a region, click and drag a rectangle across the map.</p><p class='mt-2'>From the keyboard: this button moves focus to the map, where the arrow keys pan and the <kbd>+</kbd> and <kbd>-</kbd> keys zoom. Press <kbd>Enter</kbd> to make a region of the area shown on the map, or <kbd>Esc</kbd> to stop selecting.</p>"
                :width="popupCardWidth"
              >
              </popup-info-button>
            </div>
            <v-checkbox
              v-model="showSamplingPreviewMarkers"
              class="show-sample-points-toggle"
              label="Show sample points"
              density="compact"
              hide-details
            >
              <template #append>
                <popup-info-button
                  info-html="Checking this box will display the pixels of your selected region where data will be requested from the server. <p> When a large region is selected, we sample an evenly-spaced subset of approximately 30 pixels to shorten the data loading time. For each available time step, all the sampled data across the region will be averaged together.</p>"
                  :width="popupCardWidth"
                >
                </popup-info-button>
              </template>
            </v-checkbox>
            <div class="my-selections" v-if="regions.length>0" style="margin-top: 1em;">                 
              <v-slider
                v-model="regionOpacity"
                :min="0"
                :max="1"
                :step="0.01"
                label="Region Opacity"
                :color="tempoRed"
                density="compact"
                hide-details
                :thumb-size="12"
                :track-size="3"
              >
              </v-slider>
              <v-checkbox
                v-model="regionVisibility"
                label="Show regions"
                density="compact"
                hide-details
              >
              </v-checkbox>
              <!--
                v-list would give this role="list", but the cards inside it are
                buttons rather than list items (see below), and a list whose
                children are not listitems announces as empty. role="group"
                with a name keeps the cards bracketed as one thing without
                claiming they are a list.
              -->
              <v-list role="group" aria-label="My regions">
                <!--
                  Inside a v-list, Vuetify gives every clickable v-list-item
                  tabindex="-2" and expects the list to move focus around with
                  the arrow keys. That left only the first card reachable: Tab
                  landed on card 1's body, then went straight to the pencil and
                  trash buttons of every card in turn, skipping all the other
                  card bodies. tabindex="0" makes each card its own tab stop;
                  Enter and Space already work, because VListItem turns them
                  into a click itself. role="button" replaces the listitem role
                  Vuetify would otherwise apply, which said nothing about the
                  card being activatable.

                  Keyed by region.id, not by index: the ids are uuids from
                  createRegion, so deleting a region from the middle of the
                  list no longer makes Vue reuse one card's DOM for the next
                  region along.
                -->
                <v-list-item
                  v-for="(region, index) in regionsNewestFirst"
                  :class="` my-2 rounded-lg region-list-item region-list-item-${index}`"
                  :key="region.id"
                  :data-card-id="region.id"
                  tabindex="0"
                  role="button"
                  :title="region.name"
                  :style="{ 'background-color': region.color, color: contrastingColor(region.color) }"
                  @click.stop="() => focusRegion = region"
                  density="compact"
                  slim
                >
                  <template #append>
                    <!-- New: Edit Geometry button (disabled if any selection using region has samples) -->
                    <!-- <v-btn
                      variant="plain"
                      :icon="region.geometryType === 'rectangle' ? 'mdi-select' : 'mdi-plus'"
                      color="white"
                      :disabled="regionHasSamples(region as UnifiedRegionType)"
                      v-tooltip="regionHasSamples(region as UnifiedRegionType) ? 'Cannot edit geometry after samples are fetched for a selection using this region' : 'Edit Geometry'"
                      @click="() => editRegionGeometry(region as UnifiedRegionType)"
                    ></v-btn> -->
                    <div class="datset-controls-action-buttons region-action-buttons">
                    <v-btn
                      variant="plain"
                      v-tooltip:top="'Edit Name /  Color'"
                      icon="mdi-pencil"
                      color="white"
                      size="small"
                      density="compact"
                      @click.stop="(event: MouseEvent | KeyboardEvent) => {
                        editRegionName(region as UnifiedRegionType);
                      }"
                    ></v-btn>
                    <v-tooltip
                      :text="store.regionHasDatasets(region as UnifiedRegionType) ? 'Cannot delete if used in a dataset' : 'Delete'"
                      location="left"
                    >
                      <!--
                        The wrapper div is here because a disabled button fires
                        no mouse events, so the tooltip explaining why it is
                        disabled would never show on hover. But Vuetify binds
                        the activator's focus handler as a plain focus
                        listener, which does not bubble, so focusing the button
                        inside the wrapper never opened the tooltip and a
                        keyboard user got nothing. Forwarding focus and blur to
                        the handlers on the wrapper's props fixes that, and
                        passing aria-describedby down puts the description on
                        the thing a screen reader actually lands on.
                      -->
                      <template #activator="{ props }">
                        <div class="d-flex" v-bind="props">
                          <v-btn
                            variant="plain"
                            :icon="store.regionHasDatasets(region as UnifiedRegionType) ? 'mdi-delete-off' : 'mdi-trash-can'"
                            color="white"
                            size="small"
                            density="compact"
                            :disabled="store.regionHasDatasets(region as UnifiedRegionType)"
                            :aria-describedby="props['aria-describedby']"
                            @focus="props.onFocus?.($event)"
                            @blur="props.onBlur?.($event)"
                            @click.stop="(event: MouseEvent | KeyboardEvent) => {
                                store.deleteRegion(region as UnifiedRegionType);
                            }"
                          ></v-btn>
                          </div>
                      </template>
                    </v-tooltip>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </template>
        </v-expansion-panel>
        
        <v-divider
          class="mt-3"
          opacity="1"
        >
        </v-divider>
        
        <v-expansion-panel
          title="My Time Ranges"
          class="mt-3 h3-panel-titles"
        >
          <template #text>
            <v-btn
              size="small"
              :active="createTimeRangeActive"
              :color="accentColor2"
              @click.stop="createTimeRangeActive = !createTimeRangeActive"
            >
              <template #prepend>
                <v-icon v-if="!createTimeRangeActive" icon="mdi-plus"></v-icon>
              </template>
              {{ createTimeRangeActive ? "Cancel" : "New Time Range" }}
            </v-btn>
            <date-time-range-selection
              v-show="createTimeRangeActive"
              :current-date="singleDateSelected"
              :allowed-dates="uniqueDays"
              @ranges-change="handleDateTimeRangeSelectionChange"
            />
            <div class="my-selections" v-if="timeRanges.length>0" style="margin-top: 1em;">

              <TimeRangesControl
                :time-ranges="timeRanges"
                :datasets="datasets"
                @edit-time-range="editTimeRangeName"
                @delete-time-range="store.deleteTimeRange"
              />
            </div>
          </template>
        </v-expansion-panel>

        <v-divider
          class="mt-3"
          opacity="1"
        >
        </v-divider>

        <v-expansion-panel
          title="My Datasets"
          class="mt-3 h3-panel-titles"
        >
        <template #text>
          <v-btn
            size="small"
            :active="createDatasetActive"
            :color="accentColor2"                    
            @click.stop="createDatasetActive = !createDatasetActive"
            class="mt-3"
          >
            <template #prepend>
              <v-icon v-if="!createDatasetActive" icon="mdi-plus"></v-icon>
            </template>
            {{ createDatasetActive ? "Cancel" : "New Dataset" }}
          </v-btn>
          <selection-composer
            v-show="createDatasetActive"
            :backend="backend"
            :time-ranges="timeRanges"
            :regions="regions"
            :molecule-ready="moleculeReady"
            :hidden-molecules="hiddenMolecules"
            :disabled="{ region: regions.length === 0, point: selectionActive === 'point', timeRange: timeRanges.length === 0 }"
            @create="handleDatasetCreated"
          >
          </selection-composer>
          <div class="my-selections" v-if="datasets.length>0" style="margin-top: 1em;">


            
            <DatasetCardControl
              :datasets="datasets"
              :turn-on-selection="allDatasetSelection"
              :show-error-bands="showErrorBands"
              v-model:selected-datasets="selectedDatasets"
              v-model:sample-error-id="sampleErrorID"
              v-model:open-selection="openSelection"
              v-model:table-selection="tableSelection"
              @edit-dataset="handleEditDataset"
              @remove-dataset="removeDataset"
              @retry-dataset="retryDataset"
              @aggregate-dataset="openAggregationDialog"
              @plot-click="handlePlotClick"
            />
              </div>
              <div v-if="allDatasetSelection" class="dataset-select-all-none">
                <v-btn
                  variant="outlined"
                  size="small"
                  @click.stop="selectedDatasets = datasets.map(d => d.id)"
                >
                  <template #prepend>
                    <v-icon icon="mdi-check-circle" color="success"/>
                  </template>
                  All
                </v-btn>
                <v-btn
                  variant="outlined"
                  size="small"
                  class="ml-2"
                  :disabled="selectedDatasets.length === 0"
                  @click.stop="selectedDatasets = []"
                >
                  <template #prepend>
                    <v-icon icon="mdi-close-circle" color="error"/>
                  </template>
                  Uncheck All
                </v-btn>
              </div>
              <!--
                These two used to sit in the DOM in the other order, with
                flex-column-reverse flipping them once a selection was under
                way. That put "Graph Selected Datasets" on top on screen while
                Tab still reached it second, so the DOM order is now the
                displayed order and the reverse is gone. "Graph Selected
                Datasets" only renders during a selection, so nothing changes
                when it is the other button on its own.
              -->
              <div class="d-flex flex-column align-items-center justify-space-between ga-2">
              <v-btn
              v-if="datasets.length > 1 && allDatasetSelection"
              :color="accentColor2"
              :disabled="selectedDatasets.length == 0"
              :variant="selectedDatasets.length > 0 ? 'flat' : 'flat'"
              size="small"
              @click.stop="showMultiPlot = true">
              Graph Selected Datasets
            </v-btn>
                <v-btn
                v-if="datasets.length > 1"
                :disabled="datasets.length === 0 || !datasets.every(d => d.samples || d.plotlyDatasets)"
                :color="allDatasetSelection ? '#333': '#ffcc33'" size="small" :block="false" @click.stop="allDatasetSelection = !allDatasetSelection">
                {{ allDatasetSelection ? 'Cancel Selection' : 'Select Datasets to Graph' }}
              </v-btn>
          </div>
        </template>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
  
  <div class="d-flex flex-column justify-center ga-1">
    
    
    
    <!--  -->
    <hr class="ma-2" style="width: 100%;"/>
    <v-btn
    v-if="regions.length > 0 || timeRanges.length > 1"
      color="#a63a3f"
      class="mx-2"
      @click.stop="showConfirmReset = true"
      size="small"
      >
      Delete ALL selections
    </v-btn>
  </div>
  
  <v-dialog
  v-model="showEditRegionNameDialog"
  >
    <RegionEditor
      v-if="regionBeingEdited"
      :region="regionBeingEdited"
      @change="(name: string, color: string) => {
        if (regionBeingEdited) {
          store.setRegionName(regionBeingEdited as UnifiedRegionType, name);
          store.setRegionColor(regionBeingEdited as UnifiedRegionType, color);
          showEditRegionNameDialog = false;
        }
      }"
      @cancel="() => {
        showEditRegionNameDialog = false;
        regionBeingEdited = null;
      }"
    />
  </v-dialog>
      
    <v-dialog
      v-model="showSampleErrorDialog"
      max-width="50%"
    >
      <v-card class="popup-card--outline">
        <v-toolbar
          density="compact"
        >
          <v-toolbar-title text="Error Loading Data"></v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            @click.stop="sampleErrorID = null"
          >
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <p v-if="sampleErrorMessage" class="mb-3 font-weight-medium">{{ sampleErrorMessage }}</p>
          The data server did not respond to some or all of the requests for this selection. This is
          usually temporary. You can delete this selection <v-icon icon="mdi-trash-can" /> and try making a new one, or try again by 
          clicking the retry button <v-icon icon="mdi-refresh" />.
        </v-card-text>
      </v-card>
    </v-dialog>
    
    <v-dialog
      v-model="showEditTimeRangeNameDialog"
    >
      <!-- text field that requires a confirmation -->
        <c-text-field
          label="Time Range Name"
          title="Enter a new name for this time range"
          hide-details
          dense
          :button-color="accentColor"
          @confirm="(name: string) => {
            if (timeRangeBeingEdited) {
              store.setTimeRangeName(timeRangeBeingEdited, name);
              showEditTimeRangeNameDialog = false;
            }
          }"
          @cancel="() => {
            showEditTimeRangeNameDialog = false;
            timeRangeBeingEdited = null;
          }"
        ></c-text-field>
    </v-dialog>
        
    <v-dialog
      v-model="showDatasetEditor"
    >
      <user-dataset-editor
        v-if="currentlyEditingDataset !== null"
        v-model="currentlyEditingDataset" 
        :name-only="datasetEditorNameOnly"
        @complete="() => {
          showDatasetEditor = false;
          currentlyEditingDataset = null;
        }"
        />
    </v-dialog>
        
    <!-- Data Aggregation Dialog -->
    <advanced-operations
      v-model="showAggregationDialog"
      :selection="aggregationDataset"
      @save="handleAggregationSaved"
      @plot-click="handlePlotClick"
    />
    
    <v-dialog
      v-model="showUserDatasetTable"
      max-width="800px"
      persistent
    >
      <v-card class="popup-card--outline">
        <v-toolbar
          density="compact"
        >
          <v-toolbar-title text="Dataset Table View"></v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            @click.stop="showUserDatasetTable = false; tableSelection = null"
          >
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <user-dataset-table
            v-if="tableSelection !== null"
            :dataset="tableSelection"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
    
    <local-scope
      :datasets="datasets.filter(d => (d.samples || d.plotlyDatasets) && selectedDatasets.includes(d.id) )"
    >
      <template #default="{ datasets }">
        <cds-dialog
          :title="`Graph${new Set(datasets.map(ds => ds.molecule)).size > 1 ? 's' : ''} of Quantity vs Time`"
          title-color="var(--info-background)"
          v-model="showMultiPlot"
          persistent
          draggable
          max-height="90vh"
          max-width="90vw"
          :scrim="true"
          :drag-predicate="titleBarPredicate"
        >
          <multi-plot
            :datasets="datasets"
          />
        </cds-dialog>
      </template>
    </local-scope>

  </div>

</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { v4 } from "uuid";

import type { MillisecondRange, TimeRange, UserDataset, UnifiedRegion, MoleculeType } from "../types";
import type { TimeRangeConfig } from "@/date_time_range_selection/date_time_range_generators";
import { serializeTempoStore, useTempoStore } from "../stores/app";
import { MOLECULE_OPTIONS } from "../esri/utils";
import { HIDDEN_BAD_LAYERS } from "@/datasets/layerData";
import { atleast1d } from "../utils/atleast1d";
import { titleBarPredicate } from "../utils/draggable";

import DateTimeRangeSelection from "../date_time_range_selection/DateTimeRangeSelection.vue";
import AdvancedOperations from "./AdvancedOperations.vue";
import { TimeRangeSelectionType } from "@/types/datetime";
// import PlotlyGraph from "./plotly/PlotlyGraph.vue";
// import FoldedPlotlyGraph from "./FoldedPlotlyGraph.vue";
import CTextField from "./CTextField.vue";
import { toZonedTime } from "date-fns-tz";
// import { userDatasetToPlotly } from "@/utils/data_converters";
import UserDatasetTable from "./UserDatasetTable.vue";
import MultiPlot from "./plotly/MultiMoleculePlot.vue";
import DatasetCardControl from "./DatasetCardControl.vue";
import TimeRangesControl from "./TimeRangesControl.vue";

type UnifiedRegionType = UnifiedRegion;

const store = useTempoStore();
const {
  accentColor,
  accentColor2,
  backend,
  regions,
  datasets,
  timeRanges,
  singleDateSelected,
  uniqueDays,
  selectionActive,
  focusRegion,
  focusCardId,
  showSamplingPreviewMarkers,
  regionOpacity,
  regionVisibility,
  tempoRed,
  layersReady,
} = storeToRefs(store);

const moleculeReady = computed(() => {
  const ready = new Map<string, boolean[] | undefined>();
  MOLECULE_OPTIONS.forEach( v => {
    const layername = `tempo-${v.value}`;
    if (hiddenMolecules.value.includes(v.value)) return;
    ready.set(v.value,layersReady.value.get(layername)?.ready);
  });
  return ready;
});

// molecules whose layer is broken and should be hidden rather than flagged
const hiddenMolecules = computed(() => {
  return MOLECULE_OPTIONS
    .map(v => v.value)
    .filter(mol => {
      const layername = `tempo-${mol}`;
      return HIDDEN_BAD_LAYERS.includes(layername) && layersReady.value.get(layername)?.status === 'error';
    });
});

const cssVars = computed(() => {
  return {
    '--accent-color': accentColor.value,
    '--accent-color-2': accentColor2.value,
  };
});


const openPanels = ref<number[]>([0, 1, 2]);
const openSelection = ref<string | null>(null);
const tableSelection = ref<UserDataset | null>(null);
const currentlyEditingDataset = ref<UserDataset | null>(null);
const showConfirmReset = ref(false);
const showMultiPlot = ref(false);

const createTimeRangeActive = ref(false);
const createDatasetActive = ref(false);
const sampleErrorID = ref<string | null>(null);
const sampleErrorMessage = computed(() => sampleErrorID.value ? store.sampleErrors[sampleErrorID.value] : null);

const showSampleErrorDialog = computed({
  get: () => sampleErrorID.value !== null,
  set: (val: boolean) => {
    if (!val) {
      sampleErrorID.value = null;
    }
  }
});

const showEditRegionNameDialog = ref(false);
const regionBeingEdited = shallowRef<UnifiedRegionType | null>(null);

const showEditTimeRangeNameDialog = ref(false);
const timeRangeBeingEdited = ref<TimeRange | null>(null);

const popupCardWidth = 300;

const aggregationDataset = ref<UserDataset | null>(null);
const showAggregationDialog = ref(false);
function openAggregationDialog(selection: UserDataset) {
  aggregationDataset.value = selection;
  showAggregationDialog.value = true;
  aggregationReturnCardId.value = selection.id;
}
function handleAggregationSaved(aggregatedSelection: UserDataset) {
  const n = datasets.value
    .filter(d => !!d.folded) // only count folded datasets
    .filter(d => {
      // make sure they all have the same parent
      if (d.folded.parent && aggregatedSelection.folded.parent) {
        // check the id (this is stable and always unique)
        return (aggregatedSelection.folded.parent as UserDataset).id === (d.folded.parent as UserDataset).id;
      }
      return false;
    }).length;
  // aggregatedSelection.name = `${aggregatedSelection.name} ${String.fromCharCode(97 + n)}`; // a, b, c, ...
  aggregatedSelection.name = (aggregatedSelection.name ?? '(Aggregation)').replace('Aggregation', `Aggregation ${String.fromCharCode(97 + n)}`); // a, b, c, ...
  if (aggregatedSelection.plotlyDatasets) {
    for (let i = 0; i < aggregatedSelection.plotlyDatasets.length; i++) {
      aggregatedSelection.plotlyDatasets[i].name = aggregatedSelection.name;
    }
  }
  store.addDataset(aggregatedSelection, false); // no need to fetch anything
  // Saving deliberately leaves the dialog open, so the aggregation that was
  // just made stays on screen and another can be made without reopening it.
  // It is closed by its own title bar X or by Cancel. The other half of this is
  // in DataFoldingAndBinning's saveFolding, which also used to close it.
}

import { RequestStats, FetchOptions } from "@/esri/services/TempoDataService";
function progressLogger(dataset: UserDataset): FetchOptions["onProgress"] {
  return (stats: RequestStats, completed: number, total: number) => {
    console.log(`Dataset ${dataset.name} loading progress: ${completed}/${total} requests completed.`, stats);
  };
}

function handleDatasetCreated(dataset: UserDataset) {
  dataset.name = `Dataset ${datasets.value.length + 1}`; // give it a default name
  store.addDataset(dataset, true, progressLogger(dataset));
  focusCardId.value = dataset.id;
  createDatasetActive.value = false;
}

// Newest first, so a card you have just made sits next to the button that made
// it instead of at the far end of the list. With the cards appended, the newest
// region and the "New Region" button were 43 tab stops apart - three per card -
// and the panel scrolled the button out of sight when the new card took focus.
//
// This reverses a copy. The store's own order is what drives the map layers, so
// it is left alone.
const regionsNewestFirst = computed(() => regions.value.slice().reverse());

// Creating a region, time range or dataset used to leave focus nowhere useful:
// on the map for a region, and on a form that was then collapsed for the other
// two, which drops focus to <body>. Moving it to the card that was just made
// says what happened - a screen reader reads out the new card's name - and puts
// the rename button one Tab away, which matters because the app asks people to
// rename their cards.
//
// The card is found by attribute rather than by ref because the three card
// types live in three different components. If it is not there - the panel is
// closed, say - focus is left alone rather than thrown somewhere arbitrary.
watch(focusCardId, (id: string | null) => {
  if (id === null) {
    return;
  }
  focusCardId.value = null;
  nextTick(() => {
    document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus();
  });
});

// These dialogs are opened from a button on a card, and that button goes away
// with the card's row while the dialog is up, so closing the dialog left focus
// at the very top of the page. Each one remembers which card opened it and
// hands focus back through focusCardId above.
//
// This watches the dialog's own open flag rather than hooking its save and
// cancel handlers, because that is the one thing every way out has in common -
// saving, cancelling, Escape, and clicking the backdrop all end with the flag
// false.
//
// The three rename dialogs are modal and so mutually exclusive, and share one
// ref. The table and aggregation dialogs are not: both are persistent with no
// scrim, which leaves the panel behind them usable, so a rename can be started
// while one of them is up. They get their own refs so the two cannot overwrite
// each other.
const dialogReturnCardId = ref<string | null>(null);
const tableReturnCardId = ref<string | null>(null);
const aggregationReturnCardId = ref<string | null>(null);

function returnFocusWhenClosed(isOpen: Ref<boolean>, returnTo: Ref<string | null>) {
  watch(isOpen, (open: boolean, wasOpen: boolean) => {
    if (wasOpen && !open) {
      focusCardId.value = returnTo.value;
      returnTo.value = null;
    }
  });
}

// (the calls are below, once all the flags have been declared)

function retryDataset(dataset: UserDataset) {
  store.fetchDataForDataset(dataset, progressLogger(dataset));
}

import UserDatasetEditor from "./UserDatasetEditor.vue";
import { contrastingColor } from "@/utils/color";
import RegionEditor from "./RegionEditor.vue";
const showDatasetEditor = ref(false);
const datasetEditorNameOnly = ref(false);
returnFocusWhenClosed(showEditRegionNameDialog, dialogReturnCardId);
returnFocusWhenClosed(showEditTimeRangeNameDialog, dialogReturnCardId);
returnFocusWhenClosed(showDatasetEditor, dialogReturnCardId);
returnFocusWhenClosed(showAggregationDialog, aggregationReturnCardId);

function handleEditDataset(dataset: UserDataset, nameOnly = false) {
  datasetEditorNameOnly.value = nameOnly;
  currentlyEditingDataset.value = dataset;
  showDatasetEditor.value = true;
  dialogReturnCardId.value = dataset.id;
}

function removeDataset(dataset: UserDataset) {
  store.deleteDataset(dataset);
}

function handleDateTimeRangeSelectionChange(
  timeRanges: MillisecondRange[], 
  selectionType: TimeRangeSelectionType, 
  customName: string, 
  config: TimeRangeConfig,
) {
  if (!Array.isArray(timeRanges) || timeRanges.length === 0) {
    console.error('No time ranges received from DateTimeRangeSelection');
    return;
  }
  // console.log(`Received ${timeRanges.length} time ranges of type ${selectionType} and name ${customName}`);
  const normalized = atleast1d(timeRanges);
  const countTimeRanges = store.timeRanges.length;
  let name = `Time Range ${countTimeRanges + 1}`;
  if (selectionType === 'single') {
    name = customName;
  }
  // No dedup tracking now
  const tr: TimeRange = {
    id: v4(),
    name: name,
    description: customName,
    range: normalized.length === 1 ? normalized[0] : normalized,
    type: selectionType,
    config: config,
  };
  store.addTimeRange(tr);
  focusCardId.value = tr.id;

  createTimeRangeActive.value = false;
  // console.log(`Registered ${tr.name}: ${tr.description}`);
}

function editRegionName(region: UnifiedRegionType) {
  console.log(`Editing ${region.geometryType}: ${region.name}`);
  // Set the region to edit

  // eslint-disable-next-line
  // @ts-ignore it is not actually deep
  const existing = (regions.value as UnifiedRegionType[]).find(r => r.id === region.id);
  if (!existing) {
    console.error(`Region with ID ${region.id} not found.`);
    return;
  }
  regionBeingEdited.value = region;
  // Open dialog for renaming
  showEditRegionNameDialog.value = true;
  dialogReturnCardId.value = region.id;
}

function editTimeRangeName(timeRange: TimeRange) {
  console.log(`Editing time range: ${timeRange.name}`);
  
  const existing = timeRanges.value.find(tr => tr.id === timeRange.id);
  if (!existing) {
    console.error(`Time range with ID ${timeRange.id} not found.`);
    return;
  }
  timeRangeBeingEdited.value = timeRange;
  // Open dialog for renaming
  showEditTimeRangeNameDialog.value = true;
  dialogReturnCardId.value = timeRange.id;
}

function _graphTitle(dataset: UserDataset): string {
  const molecule = dataset.molecule;
  const molTitle = MOLECULE_OPTIONS.find(m => m.value === molecule)?.title || '';
  return dataset.name ?? `${molTitle} Time Series for ${dataset.region.name}`;
}




function _toZonedTime(date: number | Date | string, timezone): number | Date {
  if (typeof date === 'number') {
    date = new Date(date);
  } else if (typeof date === 'string') {
    date = new Date(date);
  }
  return toZonedTime(date, timezone);
}

const allDatasetSelection = ref(false);
const selectedDatasets = ref<string[]>([]);
watch(allDatasetSelection, (newVal) => {
  if (!newVal) {
    selectedDatasets.value = [];
  }
});
// watch(selectedDatasets, (newVal) => {
//   console.log('Selected datasets changed:', newVal);
// });




const showErrorBands = ref(true);

const showUserDatasetTable = ref(false);
watch(tableSelection, (newVal) => {
  if (newVal) {
    showUserDatasetTable.value = true;
    // Remember the card to go back to. It has to be captured here rather than
    // read on close, because closing the table nulls tableSelection.
    tableReturnCardId.value = newVal.id;
  }
});

returnFocusWhenClosed(showUserDatasetTable, tableReturnCardId);


/** handle plot click should set the time and molecule and zoom into the region */
function handlePlotClick(value: {x: number | string | Date | null, y: number, customdata: unknown, molecule: MoleculeType, region: UnifiedRegion}): void {
  if (value.x === null) return;
  console.log('Plot clicked at:', value);
  // store.setNearestTime(new Date(value.x));
  focusRegion.value = value.region;
  
}

</script>

<style scoped lang="less">
#dataset-sections {
  font-size: 11pt !important;
  min-width: 250px;
}

// prevent overflows of the content
#add-region-time {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 5px;
}

.my-selections {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 5px;
  padding: 0.5rem;
  border-radius: 10px;
  // background-color: #555555;
}

.h3-panel-titles {
  font-size: 1.17em;
  font-weight: bold;
}

.explainer-text {
  border-radius: 5px;
  padding: 5px;
  padding-inline-start: 10px;
  background-color: rgb(var(--v-theme-background));
  font-size: 0.8em;
  color: rgb(var(--v-theme-on-surface));
  
}

.error-explainer-text {
  border-radius: 5px;
  padding: 5px;
  padding-inline-start: 10px;
  background-color: rgba(255, 0, 0, 0.4);
  font-size: 0.8em;
  color: white;
  font-weight: bold;
}

.explainer-text hr {
  border: none;
  border-top: 1px solid rgb(var(--v-theme-on-surface-light));
  margin-inline: 0;
  margin-block: 1em;
}

.explainer-text dt {
  font-weight: bold;
}

.explainer-text dd {
  margin-left: 0;
  margin-bottom: 8px;
}

.datset-controls-action-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
}
:deep(.v-checkbox .v-label),
:deep(.v-slider__label),
:deep(.v-list-item-title)
{
  font-size: 10pt;
}

.show-sample-points-toggle {
  width: fit-content;
}

:deep(.info-button) {
  padding-left: 5px;
}

:deep(.show-sample-points-toggle .v-input__append) {
  margin: 0;
}

.dataset-select-all-none {
  display: flex;
  margin-bottom: 1em;
  flex-direction: row;
}

.dataset-select-all-none > button {
  flex-grow: 1;
}

#user-options-panels :deep(.v-expansion-panel-text__wrapper) {
    padding: 0px 0.5em;
}



</style>
