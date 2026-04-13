import { ref, type Ref } from "vue";
import type { Map, GeoJSONSource } from "maplibre-gl";
import { sampleColormap } from "@/colormaps/utils";

// ---------------------------------------------------------------------------
// PLACES FeatureServer configuration
//   Base URL for the PLACES Local Data for Better Health service.
//   Append the layer index to target a specific geography:
//     0 = PlacePoints (census places, points)       — has health fields
//     1 = PlaceBoundaries (census places, polygons) — geometry only, NO health fields
//     2 = Counties    (county boundaries, polygons) — has health fields
//     3 = Tracts      (census tracts, polygons)     — has health fields
// ---------------------------------------------------------------------------
const PLACES_BASE_URL =
  "https://services3.arcgis.com/ZvidGQkLaDJxRSJ2/arcgis/rest/services/PLACES_Local_Data_for_Better_Health_2022/FeatureServer";

// Layer index — change this to switch geographies
// Only layers 0, 2, 3 have health-measure fields; layer 1 is geometry-only.
const DEFAULT_LAYER_INDEX = 2;

// Crude prevalence field to visualise.
const PREVALENCE_FIELD = "CASTHMA_CrudePrev";

// Prevalence range for colour mapping (percent)
const PREV_MIN = 5;
const PREV_MAX = 15;
const COLOR_STEPS = 7;

// Minimum zoom level to start loading tract-level data (only applies to layer 3)
const MIN_ZOOM = 6;

// Sample the purples colormap and build MapLibre interpolation stops
const purpleStops = sampleColormap('purples', COLOR_STEPS).flatMap((rgb, i) => {
  const val = PREV_MIN + (PREV_MAX - PREV_MIN) * (i / (COLOR_STEPS - 1));
  return [val, `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`];
});

// Per-layer configuration: geometry type and identifier fields
interface LayerConfig {
  isPoint: boolean;
  idFields: string[];
}
const LAYER_CONFIGS: Record<number, LayerConfig> = {
  0: { isPoint: true,  idFields: ["PlaceFIPS", "PlaceName", "StateAbbr"] },
  // Layer 1 omitted — geometry-only, no health fields
  2: { isPoint: false, idFields: ["CountyFIPS", "CountyName", "StateAbbr"] },
  3: { isPoint: false, idFields: ["TractFIPS", "CountyName", "StateAbbr"] },
};

// Page size for paginated GeoJSON fetches from ArcGIS REST API
const PAGE_SIZE = 2000;

export type AsthmaStatus = "idle" | "loading" | "zoom-in" | "ready";

/**
 * Fetch features from an ArcGIS FeatureServer layer within a bounding box,
 * paginating automatically to handle the server's maxRecordCount limit.
 */
async function fetchFeaturesInBounds(
  layerUrl: string,
  outFields: string[],
  where: string,
  bounds: [number, number, number, number],
): Promise<GeoJSON.FeatureCollection> {
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  let offset = 0;
  const envelope = JSON.stringify({
    xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3],
    spatialReference: { wkid: 4326 },
  });

  for (;;) {
    const params = new URLSearchParams({
      where,
      outFields: outFields.join(","),
      f: "geojson",
      returnGeometry: "true",
      geometry: envelope,
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });

    const resp = await fetch(`${layerUrl}/query?${params}`);
    if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (await resp.json()) as GeoJSON.FeatureCollection & { properties?: { exceededTransferLimit?: boolean } };
    if (!page.features || page.features.length === 0) break;

    fc.features.push(...page.features);

    if (!page.properties?.exceededTransferLimit) break;
    offset += page.features.length;
  }

  return fc;
}

/**
 * Fetch ALL features from a layer (no spatial filter), with pagination.
 * Suitable for smaller layers like PlacePoints (0) and Counties (2).
 */
async function fetchAllFeatures(
  layerUrl: string,
  outFields: string[],
  where: string,
): Promise<GeoJSON.FeatureCollection> {
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      where,
      outFields: outFields.join(","),
      f: "geojson",
      returnGeometry: "true",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });

    const resp = await fetch(`${layerUrl}/query?${params}`);
    if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);

    const page = (await resp.json()) as GeoJSON.FeatureCollection & { properties?: { exceededTransferLimit?: boolean } };
    if (!page.features || page.features.length === 0) break;

    fc.features.push(...page.features);

    if (!page.properties?.exceededTransferLimit) break;
    offset += page.features.length;
  }

  return fc;
}

// Layer 3 (Tracts, ~83K polygons) is too large to fetch all at once.
// Only layer 3 uses viewport-based loading with a minimum zoom requirement.
const VIEWPORT_LAYERS = new Set([3]);

