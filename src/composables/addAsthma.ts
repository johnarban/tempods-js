import { ref } from "vue";
import { FeatureLayer } from "@esri/maplibre-arcgis";
import type { Map } from "maplibre-gl";
import { sampleColormap } from "@/colormaps/utils";

// ---------------------------------------------------------------------------
// PLACES FeatureServer configuration
//   Base URL for the PLACES Local Data for Better Health service.
//   Append the layer index to target a specific geography:
//     0 = PlacePoints (census places, points)
//     1 = Places      (census places, polygons)
//     2 = Counties    (county boundaries, polygons)
// ---------------------------------------------------------------------------
const PLACES_BASE_URL =
  "https://services3.arcgis.com/ZvidGQkLaDJxRSJ2/arcgis/rest/services/PLACES_LocalData_for_BetterHealth/FeatureServer";

// Layer index — change this to switch geographies
const PLACES_LAYER_INDEX = 2; // Counties

// Age-adjusted prevalence field to visualise.
// Every measure follows the pattern <MEASURE>_AdjPrev (Double, %).
// Common options:
//   CASTHMA_AdjPrev   — Current asthma
//   COPD_AdjPrev      — COPD
//   DIABETES_AdjPrev   — Diabetes
//   OBESITY_AdjPrev    — Obesity
//   DEPRESSION_AdjPrev — Depression
//   BPHIGH_AdjPrev     — High blood pressure
//   CHD_AdjPrev        — Coronary heart disease
const PREVALENCE_FIELD = "CASTHMA_AdjPrev";

// Prevalence range for colour mapping (percent)
const PREV_MIN = 5;
const PREV_MAX = 15;
const COLOR_STEPS = 7;

// Sample the purples colormap and build MapLibre interpolation stops
const purpleStops = sampleColormap('purples', COLOR_STEPS).flatMap((rgb, i) => {
  const val = PREV_MIN + (PREV_MAX - PREV_MIN) * (i / (COLOR_STEPS - 1));
  return [val, `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`];
});

const PLACES_FEATURE_LAYER_URL = `${PLACES_BASE_URL}/${PLACES_LAYER_INDEX}`;

export const ASTHMA_LAYER_ID = "places-asthma-layer";
const ASTHMA_OUTLINE_LAYER_ID = "places-asthma-layer-outline";

export function addAsthmaLayer() {
  const loading = ref(false);
  const error = ref<Error | null>(null);

  let featureLayer: FeatureLayer | null = null;
  let sourceId: string | null = null;

  async function addToMap(map: Map): Promise<void> {
    loading.value = true;
    error.value = null;

    try { // start of try block
      featureLayer = await FeatureLayer.fromUrl(PLACES_FEATURE_LAYER_URL, {
        attribution: "CDC PLACES",
        query: {
          where: `${PREVALENCE_FIELD} IS NOT NULL`,
          outFields: [PREVALENCE_FIELD, "CountyName", "StateAbbr"],
        },
      });

      sourceId = featureLayer.sourceId as string;

      // The @esri/maplibre-arcgis library's _onAdd tries to add an Esri attribution control,
      // but throws if a non-Esri attribution control already exists on the map.
      // Patch the existing attribution control to include the Esri string so canAdd() passes.
      const esriAttrString = 'Powered by <a href="https://www.esri.com/">Esri</a>';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (map as any)._controls as any[];
      if (controls) {
        for (const control of controls) {
          if ('_toggleAttribution' in control) {
            const opts = control.options;
            if (opts && typeof opts.customAttribution === 'string' && !opts.customAttribution.includes(esriAttrString)) {
              opts.customAttribution = opts.customAttribution + ' | ' + esriAttrString;
            }
          }
        }
      }

      // Add GeoJSON source — FeatureLayerSourceManager handles view/zoom-dependent loading
      featureLayer.addSourcesTo(map);

      // Filled county polygons coloured by age-adjusted prevalence (starts hidden)
      map.addLayer({
        id: ASTHMA_LAYER_ID,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "interpolate", ["linear"],
            ["get", PREVALENCE_FIELD],
            ...purpleStops,
          ],
          "fill-opacity": 0.6,
        },
        layout: {
          visibility: "none",
        },
      });

      // County boundary outlines
      map.addLayer({
        id: ASTHMA_OUTLINE_LAYER_ID,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#333",
          "line-width": 0.5,
        },
        layout: {
          visibility: "none",
        },
      });
      
      // end of try block
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(`${err}`);
      console.error("[places-asthma] Failed to add layer", err);
    } finally {
      loading.value = false;
    }
  }

  function removeFromMap(map: Map): void {
    try {
      if (map.getLayer(ASTHMA_OUTLINE_LAYER_ID)) {
        map.removeLayer(ASTHMA_OUTLINE_LAYER_ID);
      }
      if (map.getLayer(ASTHMA_LAYER_ID)) {
        map.removeLayer(ASTHMA_LAYER_ID);
      }
      if (sourceId && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (err) {
      console.error("[places-asthma] Failed to remove layer", err);
    }
    featureLayer = null;
    sourceId = null;
  }

  return {
    addToMap,
    removeFromMap,
    loading,
    error,
  };
}
