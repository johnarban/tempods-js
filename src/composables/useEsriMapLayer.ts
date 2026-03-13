import { ref, shallowRef, watch, Ref, MaybeRef, toRef, computed, nextTick } from 'vue';
import { RenderingRuleOptions } from '@/esri/ImageLayerConfig';
import type { Map, MapSourceDataEvent, MapMouseEvent } from 'maplibre-gl';
import { validate as uuidValidate } from "uuid";

import { ImageService } from '@/esri/ImageServiceLayer/ImageService';
import { TempoDataService, type ServiceStatusMap } from '@/esri/services/TempoDataService';
import { type PointBounds } from '@/esri/geometry';



export interface UseEsriLayer {
  esriImageSource: Ref<maplibregl.RasterTileSource | null>;
  opacity: Ref<number>;
  noEsriData: Ref<boolean>;
  dataRangeWarning: Ref<string | null>;
  updateEsriOpacity: (value?: number | null | undefined) => void;
  updateEsriTimeRange: () => void;
  addEsriSource: (map: Map) => void;
  removeEsriSource: () => void;
  renderOptions: Ref<RenderingRuleOptions>;
  serviceReady: Ref<ServiceStatusMap>;
}

export interface ImageSerivceLayerOptions {
  renderingRule?: RenderingRuleOptions;
  visible?: boolean;
  clickValue?: boolean;
  exportImageOptions?: Record<string, unknown>;
}