export function addAsthmaLayer(layerName: string, layerIndex: number = DEFAULT_LAYER_INDEX) {
  const url = `${PLACES_BASE_URL}/${layerIndex}`;
  const config = LAYER_CONFIGS[layerIndex] ?? LAYER_CONFIGS[DEFAULT_LAYER_INDEX];
  const useViewportLoading = VIEWPORT_LAYERS.has(layerIndex);
  const fillLayerId = layerName;
  const outlineId = `${layerName}-outline`;
  const sourceId = `${layerName}-source`;
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const status: Ref<AsthmaStatus> = ref("idle");

  let mapRef: Map | null = null;
  let moveEndHandler: (() => void) | null = null;
  // Abort controller to cancel in-flight fetches when viewport changes
  let fetchController: AbortController | null = null;
  // Accumulated features for viewport-loaded layers (keyed by first idField to deduplicate)
  const loadedFeatures = new globalThis.Map<string, GeoJSON.Feature>();

  function getSource(): GeoJSONSource | undefined {
    return mapRef?.getSource(sourceId) as GeoJSONSource | undefined;
  }

  function featureKey(f: GeoJSON.Feature): string {
    return config.idFields.map(k => f.properties?.[k] ?? "").join("|");
  }

  function flushToSource(): void {
    const source = getSource();
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: Array.from(loadedFeatures.values()),
      });
    }
  }

  async function loadViewport(): Promise<void> {
    if (!mapRef) return;

    const zoom = mapRef.getZoom();
    if (zoom < MIN_ZOOM) {
      status.value = "zoom-in";
      // Clear accumulated features when zoomed out
      loadedFeatures.clear();
      flushToSource();
      return;
    }

    // Cancel any in-flight request
    if (fetchController) fetchController.abort();
    fetchController = new AbortController();

    status.value = "loading";
    loading.value = true;
    error.value = null;

    try {
      const b = mapRef.getBounds();
      const bounds: [number, number, number, number] = [
        b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
      ];
      const outFields = [PREVALENCE_FIELD, ...config.idFields];
      const fc = await fetchFeaturesInBounds(url, outFields, `${PREVALENCE_FIELD} IS NOT NULL`, bounds);

      // Check if aborted while awaiting
      if (fetchController.signal.aborted) return;

      // Append new features, deduplicating by ID
      for (const f of fc.features) {
        loadedFeatures.set(featureKey(f), f);
      }
      flushToSource();
      status.value = "ready";
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      error.value = err instanceof Error ? err : new Error(`${err}`);
      console.error("[places-asthma] Failed to load features", err);
      status.value = "ready"; // don't block UI on transient errors
    } finally {
      loading.value = false;
    }
  }

  /** Fetch all features at once (for small layers like points / counties). */
  async function loadAll(): Promise<void> {
    if (!mapRef) return;
    status.value = "loading";
    loading.value = true;
    error.value = null;

    try {
      const outFields = [PREVALENCE_FIELD, ...config.idFields];
      const fc = await fetchAllFeatures(url, outFields, `${PREVALENCE_FIELD} IS NOT NULL`);
      const source = getSource();
      if (source) source.setData(fc);
      status.value = "ready";
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(`${err}`);
      console.error("[places-asthma] Failed to load features", err);
      status.value = "ready";
    } finally {
      loading.value = false;
    }
  }

  function addToMap(map: Map): void {
    mapRef = map;
    error.value = null;

    // Add an empty source + layers immediately so the UI can toggle visibility
    map.addSource(sourceId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      attribution: "CDC PLACES",
    });

    if (config.isPoint) {
      map.addLayer({
        id: fillLayerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-color": [
            "interpolate", ["linear"],
            ["get", PREVALENCE_FIELD],
            ...purpleStops,
          ],
          "circle-radius": 5,
          "circle-opacity": 0.8,
          "circle-stroke-color": "#333",
          "circle-stroke-width": 0.5,
        },
        layout: { visibility: "none" },
      });
    } else {
      map.addLayer({
        id: fillLayerId,
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
        layout: { visibility: "none" },
      });

      map.addLayer({
        id: outlineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#333",
          "line-width": 0.5,
        },
        layout: { visibility: "none" },
      });
    }

    if (useViewportLoading) {
      // Bind viewport-based loading for large layers (tracts)
      moveEndHandler = () => void loadViewport();
      map.on("moveend", moveEndHandler);

      // Initial load for current viewport
      void loadViewport();
    } else {
      // Small layers (points, counties): fetch everything once
      void loadAll();
    }
  }

  function removeFromMap(map: Map): void {
    if (moveEndHandler) {
      map.off("moveend", moveEndHandler);
      moveEndHandler = null;
    }
    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }
    try {
      if (map.getLayer(outlineId)) {
        map.removeLayer(outlineId);
      }
      if (map.getLayer(fillLayerId)) {
        map.removeLayer(fillLayerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (err) {
      console.error("[places-asthma] Failed to remove layer", err);
    }
    mapRef = null;
    loadedFeatures.clear();
    status.value = "idle";
  }

  return {
    addToMap,
    removeFromMap,
    loading,
    error,
    status,
    layerId: fillLayerId,
  };
}
