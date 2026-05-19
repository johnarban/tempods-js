import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch, type MaybeRef, type Ref } from "vue";
import type { Map, MapLayerMouseEvent } from "maplibre-gl";

export interface EsriFieldInfo {
  name: string;
  type: string;
  alias?: string;
  sqlType?: string;
  nullable?: boolean;
  editable?: boolean;
}

export interface EsriFeature<TAttributes extends object> {
  attributes: TAttributes;
  geometry?: unknown;
}

interface EsriQueryResponse<TAttributes extends object> {
  objectIdFieldName?: string;
  uniqueIdField?: { name: string; isSystemMaintained?: boolean };
  fields?: EsriFieldInfo[];
  exceededTransferLimit?: boolean;
  features?: EsriFeature<TAttributes>[];
  error?: {
    code?: number;
    message?: string;
    details?: string[];
  };
}

export interface EsriFeatureQueryOverrides {
  where?: string;
  outFields?: string[] | "*";
  returnGeometry?: boolean;
  resultRecordCount?: number;
  orderByFields?: string;
  extraParams?: Record<string, string | number | boolean | null | undefined>;
}

export interface UseEsriFeatureLayerOptions {
  layerId?: MaybeRef<number>;
  where?: MaybeRef<string>;
  outFields?: MaybeRef<string[] | "*">;
  returnGeometry?: MaybeRef<boolean>;
  resultRecordCount?: MaybeRef<number | null | undefined>;
  orderByFields?: MaybeRef<string | null | undefined>;
  extraParams?: MaybeRef<Record<string, string | number | boolean | null | undefined>>;
  autoFetch?: boolean;
  popup?: boolean;
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizeFeatureLayerUrl(serviceUrl: string, layerId: number): string {
  const trimmed = trimTrailingSlashes(serviceUrl);
  if (/\/(FeatureServer|MapServer)\/\d+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/(FeatureServer|MapServer)$/i.test(trimmed)) {
    return `${trimmed}/${layerId}`;
  }
  return `${trimmed}/${layerId}`;
}

function normalizeOutFields(outFields: string[] | "*"): string {
  return outFields === "*" ? "*" : outFields.join(",");
}

function setQueryValue(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined) return;
  params.set(key, String(value));
}

