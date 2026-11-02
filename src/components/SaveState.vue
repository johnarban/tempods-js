<template>
  <div>
    <div class="save-state">
      <div class="icon-row">
        <h3>Save Data:</h3>
        <v-tooltip
          location="top"
          text="Save to local file"
        >
        <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="tonal"
              :color="accentColor2"
              aria-label="Save to local file"
              @click="() => saveLocal()"
            >
              <font-awesome-icon icon="fa-download" size="xl" />
            </v-btn>
          </template>
        </v-tooltip>
        <!-- <v-tooltip
          location="top"
          text="Coming soon!"
        >
          <template #activator="{ props }">
            <span v-bind="props">
              <v-icon
                icon="mdi-google-drive"
                :color="accentColor"
                disabled
              />
            </span>
          </template>
        </v-tooltip> -->
      </div>
      <p>
        Save all your progress (including Regions, Time Ranges, Datasets, and Aggregated Datasets) to a file on your computer.
      </p>
    </div>
    <div class="save-state">
      <div class="icon-row">
        <h3>Load Data:</h3>
        <v-tooltip
          location="top"
          text="Load from local file"
        >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="tonal"
              :color="accentColor2"
              aria-label="Load from local file"
              @click="onLoadClick"
            >
              <font-awesome-icon icon="fa-upload" size="xl" />
            </v-btn>
          </template>
        </v-tooltip>
        <!-- <v-tooltip
          location="top"
          text="Coming soon!"
        >
          <template #activator="{ props }">
            <span v-bind="props">
              <v-icon
                icon="mdi-google-drive"
                :color="accentColor"
                disabled
              />
            </span>
          </template>
        </v-tooltip> -->
      </div>
      <p v-if="!choosingLoadMode">
        Load data (including Regions, Time Ranges, Datasets, and Aggregated Datasets) from a file saved on your computer.
      </p>
      <template v-else>
        <p>
          You already have data in the app. Do you want data from the loaded file to be combined with your existing data, or to replace it?
        </p>
        <p>
          If you choose REPLACE, <strong>any work you haven’t saved to a file will be lost.</strong> Save your data first to keep your work.
        </p>
        <div class="action-row mt-2">
          <v-btn
            size="small"
            variant="outlined"
            @click="choosingLoadMode = false"
          >
            Cancel
          </v-btn>
          <v-btn
            :color="accentColor2"
            size="small"
            @click="loadLocal('combine')"
          >
            Combine
          </v-btn>
          <v-btn
            :color="tempoRed"
            size="small"
            @click="loadLocal('replace')"
          >
            Replace
          </v-btn>
          <info-button>
            <p>The COMBINE option behaves as follows:</p>
            <ul class="combine-rules">
              <li>Unique Regions, Time Ranges, and Datasets from the data file are added to your existing selections.</li>
              <li>Duplicated Regions, Time Ranges, or Datasets from the data file are NOT added again.</li>
              <li>If you save a data file and then rename Regions, Time Ranges, or Datasets, the app still considers those to be duplicated content. If you load the saved file and choose COMBINE, the updated names in the app are preserved.</li>
              <li>Regions that have been moved are not considered duplicates. The COMBINE action re-adds a region with the original location.</li>
              <li>If different regions in the app and the data file have the same name, such as "Region 1," the combined dataset can have multiple regions with the same name. We recommend renaming them to avoid confusion.</li>
            </ul>
          </info-button>
        </div>
      </template>
    </div>
    <!-- The confirmation happens in place rather than in a second dialog
         stacked on top of this one. -->
    <div class="save-state danger-zone">
      <div class="icon-row">
        <h3>Clear App Data:</h3>
        <v-tooltip
            location="top"
            text="Clear all app data"
          >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-broom"
              variant="tonal"
              :color="accentColor2"
              aria-label="Clear all app data"
              :disabled="!hasSelections"
              @click="confirmingReset = true"
            />
          </template>
        </v-tooltip>
      </div>
      <template v-if="!confirmingReset">
        <p>
          Remove all regions, time ranges, and datasets from the app. 
        </p>
        <p>
          (Saved files on your computer will not be affected.)
        </p>
      </template>
      <template v-else>
        <p>
          Are you sure you want to clear all of your data selections?
        </p>
        <p>
          <strong>Any work you haven’t saved to a file will be lost.</strong> Save your data first to keep your work.
        </p>
        <div class="action-row mt-2">
          <v-btn
            size="small"
            variant="outlined"
            @click="confirmingReset = false"
          >
            Cancel
          </v-btn>
          <v-btn
            :color="tempoRed"
            size="small"
            @click="resetAll"
          >
            Yes, clear my data
          </v-btn>
        </div>
      </template>
    </div>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { type TempoStore, useTempoStore, serializeTempoStore, updateStoreFromJSON, mergeStoreFromJSON } from "@/stores/app";

