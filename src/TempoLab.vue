<template>
  <v-app
    id="app"
    :style="cssVars"
  >
    <header-bar />
    <div ref="root" class="layout-root"></div>

    <template v-if="mapTargets">
      <teleport
        v-for="[key, target] in Object.entries(mapTargets)"
        :key="key"
        :to="target"
      >
        <map-with-controls />
      </teleport>
    </template>

    <teleport
      v-if="sidePanelTarget"
      :to="sidePanelTarget"
    >
      <v-tabs
        v-model="tab"
        :color="tempoRed"
      >
        <v-tab :value="1" variant="flat">Comparison Data</v-tab>
        <v-tab :value="0" variant="flat">TEMPO Deep Dive</v-tab>
      </v-tabs>
      
      <v-tabs-window v-model="tab">
        <v-tabs-window-item
          class="tab-content"
          :value="0"
          :key="0"
        >
          <dataset-controls />
        </v-tabs-window-item>
        <v-tabs-window-item
          :value="1"
          :key="1"
          class="tab-content"
        >
          <comparison-data-controls />
        </v-tabs-window-item>
      </v-tabs-window>
    </teleport>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, reactive, ref, useTemplateRef, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { ComponentItemConfig, GoldenLayout, LayoutConfig, type RowOrColumn } from "golden-layout";
import { v4 } from "uuid";

import { useTempoStore, deserializeTempoStore, postDeserializeTempoStore, serializeTempoStore } from "@/stores/app";

type MaybeHTMLElement = HTMLElement | null;
const root = useTemplateRef("root");
const mapTargets = reactive<Record<string, Ref<MaybeHTMLElement>>>({});
const sidePanelTarget = ref<MaybeHTMLElement>(null);
const tab = ref(1);


const store = useTempoStore();
const {
  accentColor,
  accentColor2,
  debugMode,
  tempoRed,
} = storeToRefs(store);

const query = new URLSearchParams(window.location.search);
debugMode.value = (query.get("debug") ?? process.env.VUE_APP_TEMPO_LAB_DEBUG)?.toLowerCase() == "true";

const infoColor = "#092088";
const cssVars = computed(() => {
  return {
    '--accent-color': accentColor.value,
    '--accent-color-2': accentColor2.value,
    '--info-background': infoColor,
    '--tempo-red': tempoRed.value,
  };
});

const localStorageKey = "tempods";

onBeforeMount(() => {
  const storedState = window.localStorage.getItem(localStorageKey);
  if (storedState) {
    const state = deserializeTempoStore(storedState);
    store.$patch(state);
    postDeserializeTempoStore(store);
  }
});

function mapConfig(): ComponentItemConfig {
  return {
    type: 'component',
    componentType: 'map-panel',
    title: 'Map',
    draggable: false,
    width: 70,
  };
}

// We'll probably be using this eventually
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addMapPanel() {
  if (layout) {
    const config = mapConfig();
    const row = layout.rootItem as RowOrColumn;
    row.addItem(config, Object.keys(mapTargets).length);
  }
}

// And maybe this too
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function removeMapPanel(index: number) {
  if (layout) {
    const idx = Math.round(index);
    if (idx >= Object.keys(mapTargets).length) {
      throw new Error(`Index ${idx} is out of range for map panels`);
    }
    const row = layout.rootItem as RowOrColumn;
    row.contentItems[idx]?.remove();
  }
}

// bind add and remove to the window for easy access from the console
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).addMapPanel = addMapPanel;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).removeMapPanel = removeMapPanel;

let layout: GoldenLayout | null = null;
onMounted(() => {
  const rootEl = root.value as HTMLElement;
  if (!rootEl) {
    return;
  }
  layout = new GoldenLayout(rootEl);

  layout.registerComponentFactoryFunction("side-panel", container => {
    container.element.id = "side-panel";
    sidePanelTarget.value = container.element;
  });

  layout.registerComponentFactoryFunction("map-panel", container => {
    container.element.classList.add("map-panel");
    const id = v4();
    const target = ref<MaybeHTMLElement>(null);
    target.value = container.element;
    mapTargets[id] = target;
  });

  const config: LayoutConfig = {
    settings: {
      hasHeaders: false,
      responsiveMode: "always",
    },
    root: {
      type: 'row',
      content: [
        mapConfig(), 
        {
          type: 'component',
          componentType: 'side-panel',
          title: 'Controls',
          draggable: false,
          width: 30,
        },
      ],
    },
  };
  layout.resizeWithContainerAutomatically = true;
  layout.loadLayout(config);

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const stringified = serializeTempoStore(store); 
      window.localStorage.setItem(localStorageKey, stringified);
    }
  });
});
</script>

<style lang="less">
// NB: The styles here are NOT scoped - these are intended to apply to the overall application,
// as this component is really just a layout container.
// If we do want component-only styles, just add a <style scoped> block below this one

@font-face {
  font-family: "Highway Gothic Narrow";
  src: url("./assets/HighwayGothicNarrow.ttf");
}

// JC: This was commented out, but I put it back in because my browser (Chrome on Ubuntu) didn't already have Lexend
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap');

html, body .layout-root {
  width: 100%;
  height: 100%;
}

html, body {
  padding: 0;
  margin: 0;
}

body {
  font-family: Verdana, Arial, Helvetica, sans-serif;
}

#app {
  h1, h2, h3, h4, h5, h6, p, div {
    user-select: none;
    -webkit-user-select: none;
  }
  font-family: "Lexend", sans-serif;
}

#side-panel {
  overflow-y: scroll;
}

:root {
  // font-size: clamp(14px, 1.7vw, 16px);
  // --default-font-size: 1rem; // we don't use this
  font-size: 16px; // this is the standard browser default
  --default-line-height: clamp(1rem, min(2.2vh, 2.2vw), 1.6rem); // we don't use this
  --smithsonian-blue: #009ade;
  --smithsonian-yellow: #ffcc33;
  --info-background: #092088;
  --map-height: 500px;
}

@media (max-width: 750px) {
  :root {
    --map-height: 60vh;
    --map-height: 60dvh;
    --map-height: 60svh;
    font-size: 14px;
  }
}

// Some Golden Layout adjustments
.lm_content {
  background: rgb(var(--v-theme-background));
  overflow-y: auto!important;
}

.lm_splitter {
  background-color: #333333;
  opacity: 0.7;

  &.lm_dragging {
    background-color: var(--smithsonian-blue);
  }
}

.tab-content {
  padding: 0.5rem 1rem;
  border: 5px solid var(--tempo-red);
  border-radius: 10px;
  margin: 10px;
}
</style>
