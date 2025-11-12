/* eslint-disable @typescript-eslint/naming-convention */
import { rectangleToGeometry, pointToGeometry } from '../geometry';
import type { RectBounds, PointBounds, EsriGeometryType } from '../geometry';
import type { 
  EsriGetSamplesReturn, 
  EsriGetSamplesReturnError, 
  EsriGetSamplesSample, 
  Variables, 
  EsriInterpolationMethod, 
  CEsriTimeseries, 
  EsriImageServiceSpec,
} from '../types';
import type { AggValue, DataPointError, MillisecondRange } from "../../types";
import {nanmean, diff} from '../../utils/array_operations/array_math';
import { EsriSampler } from './sampling';

import { TimeRangeOffsetter } from './TimeRangeOffsetter';
import tz_lookup from '@photostructure/tz-lookup';

// ============================================================================
// TYPES
// ============================================================================

export interface FetchOptions {
  sampleCount?: number;
  interpolation?: EsriInterpolationMethod;
  returnFirstValueOnly?: boolean;
  outFields?: string | string[];
  sliceID?: string | number;
}


export type TimeRanges = MillisecondRange | MillisecondRange[];

export interface RawSampleData {
  samples: CEsriTimeseries[];
  metadata: {
    totalSamples: number;
    timeRange: MillisecondRange | MillisecondRange[];
    geometry: RectBounds | PointBounds;
    geometryType: 'rectangle' | 'point';
  };
}

export interface TimeSeriesData {
  values: Record<number, AggValue>;
  errors: Record<number, DataPointError>;
  locations: Array<{ x: number; y: number }>;
  geometryType: 'rectangle' | 'point';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function safeParseNumber(value: string | null | undefined): number | null {
  if (value === null || value === '' || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const RATE_LIMIT_MS = 50; // Delay between requests in milliseconds

function stringifyEsriGetSamplesParameters(params: {
  geometry: ReturnType<typeof rectangleToGeometry> | ReturnType<typeof pointToGeometry>;
  geometryType: EsriGeometryType;
  sampleDistance?: number;
  sampleCount?: number;
  mosaicRule?: string | Record<string, unknown>;
  pixelSize?: number;
  returnFirstValueOnly?: boolean;
  interpolation: EsriInterpolationMethod;
  outFields?: string | string[];
  sliceID?: string | number;
  time?: string | [number, number] | [Date, Date];
  f: 'pjson';
}): URLSearchParams {
  const {
    geometry,
    geometryType,
    sampleDistance,
    sampleCount,
    mosaicRule,
    pixelSize,
    returnFirstValueOnly,
    interpolation,
    outFields,
    sliceID,
    time,
  } = params;
  
  const options: Record<string, string> = {
    f: 'pjson',
    geometry: JSON.stringify(geometry),
    geometryType: geometryType,
    interpolation: interpolation,
  };

  if (sampleDistance) options.sampleDistance = sampleDistance.toString();
  if (sampleCount) options.sampleCount = sampleCount.toString();
  if (mosaicRule) options.mosaicRule = JSON.stringify(mosaicRule);
  if (pixelSize) options.pixelSize = pixelSize.toString();
  if (returnFirstValueOnly !== undefined) options.returnFirstValueOnly = returnFirstValueOnly.toString();
  if (outFields) options.outFields = Array.isArray(outFields) ? outFields.join(',') : outFields;
  if (sliceID !== undefined) options.sliceID = sliceID.toString();
  if (time) {
    const timeStr = Array.isArray(time)
      ? time.map((t) => (t instanceof Date ? t.getTime() : t)).join(',')
      : time;
    options.time = timeStr;
  }

  return new URLSearchParams(options);
}


class ImageServiceServiceMetadata {
  url: string;
  metadataCache: EsriImageServiceSpec | null = null;
  private _loadingMetadata: boolean = false;
  
  constructor(url: string) {
    this.url = url;
  }
  
  private async _getServiceMetadata(): Promise<EsriImageServiceSpec> {
    const url = `${this.url}?f=json`;
    return fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        console.error('Error fetching service metadata:', error);
        throw error;
      });
  }
  
  async updateMetadataCache() {
    // in general we really should invalidate the cache when the URL changes
    // however, we know that for this purpose, the grid is identical for all
    // the various services we may access, so ease of use, we will always have a metaDataCache
    // available. 
    // this.metadataCache = null; // Invalidate cache
    this._loadingMetadata = true;
    this.metadataCache = await this._getServiceMetadata();
    this._loadingMetadata = false;
    console.log('Service metadata updated:', this.metadataCache);
    return this.metadataCache;
  }
  
  getMetadata(): EsriImageServiceSpec {
    if (!this.metadataCache) {
      if (this._loadingMetadata) {
        throw new Error('Metadata is currently loading. Please wait and try again.');
      }
      throw new Error('Metadata not loaded yet. Call updateMetadataCache() first.');
    }
    return this.metadataCache;
  }
  
  get meta(): EsriImageServiceSpec | null {
    return this.metadataCache;
  }
  
  async withMetadataCache(): Promise<EsriImageServiceSpec> {
    if (this.metadataCache) {
      return this.metadataCache;
    }
    if (this._loadingMetadata) {
      // Wait until loading is done. Check eveery 100ms
      while (this._loadingMetadata) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.metadataCache) {
        return this.metadataCache;
      } else {
        throw new Error('Failed to load metadata.');
      }
    }
    return this.updateMetadataCache();
  }
  