const store = useTempoStore();

const {
  accentColor2,
  tempoRed,
  regions,
  timeRanges,
} = storeToRefs(store);

const confirmingReset = ref(false);
const choosingLoadMode = ref(false);
const hasSelections = computed(() => regions.value.length > 0 || timeRanges.value.length > 0);

type LoadMode = "replace" | "combine";
const applyLoadedJSON: Record<LoadMode, typeof updateStoreFromJSON> = {
  replace: updateStoreFromJSON,
  combine: mergeStoreFromJSON,
};

type OpType = "save" | "load";
type Target = "local" | "google-drive";
type EventType = `${OpType}-${Target}`;

const emit = defineEmits<{
  (event: "save-local"): void;
  (event: "load-local"): void;
  (event: "save-google-drive"): void;
  (event: "load-google-drive"): void;
  (event: "error", type: EventType, message: string): void;
  (event: "reset"): void;
}>();

const DEFAULT_FILENAME = "tempo_lab.json";

async function saveLocalFileSystemAPI(store: TempoStore): Promise<boolean> {
  const options = {
    suggestedName: DEFAULT_FILENAME,
    types: [
      {
        description: "JSON",
        accept: { "application/json": [".json"] },
      }
    ],
    multiple: false,
  };

  const content = serializeTempoStore(store, false);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore window *might* have this, and if we're here it should
  return window.showSaveFilePicker(options)
    .then((handle: FileSystemFileHandle) => handle.createWritable())
    .then((stream: FileSystemWritableFileStream) => {
      stream.write(content);
      stream.close();
      return true;
    })
    .catch((error: Error) => {
      if (error instanceof DOMException) { return false; }
      emit("error", "save-local", error.message);
      return false;
    });

}

function saveLocalLink(store: TempoStore) {
  const content = serializeTempoStore(store, false);

  const blob = new Blob([content], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = DEFAULT_FILENAME;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  return true;
}

async function saveLocal() {
  let result = false;
  if ('showSaveFilePicker' in window) {
    result = await saveLocalFileSystemAPI(store);
  } else {
    result = saveLocalLink(store);
  }
  if (result) {
    emit("save-local");
  }
}

async function loadLocalFileSystemAPI(mode: LoadMode): Promise<boolean> {

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore window *might* have this, and if we're here it should
  const handles: FileSystemFileHandle[] = await window.showOpenFilePicker();
  if (handles.length === 0) {
    return false;
  }

  const handle = handles[0];
  const file = await handle.getFile();
  const content = await file.text();

  const result = applyLoadedJSON[mode](store, content, false);
  if (result) {
    return true;
  } else {
    emit("error", "load-local", "Error loading TEMPO Lab state from local file");
    return false;
  }
}

function loadLocalInput(mode: LoadMode) {
  const input = document.createElement("input");
  input.type = "file";

  input.addEventListener("change", function (event) {
    const element = event.target as HTMLInputElement;
    const files = element.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = function (evt) {
        if (!evt || !evt.target) { return; }
        const content = evt.target.result as string;
        const result = applyLoadedJSON[mode](store, content, false);
        if (result) {
          emit("load-local");
        } else {
          emit("error", "load-local", "Error loading TEMPO Lab state from local file");
        }
      };
      reader.readAsText(file);
    }
  });

  input.click();
}

// With nothing in the app yet, replace and combine give the same result, so
// only ask when there is something to lose.
function onLoadClick() {
  if (hasSelections.value) {
    choosingLoadMode.value = true;
  } else {
    loadLocal("replace");
  }
}

async function loadLocal(mode: LoadMode) {
  choosingLoadMode.value = false;
  let result = false;
  if ('showOpenFilePicker' in window) {
    result = await loadLocalFileSystemAPI(mode);
    if (result) {
      emit("load-local");
    }
  } else {
    loadLocalInput(mode);
  }
}

function resetAll() {
  store.reset();
  confirmingReset.value = false;
  emit("reset");
}
</script>

<style scoped>

p {
  margin-bottom: 0.5em;
}

.save-state {
  display: flex;
  flex-direction: column;
  margin-bottom: 1em; 
}

.icon-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
  padding-block: 5px;
}

.danger-zone {
  /* v-bind, not var(--tempo-red): the dialog is teleported outside the
     TempoLab root where that variable is set */
  border: 2px solid v-bind(tempoRed);
  border-radius: 8px;
  margin-top: 2em;
  padding-inline: 1em;
  padding-top: 0.25em;
  padding-bottom: 1em;
}

.action-row {
  display: flex;
  gap: 8px;
}

.combine-rules {
  padding-inline-start: 1.5em;
}

.combine-rules li {
  margin-bottom: 0.5em;
}
</style>