export function useEsriFeatureLayer<TAttributes extends object = Record<string, unknown>>(
  serviceUrl: string,
  options: UseEsriFeatureLayerOptions = {},
) {
  const layerIdRef = toRef(options.layerId ?? 0);
  const whereRef = toRef(options.where ?? "1=1");
  const outFieldsRef = toRef(options.outFields ?? "*");
  const returnGeometryRef = toRef(options.returnGeometry ?? false);
  const resultRecordCountRef = toRef(options.resultRecordCount);
  const orderByFieldsRef = toRef(options.orderByFields);
  const extraParamsRef = toRef(options.extraParams ?? {});
  const autoFetch = options.autoFetch ?? false;

  const featureLayerUrl = computed(() => normalizeFeatureLayerUrl(serviceUrl, layerIdRef.value));
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const fields = shallowRef<EsriFieldInfo[]>([]);
  const features = shallowRef<EsriFeature<TAttributes>[]>([]);
  const exceededTransferLimit = ref(false);
  const abortController = ref<AbortController | null>(null);

  const featureCount = computed(() => features.value.length);
  const firstFeature = computed(() => features.value[0] ?? null);

  function abort(message = "Feature query aborted") {
    if (!abortController.value) return;
    abortController.value.abort(message);
    abortController.value = null;
  }

  async function queryFeatures(overrides: EsriFeatureQueryOverrides = {}): Promise<EsriFeature<TAttributes>[]> {
    abort();
    const controller = new AbortController();
    abortController.value = controller;
    loading.value = true;
    error.value = null;

    const queryParams = new URLSearchParams();
    const where = overrides.where ?? whereRef.value;
    const outFields = overrides.outFields ?? outFieldsRef.value;
    const returnGeometry = overrides.returnGeometry ?? returnGeometryRef.value;
    const resultRecordCount = overrides.resultRecordCount ?? resultRecordCountRef.value ?? undefined;
    const orderByFields = overrides.orderByFields ?? orderByFieldsRef.value ?? undefined;
    const extraParams = overrides.extraParams ?? extraParamsRef.value;

    queryParams.set("f", "json");
    queryParams.set("where", where);
    queryParams.set("outFields", normalizeOutFields(outFields));
    queryParams.set("returnGeometry", String(returnGeometry));
    setQueryValue(queryParams, "resultRecordCount", resultRecordCount);
    setQueryValue(queryParams, "orderByFields", orderByFields);

    for (const [key, value] of Object.entries(extraParams)) {
      setQueryValue(queryParams, key, value);
    }

    const requestUrl = `${featureLayerUrl.value}/query?${queryParams.toString()}`;

    try {
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`ESRI feature query failed with HTTP ${response.status}`);
      }

      const json = await response.json() as EsriQueryResponse<TAttributes>;
      if (json.error) {
        const details = json.error.details?.filter(Boolean).join("; ");
        throw new Error(
          `ESRI feature query failed: ${json.error.message ?? "Unknown error"}${details ? ` (${details})` : ""}`
        );
      }

      fields.value = json.fields ?? [];
      features.value = (json.features ?? []) as EsriFeature<TAttributes>[];
      exceededTransferLimit.value = json.exceededTransferLimit ?? false;
      return features.value;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }
      const typedErr = err instanceof Error ? err : new Error(String(err));
      error.value = typedErr;
      throw typedErr;
    } finally {
      loading.value = false;
      if (abortController.value === controller) {
        abortController.value = null;
      }
    }
  }

  function getFieldValues<TValue = unknown>(fieldName: string): TValue[] {
    return features.value
      .map((feature) => {
        const attributes = feature.attributes as Record<string, unknown>;
        return attributes[fieldName] as TValue | undefined;
      })
      .filter((value): value is TValue => value !== undefined && value !== null);
  }

  function getFirstFieldValue<TValue = unknown>(fieldName: string): TValue | null {
    const first = features.value[0];
    if (!first) return null;
    const attributes = first.attributes as Record<string, unknown>;
    const value = attributes[fieldName] as TValue | undefined | null;
    return value ?? null;
  }

  const refetch = () => queryFeatures();

  let clickMap: Map | null = null;
  let clickLayerId: string | null = null;
  let clickHandler: ((e: MapLayerMouseEvent) => void) | null = null;

  function setupMapClick(map: Map, mapLayerId: string): void {
    if (!options.popup) return;
    teardownMapClick();
    clickMap = map;
    clickLayerId = mapLayerId;
    clickHandler = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature) {
        const point = { x: e.lngLat.lng, y: e.lngLat.lat };
        console.log(`[${mapLayerId}] Value at point`, point, 'is', feature.properties);
      }
    };
    map.on("click", mapLayerId, clickHandler);
  }

  function teardownMapClick(): void {
    if (clickMap && clickLayerId && clickHandler) {
      clickMap.off("click", clickLayerId, clickHandler);
    }
    clickMap = null;
    clickLayerId = null;
    clickHandler = null;
  }

  if (autoFetch) {
    watch(
      [layerIdRef as Ref<number>, whereRef, outFieldsRef, returnGeometryRef, resultRecordCountRef, orderByFieldsRef, extraParamsRef],
      () => {
        queryFeatures().catch((err: Error) => {
          if (err.name !== "AbortError") {
            console.error("[useEsriFeatureLayer] query failed", err);
          }
        });
      },
      { immediate: true, deep: true },
    );
  }

  onBeforeUnmount(() => {
    abort();
    teardownMapClick();
  });

  return {
    featureLayerUrl,
    loading,
    error,
    fields,
    features,
    featureCount,
    firstFeature,
    exceededTransferLimit,
    queryFeatures,
    refetch,
    abort,
    getFieldValues,
    getFirstFieldValue,
    setupMapClick,
    teardownMapClick,
  };
}