export function useEsriImageServiceLayer(
  serviceUrl: string,
  layerId: string,
  opacity: MaybeRef<number>,
  variable: MaybeRef<string>,
  _timestamp: MaybeRef<number | null>,
  options: ImageSerivceLayerOptions = {},
): UseEsriLayer {

  const timestamp = toRef(_timestamp);
  const url = ref(serviceUrl);
  const esriLayerId = layerId;
  const esriImageSource = ref<maplibregl.RasterTileSource | null>(null);
  const map = shallowRef<Map | null>(null); // instead of ref, prevent's "infinitely deep typescript error"
  const variableRef = toRef(variable);
  
  const tds = new TempoDataService(serviceUrl, variableRef.value);
  const serviceReady = ref<ServiceStatusMap>(new globalThis.Map());
  const esriTimesteps = ref<number[]>([]);
  let lastEsriTimeRange: { from: number; to: number } | null = null;
  let esriTimestepsPromise: Promise<number[]> | null = null;

  const dataRangeWarning = ref<string | null>(null);

  function rangesEqual(a: { from: Date; to: Date }, b: { from: number; to: number }): boolean {
    return a.from.getTime() === b.from && a.to.getTime() === b.to;
  }

  function isInvalidTimestamp(value: number | null | undefined): boolean {
    return value === null || value === undefined || Number.isNaN(value);
  }

  function loadEsriTimesteps() {
    if (esriTimestepsPromise) return esriTimestepsPromise;
    esriTimestepsPromise = tds.getMergedTimesteps()
      .then((steps) => {
        esriTimesteps.value = steps;
        return steps;
      })
      .catch((error) => {
        console.error(`[${esriLayerId}] Failed to load ESRI timesteps`, error);
        esriTimesteps.value = [];
        return [];
      });
    return esriTimestepsPromise;
  }

  function resolveTimestampRange(value: number | null | undefined): {
    range: { from: Date; to: Date } | null;
    warning: string | null;
  } {
    if (isInvalidTimestamp(value)) {
      return { range: null, warning: null };
    }
    const steps = esriTimesteps.value;
    const time = Number(value);

    if (steps.length === 0) {
      return { range: { from: new Date(time - 1), to: new Date(time + 1) }, warning: null };
    }

    const first = steps[0];
    const last = steps[steps.length - 1];
    if (time <= first || time >= last) {
      const firstOrLast = time <= first ? first : last;
      const outOfRange = time < first || time > last;
      if (outOfRange) {
        const boundary = new Date(firstOrLast).toISOString();
        const warning = time < first
          ? `Selected date is before the first available layer date (${boundary}); showing nearest available date.`
          : `Selected date is after the last available layer date (${boundary}); showing nearest available date.`;
        console.warn(warning);
        return { range: { from: new Date(firstOrLast), to: new Date(firstOrLast) }, warning };
      }
      return { range: { from: new Date(firstOrLast), to: new Date(firstOrLast) }, warning: null };
    }

    let low = 0;
    let high = steps.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (steps[mid] < time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const prev = steps[low - 1];
    const next = steps[low];
    if (next === time) {
      return { range: { from: new Date(time), to: new Date(time) }, warning: null };
    }
    if (prev === undefined || next === undefined) {
      
      const warning = `No ESRI timestep slice found for ${new Date(time ?? 0).toISOString()}`;
      console.warn(warning);
      return { range: null, warning };
    }

    return {
      range: { from: new Date(prev), to: new Date(next) },
      warning: null,
    };
  }

  function serviceStatusAllFailed(status: ServiceStatusMap): boolean {
    return status.size > 0 && [...status.values()].every((ready) => ready === false);
  }

  function setEsriTimeRange(value: number | null | undefined) {
    const result = resolveTimestampRange(value);
    const { range, warning } = result;
    dataRangeWarning.value = warning;

    if (!range) {
      if (isInvalidTimestamp(value)) {
        console.warn(`[${esriLayerId}] timestamp is not available for ESRI date update`);
        dataRangeWarning.value = null;
        return;
      }
      noEsriData.value = true;
      return;
    }

    console.log(`[${esriLayerId}] esri imageset timestamp set to `, range.from);
    noEsriData.value = false;
    if (_hasEsriSource() && dynamicMapService.value) {
      const candidate = { from: range.from.getTime(), to: range.to.getTime() };
      if (lastEsriTimeRange && rangesEqual(range, lastEsriTimeRange)) {
        console.debug(`[${esriLayerId}] ESRI date range unchanged; skipping setDate`);
        return;
      }
      dynamicMapService.value.setDate(range.from, range.to);
      lastEsriTimeRange = candidate;
    }
  }

  const updateEsriTimeRange = () => setEsriTimeRange(timestamp.value);

  function getServiceStatus() {
    serviceReady.value = new globalThis.Map(tds.publicServiceStatus);

    tds.serviceStatusReady().then((ready) => {
      const servicesReady = new globalThis.Map<string, boolean | null>();
      for (const kv of ready) {
        servicesReady.set(kv[0], kv[1] ?? false); // if still null, treat as false,service is degraded
      }
      serviceReady.value = servicesReady;
    })
      .catch((error) => {
        console.error(`[${esriLayerId}] Failed to read service status`, error);
        // set status to false, service is down or degraded
        serviceReady.value = new globalThis.Map(
          tds.baseUrlArray.map(url => [url, false])
        );
      });
  }
  getServiceStatus();


  const opacityRef = toRef(opacity);
  const noEsriData = ref(false);

  
  const esriOptions = computed(() => {
    return  {
      'format': 'png',
      'pixelType': 'U8',
      'size': '256,256',
      'transparent': true,
      'bboxSR': 3857,
      'imageSR': 3857,
      'bbox': '{bbox-epsg-3857}',
      'interpolation': 'RSP_NearestNeighbor',
      'renderingRule': options.renderingRule || {},
      ...options.exportImageOptions || {},
    };
  });

  
  function addLayer(map: Map | null | undefined) {

    if (map && !map.getLayer(esriLayerId)) {
      map.addLayer({
        id: esriLayerId,
        type: 'raster',
        source: esriLayerId,
        paint: {
          'raster-resampling': 'nearest',
          'raster-opacity': (options.visible === false) ? 0.0 : (opacityRef.value ?? 0.8),
        },
        layout: {
          'visibility': (options.visible === false) ? 'none' : 'visible',
        }
      });
      let index = -1;
      for (const [idx, layer] of Object.entries(map.getStyle().layers)) {
        if (uuidValidate(layer.id)) {
          index = Number(idx) - 1;
        }
      }
      if (index >= 0) {
        map.moveLayer(esriLayerId, map.getStyle().layers[index].id);
      }
    }
  }
  
  function removeLayer(map: Map | null | undefined) {
    if (map && map.getLayer(esriLayerId)) {
      map.removeLayer(esriLayerId);
    }
  }
  
  const dynamicMapService = ref<ImageService | null>(null);
  const clickHandler = ref<((e: MapMouseEvent) => void) | null>(null);
  
  function onSourceLoad(e: MapSourceDataEvent) {
    // console.log(`sourcedata event for ${esriLayerId}: `);
    if (e.sourceId === esriLayerId && e.isSourceLoaded && map.value?.getSource(esriLayerId)) {
      console.log(`ESRI source ${esriLayerId} loaded`);
      esriImageSource.value = map.value?.getSource(esriLayerId) as maplibregl.RasterTileSource;
      updateEsriOpacity();
      void loadEsriTimesteps().finally(() => {
        nextTick(() => {
          setEsriTimeRange(timestamp.value);
        });
      });
      if (options.visible !== undefined && !options.visible) {
        map.value?.setLayoutProperty(esriLayerId, 'visibility', 'none');
      }
      map.value?.off('sourcedata', onSourceLoad);
    }
  }
  
  function createImageService(map: Map, url: string, options) {
    // console.log(`[${esriLayerId}] Creating image service with options:`, options);
    return new ImageService(
      esriLayerId,
      map,
      {
        url: url,
        ...options
      },
      {
        tileSize: 256,
      }
    );
    
  }
  
  function addEsriSource(mMap: Map) {
    if (!mMap) return;
    map.value = mMap;

    if (mMap.getLayer(esriLayerId) || mMap.getSource(esriLayerId)) {
      removeEsriSource();
    }

    try {
      void loadEsriTimesteps();
      dynamicMapService.value = createImageService(mMap, url.value, esriOptions.value);

      addLayer(mMap);
      // this event will run until the source is loaded
      mMap.off('sourcedata', onSourceLoad);
      mMap.on('sourcedata', onSourceLoad);
      console.log(`[${esriLayerId}] Adding ESRI source to map`);
      if (serviceStatusAllFailed(serviceReady.value)) {
        console.warn(`[${esriLayerId}] All backing services are unavailable or unknown. Layer added but hidden.`);
        mMap.setLayoutProperty(esriLayerId, 'visibility', 'none');
      }
    } catch (error) {
      console.error(`[${esriLayerId}] Failed to add ESRI source`, error);
      removeEsriSource();
      return;
    }

    if (options.clickValue && !clickHandler.value) {
      clickHandler.value = (e: MapMouseEvent) => {
        if (_hasEsriSource() && map.value) {
          const point = { x: e.lngLat.lng, y: e.lngLat.lat } as PointBounds;
          const rangeResult = resolveTimestampRange(timestamp.value);
          const range = rangeResult.range;
          if (!range) {
            return;
          }
          const timeRange = {start: range.from.getTime(), end: range.to.getTime()};
          tds.fetchSample(point, timeRange).then((val) => {
            console.log(`[${esriLayerId}] Value at point`, point, 'is', val.samples.map(v => v.value));
          }).catch((err) => {
            console.error(`[${esriLayerId}] Error fetching sample:`, err);
          });
        }
      };
      mMap.on('click', clickHandler.value);
    }
  }
  
    
  function removeEsriSource() {
    if (!map.value) return;
    
    // make sure we clean up events
    map.value.off('sourcedata', onSourceLoad);
    if (clickHandler.value) {
      map.value.off('click', clickHandler.value);
      clickHandler.value = null;
    }
    
    removeLayer(map.value);
    if (map.value && map.value.getSource(esriLayerId)) {
      map.value.removeSource(esriLayerId);
    }
    dynamicMapService.value = null;
    esriImageSource.value = null;
    lastEsriTimeRange = null;
  }
  
  function _hasEsriSource() {
    return map.value?.getSource(esriLayerId) !== undefined;
  }
  
  watch(esriTimesteps, () => {
    updateEsriTimeRange();
  });
  watch(timestamp, (_value) => {
    setEsriTimeRange(_value);
  });
  
  
  
  function updateEsriOpacity(value: number | null | undefined = undefined) {
    if (map.value && map.value.getLayer(esriLayerId)) {
      map.value.setPaintProperty(esriLayerId, 'raster-opacity', value ?? opacityRef.value ?? 0.8);
    }
  }

  // watch serviceReady b/c it may get set after the layer has been added to the map
  watch(serviceReady, (readiness) => {
    if (serviceStatusAllFailed(readiness)) {
      if (map.value?.getLayer(esriLayerId)) {
        map.value.setLayoutProperty(esriLayerId, 'visibility', 'none');
      }
    }
  });

  watch(opacityRef, (_value: number) => {
    updateEsriOpacity(_value);
  });

  watch(noEsriData, (value: boolean) => {
    if (value) {
      updateEsriOpacity(0);
      removeLayer(map.value);
    } else {
      addLayer(map.value);
    }
  });

  return {
    esriImageSource,
    opacity: opacityRef,
    noEsriData,
    dataRangeWarning,
    updateEsriTimeRange,
    updateEsriOpacity,
    addEsriSource,
    removeEsriSource,
    serviceReady,
  } as UseEsriLayer;
}