  async waitForCache(): Promise<ImageServiceServiceMetadata> {
    await this.withMetadataCache();
    return this;
  }
  
  
  get timeRange(): [number, number] | null {
    if (this.metadataCache && this.metadataCache.timeInfo && this.metadataCache.timeInfo.timeExtent) {
      return [this.metadataCache.timeInfo.timeExtent[0], this.metadataCache.timeInfo.timeExtent[1]];
    }
    return null;
  }
  
  get extent(): RectBounds | null {
    if (this.metadataCache && this.metadataCache.extent) {
      return {
        xmin: this.metadataCache.extent.xmin,
        ymin: this.metadataCache.extent.ymin,
        xmax: this.metadataCache.extent.xmax,
        ymax: this.metadataCache.extent.ymax,
      };
    }
    return null;
  } 
  
  get spatialReference(): number | null {
    if (this.metadataCache && this.metadataCache.spatialReference) {
      return this.metadataCache.spatialReference.wkid || null;
    }
    return null;
  }
  
  clippedToTimeExtent(timeRange: MillisecondRange): [MillisecondRange, boolean] {
    const serviceTimeRange = this.timeRange;
    if (!serviceTimeRange) return [timeRange, false];
    const start = Math.max(timeRange.start, serviceTimeRange[0]);
    const end = Math.min(timeRange.end, serviceTimeRange[1]);
    const clipped = start !== timeRange.start || end !== timeRange.end;
    return [{ start, end }, clipped];
  }
  
  // 
}


// ============================================================================
// TEMPO DATA SERVICE
// ============================================================================

export class TempoDataService extends ImageServiceServiceMetadata {
  private _baseUrls: string | string[] = [];
  private requestUrl: string = '';
  private variable: Variables | string;
  private metas = new Map<string, ImageServiceServiceMetadata>();
  
  constructor(baseUrl: string | string[], variable: Variables | string = "NO2_Troposphere") {
    super(Array.isArray(baseUrl) ? baseUrl[0] : baseUrl);
    this._baseUrls = baseUrl;
    if (!Array.isArray(this._baseUrls)) {
      this.requestUrl = this._baseUrls;
    } else {
      this.requestUrl = this._baseUrls[this._baseUrls.length - 1];
    }
    this.baseUrlArray.forEach((url) => {
      this.metas.set(url, new ImageServiceServiceMetadata(url));
    });
    
    this.variable = variable;
    this.updateMetadataCache();
  }

  
  get baseUrlArray(): string[] {
    return Array.isArray(this._baseUrls) ? this._baseUrls : [this._baseUrls];
  }
  
  // updateMetadataCache(): void {
  //   this.baseUrlArray.forEach((url) => {
  //     if (!this.metas.has(url)) {
  //       this.metas.set(url, new ImageServiceServiceMetadata(url));
  //     }
  //   });
  // }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  setVariable(variable: Variables | string): void {
    this.variable = variable;
  }

  getVariable(): Variables | string {
    return this.variable;
  }

  setBaseUrl(baseUrl: string): void {
    if (this.baseUrl === baseUrl) return;
    this.baseUrl = baseUrl;
    this.updateMetadataCache();
  }
  
  get baseUrl(): string {
    return this.url;
  }
  
  set baseUrl(value: string) {
    if (this.url === value) return;
    this.url = value;
    this.updateMetadataCache();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  

  // ============================================================================
  // CORE DATA FETCHING
  // ============================================================================
  /**
   * Fetch raw samples from the ESRI Image Server
   */
  async fetchSample(
    geometry: RectBounds | PointBounds,
    timeRange: MillisecondRange,
    options: FetchOptions = {},
    skipRetry: boolean = false,
  ): Promise<RawSampleData> {
    const esriGeometry = this.isRectBounds(geometry) 
      ? rectangleToGeometry(geometry as RectBounds)
      : pointToGeometry(geometry as PointBounds);

    const geometryType: EsriGeometryType = this.isRectBounds(geometry)
      ? 'esriGeometryPolygon'
      : 'esriGeometryPoint';

    // Handle multiple time ranges by combining them
    const timeString = `${timeRange.start},${timeRange.end}`;


    const params = {
      f: 'pjson' as const,
      interpolation: 'RSP_NearestNeighbor' as EsriInterpolationMethod,
      returnFirstValueOnly: false,
      geometry: esriGeometry,
      geometryType: geometryType,
      time: timeString,
      sampleCount: options.sampleCount || 30, // 100 is the Esri default. 30 has been our default
      ...options
    };

    const urlWithParams = `${this.baseUrl}/getSamples/?${stringifyEsriGetSamplesParameters(params).toString()}`;
    
    try {
      const response = await fetch(urlWithParams);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data: EsriGetSamplesReturn | EsriGetSamplesReturnError = await response.json();
      
      if ('error' in data) {
      // Retry once if we get a 503 error and haven't already retried
        if (data.error.code === 503 && !skipRetry) {
          console.warn(`Received 503 error, retrying after delay...`);
          await delay(1000); // Wait 1 second before retrying
          return this.fetchSample(geometry, timeRange, options, true);
        }
        
        throw new Error(`Error fetching samples (${data.error.code}): ${data.error.message} ${data.error.details}`);
      }

      const processedSamples = data.samples.map((sample: EsriGetSamplesSample) => {
        if (sample.attributes) {
          return {
            x: sample.location.x,
            y: sample.location.y,
            time: sample.attributes?.StdTime ?? timeRange[0],
            date: new Date(sample.attributes?.StdTime ?? timeRange[0] ),
            // variable: safeParseNumber(sample.attributes[this.variable] ?? ''),
            variable: safeParseNumber(this.variable in sample.attributes ? sample.attributes[this.variable] : ''),
            value: safeParseNumber(sample.value),
            locationId: sample.locationId,
            geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point' as 'rectangle' | 'point'
          };
        } else {
          return {
            x: sample.location.x,
            y: sample.location.y,
            time: timeRange[0],
            date: new Date(timeRange[0] ),
            // variable: safeParseNumber(sample.attributes[this.variable] ?? ''),
            variable: this.variable,
            value: safeParseNumber(sample.value),
            locationId: sample.locationId,
            geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point' as 'rectangle' | 'point'
          };
        }}); // this is a CEsriTimeseries[]
      return {
        samples: processedSamples,
        metadata: {
          totalSamples: processedSamples.length,
          timeRange: timeRange,
          geometry,
          geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point'
        }
      };
    } catch (error) {
      console.error('Error in TempoDataService.fetchSamples:', params);
      throw error;
    }
  }
  
  /**
   * Fetch raw samples from the ESRI Image Server
   */
  async fetchSamples(
    geometry: RectBounds | PointBounds,
    timeRanges: TimeRanges,
    options: FetchOptions = {}
  ): Promise<RawSampleData> {
    
    if (!Array.isArray(timeRanges)) {
      return this.fetchSample(geometry, timeRanges, options);
    }
    
    console.log(`Fetching samples for ${timeRanges.length} time ranges...`);
    const promises = timeRanges.map(async (tr, index) => {
      try {
        return await delay(100 + RATE_LIMIT_MS * index).then(() => {
          return this.fetchSample(geometry, tr, options);
        });
      } catch (error) {
        console.error(`Error fetching sample for time range ${tr.start}-${tr.end}:`, error);
        return null;
      }
    });

    return Promise.all(promises).then((results) => {
      const validResults = results.filter((result): result is RawSampleData => result !== null);
      const samples = validResults.map((result) => result.samples).flat();
      console.log(`Total samples fetched across all time ranges: ${samples.length}`);
      return {
        samples,
        metadata: {
          totalSamples: samples.length,
          timeRange: timeRanges,
          geometry: geometry,
          geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point',
        }
      } as RawSampleData;
    });
  }

  // ============================================================================
  // AGGREGATION METHODS
  // ============================================================================

  /**
   * Aggregate samples by time (for rectangle areas)
   */
  aggregateByTime(samples: CEsriTimeseries[]): TimeSeriesData {
    // Group samples by time
    const grouped = new Map<number, CEsriTimeseries[]>();
    samples.forEach((sample) => {
      if (!grouped.has(sample.time)) {
        grouped.set(sample.time, []);
      }
      grouped.get(sample.time)?.push(sample);
    });

    // Calculate aggregated values
    const values: Record<number, AggValue> = {};
    const errors: Record<number, DataPointError> = {};
    
    grouped.forEach((samples, time) => {
      const sampleValues = samples.map(s => s.value);
      values[time] = this.calculateMean(sampleValues, time);
      errors[time] = this.calculateError(sampleValues);
    });

    // Collect unique locations
    const seen = new Set<string>();
    const locations: Array<{ x: number; y: number }> = [];
    for (const sample of samples) {
      const key = `${sample.x},${sample.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        locations.push({ x: sample.x, y: sample.y });
      }
    }

    return { values, errors, locations, geometryType: samples[0].geometryType };
  }

  /**
   * Get single point data (for center points or individual points)
   */
  // aggregatePoint(samples: CEsriTimeseries[]): TimeSeriesData | null {
  //   if (samples.length === 0) return null;
    
  //   // For point data, we typically expect one sample per time
  //   // Group by time and aggregate
  //   const grouped = new Map<number, CEsriTimeseries[]>();
  //   samples.forEach((sample) => {
  //     if (!grouped.has(sample.time)) {
  //       grouped.set(sample.time, []);
  //     }
  //     grouped.get(sample.time)?.push(sample);
  //   });

  //   // Calculate aggregated values
  //   const values: Record<number, AggValue> = {};
  //   const errors: Record<number, DataPointError> = {};
    
  //   grouped.forEach((samples, time) => {
  //     const sampleValues = samples.map(s => s.value);
  //     values[time] = this.calculateMean(sampleValues, time);
  //     errors[time] = this.calculateError(sampleValues);
  //   });

  //   // For point data, we expect only one location
  //   const locations: Array<{ x: number; y: number }> = [];
  //   if (samples.length > 0) {
  //     const sample = samples[0];
  //     locations.push({ x: sample.x, y: sample.y });
  //   }

  //   return { values, errors, locations };
  // }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================
  
  getTimeSeriesStatistics(jsonData: RawSampleData) {
    const samples = jsonData.samples || [];
    
    const uniqueLocations = new Set();
    const uniqueLatitudes = new Set<number>();
    const uniqueLongitudes = new Set<number>();
    const valuesPerLocation = {};
    
    for (const sample of samples) {
      const location = {x: sample.x, y: sample.y};
      const locString = `${location.x},${location.y}`;
      if (location) {
        // Use a string representation for unique locations in the Set
        uniqueLocations.add(locString);
        uniqueLatitudes.add(location.y);
        uniqueLongitudes.add(location.x);
      }
      
      valuesPerLocation[locString] = (valuesPerLocation[locString] || 0) + 1;

    }
    
    const totalValues = samples.length;
    const numUniqueLocations = uniqueLocations.size;
    
    const latitudeSpacing = diff([...uniqueLatitudes].sort());
    const longitudeSpacing = diff([...uniqueLongitudes].sort());
    
    
    
    return {
      numUniqueLocations,
      totalValues,
      valuesPerLocation,
      latitudeSpacing: nanmean(latitudeSpacing),
      longitudeSpacing: nanmean(longitudeSpacing),
    };
  }
  
  getRegionCenter(geometry: RectBounds | PointBounds): { lat: number; lon: number } {
    if (this.isRectBounds(geometry)) {
      return {
        lat: (geometry.ymin + geometry.ymax) / 2,
        lon: (geometry.xmin + geometry.xmax) / 2
      };
    } else { // It's a point
      return {
        lat: geometry.y,
        lon: geometry.x
      };
    }
  }
  /**
   * Fetch and aggragate any valid geometry data (rectangle or point)
   */
  async fetchTimeseriesData(
    geometry: RectBounds | PointBounds,
    timeRanges: TimeRanges,
    options: FetchOptions = {}
  ): Promise<TimeSeriesData> {
    
    const { lat: centerLat, lon: centerLon } = this.getRegionCenter(geometry);
    const timezone = tz_lookup(centerLat, centerLon);
    
    // Convert UTC time ranges to local time ranges for this timezone
    const offsetter = new TimeRangeOffsetter(timezone);
    const timeRangesArray = Array.isArray(timeRanges) ? timeRanges : [timeRanges];
    const localTimeRanges = offsetter.offsetRanges(timeRangesArray);
    
    
    if (this.isRectBounds(geometry) && this.meta) {
      const sampler = new EsriSampler(this.meta, geometry);
      const sampleCount = options.sampleCount || 30;
      options.sampleCount = sampler.getSamplingSpecificationFromSampleCount(sampleCount).count;
      console.log(`Taking ${options.sampleCount} samples`);
    }
    const rawData = await this.fetchSamples(geometry, localTimeRanges, options);
    // const stats = this.getTimeSeriesStatistics(rawData);
    return this.aggregateByTime(rawData.samples);
  }
  
  /**
   * Fetch and aggregate rectangle data (current fetchRectangleSamples equivalent)
   */
  // async fetchRectangleTimeseries(
  //   rectangle: RectBounds,
  //   timeRanges: TimeRanges,
  //   options: FetchOptions = {}
  // ): Promise<TimeSeriesData> {
  //   const rawData = await this.fetchSamples(rectangle, timeRanges, options);
  //   return this.aggregateByTime(rawData.samples);
  // }

  /**
   * Fetch and aggregate point data (current fetchCenterPointSample equivalent)
   */
  // async fetchPointTimeseries(
  //   point: PointBounds,
  //   timeRanges: TimeRanges,
  //   options: FetchOptions = {}
  // ): Promise<TimeSeriesData | null> {
  //   const rawData = await this.fetchSamples(point, timeRanges, options);
  //   return this.aggregatePoint(rawData.samples);
  // }

  /**
   * Get center point of rectangle and fetch data for it
   */
  async fetchCenterPointData(
    rectangle: RectBounds,
    timeRanges: TimeRanges,
    options: FetchOptions = {}
  ): Promise<TimeSeriesData | null> {
    const center: PointBounds = {
      x: (rectangle.xmin + rectangle.xmax) / 2,
      y: (rectangle.ymin + rectangle.ymax) / 2
    };
    
    return this.fetchTimeseriesData(center, timeRanges, options);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private isRectBounds(geometry: RectBounds | PointBounds): geometry is RectBounds {
    return 'xmin' in geometry && 'xmax' in geometry && 'ymin' in geometry && 'ymax' in geometry;
  }

  private calculateMean(samples: (number | null)[], time: number): AggValue {
    const validSamples = samples.filter((sample) => sample !== null);
    if (validSamples.length === 0) return { value: null, date: new Date(time) };
    const sum = validSamples.reduce((acc, val) => acc + (val ?? 0), 0);
    return { value: sum / validSamples.length, date: new Date(time) };
  }

  private calculateError(samples: (number | null)[]): DataPointError {
    const validSamples = samples.filter((sample) => sample !== null);
    if (validSamples.length === 0) return { lower: null, upper: null };
    
    const mean = validSamples.reduce((acc, val) => acc + (val ?? 0), 0) / validSamples.length;
    const squaredDiffs = validSamples.map((sample) => {
      if (sample === null) return 0;
      return Math.pow(sample - mean, 2);
    });
    // squared standard error of the mean = variance / n
    const squaredSEM = squaredDiffs.reduce((acc, val) => acc + val, 0) / Math.pow(validSamples.length, 2);
    
    return { lower: Math.sqrt(squaredSEM), upper: Math.sqrt(squaredSEM) };
  }
} 