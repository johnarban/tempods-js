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
import { parcelRanges } from '../../date_time_range_selection/date_time_range_generators';

import { TimeRangeOffsetter } from './TimeRangeOffsetter';
import tz_lookup from '@photostructure/tz-lookup';

// ============================================================================
// TYPES
// ============================================================================

export type ParcelingMode = 'none' | 'default' | 'smart';

export interface RequestStats {
  status: 'success' | 'error';
  statusCode: number | null;
  errorType: 'none' | '503' | '400' | 'other';
  errorMessage?: string; // Error message for debugging
  duration: number; // milliseconds
  sampleCount: number;
  retried: boolean;
  retriedFrom503?: boolean; // Track if this was a retried 503 that succeeded
  timestamp: number;
  timeRange: MillisecondRange;
  url: string;
}

export interface FetchOptions {
  sampleCount?: number;
  interpolation?: EsriInterpolationMethod;
  returnFirstValueOnly?: boolean;
  outFields?: string | string[];
  sliceID?: string | number;
  onProgress?: (stats: RequestStats, completed: number, total: number) => void;
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
  stats?: RequestStats; // Added for individual request tracking
}

export interface TimeSeriesData {
  values: Record<number, AggValue>;
  errors: Record<number, DataPointError>;
  locations: Array<{ x: number; y: number }>;
  geometryType: 'rectangle' | 'point';
  stats?: RequestStats[]; // Added for aggregated request tracking
  expectedTotalSamples?: number; // Expected total samples (for smart parceling)
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
  
  getTimestampsFromMetadata(): number[] {
    if (!this.metadataCache) {
      return [];
    }
    
    // Cast to include multidimensionalInfo which may exist but isn't in the type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = this.metadataCache as any;
    
    if (!metadata.multidimensionalInfo) {
      return [];
    }
    
    // Extract timestamps from multidimensionalInfo
    const multidimInfo = metadata.multidimensionalInfo;
    if (!multidimInfo.multidimensionalDefinition || multidimInfo.multidimensionalDefinition.length === 0) {
      return [];
    }
    
    // Find the time dimension (usually StdTime)
    const timeDimension = multidimInfo.multidimensionalDefinition.find(
      (def: { dimensionName: string }) => def.dimensionName === 'StdTime'
    );
    
    if (!timeDimension || !timeDimension.values || timeDimension.values.length === 0) {
      return [];
    }
    
    // Extract timestamp values
    const timestamps: number[] = [];
    for (const value of timeDimension.values) {
      if (Array.isArray(value)) {
        // If value is an array, take the first element
        timestamps.push(value[0]);
      } else {
        timestamps.push(value);
      }
    }
    
    return timestamps.sort((a, b) => a - b);
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
  private rateLimitMs: number = 50; // Delay between requests in milliseconds
  private maxRetries503: number = 1; // Maximum number of retries for 503 errors
  
  // Smart parceling configuration
  private maxSamplesPerRequest: number = 5000; // ESRI service limit
  private safetyMargin: number = 0.9; // Use 90% of limit to avoid edge cases
  private parcelingMode: ParcelingMode = 'smart'; // Parceling mode: 'none', 'default', or 'smart'
  private defaultParcelSize: number = 7 * 24 * 60 * 60 * 1000; // Default parcel size (1 week in ms)
  private availableTimestamps: number[] = []; // Cached timestamps from service
  
  constructor(baseUrl: string | string[], variable: Variables | string = "NO2_Troposphere", rateLimitMs: number = 50, maxRetries503: number = 1) {
    super(Array.isArray(baseUrl) ? baseUrl[0] : baseUrl);
    this._baseUrls = baseUrl;
    this.rateLimitMs = rateLimitMs;
    this.maxRetries503 = maxRetries503;
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
  
  // Override to also update timestamps when metadata is refreshed
  async updateMetadataCache(): Promise<EsriImageServiceSpec> {
    const result = await super.updateMetadataCache();
    // Note: Timestamps should be set explicitly via setAvailableTimestamps()
    // rather than extracted from metadata for better control
    console.log(`Metadata cache updated. Use setAvailableTimestamps() to populate timestamps for smart parceling.`);
    return result;
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

  setRateLimit(ms: number): void {
    this.rateLimitMs = Math.max(0, Math.min(100, ms));
  }

  setRetryLimit(retries: number): void {
    this.maxRetries503 = Math.max(0, Math.floor(retries));
  }

  setMaxSamplesPerRequest(max: number): void {
    this.maxSamplesPerRequest = Math.max(1, Math.floor(max));
  }

  setSafetyMargin(margin: number): void {
    this.safetyMargin = Math.max(0.1, Math.min(1.0, margin));
  }

  setParcelingMode(mode: ParcelingMode): void {
    this.parcelingMode = mode;
  }

  getParcelingMode(): ParcelingMode {
    return this.parcelingMode;
  }

  setDefaultParcelSize(sizeMs: number): void {
    this.defaultParcelSize = Math.max(1000, sizeMs); // Minimum 1 second
  }

  setAvailableTimestamps(timestamps: number[]): void {
    this.availableTimestamps = [...timestamps].sort((a, b) => a - b);
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
    numRetries: number = 0,
    wasRetried503: boolean = false, // Track if this is a retry from a 503
  ): Promise<RawSampleData> {
    const skipRetry = numRetries >= this.maxRetries503;
    const startTime = performance.now();
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
    
    const stats: RequestStats = {
      status: 'error',
      statusCode: null,
      errorType: 'other',
      duration: 0,
      sampleCount: 0,
      retried: numRetries > 0,
      retriedFrom503: wasRetried503,
      timestamp: Date.now(),
      timeRange: timeRange,
      url: urlWithParams
    };
    
    try {
      const response = await fetch(urlWithParams);
      stats.statusCode = response.status;
      
      if (!response.ok) {
        stats.errorType = response.status === 503 ? '503' : response.status === 400 ? '400' : 'other';
        stats.errorMessage = `HTTP error! status: ${response.status}`;
        throw new Error(stats.errorMessage);
      }
      
      const data: EsriGetSamplesReturn | EsriGetSamplesReturnError = await response.json();
      
      if ('error' in data) {
      // Retry if we get a 503 error and haven't exceeded max retries
        stats.statusCode = data.error.code;
        stats.errorType = data.error.code === 503 ? '503' : data.error.code === 400 ? '400' : 'other';
        stats.errorMessage = `${data.error.message} ${data.error.details || ''}`.trim();
        
        if (data.error.code === 503 && !skipRetry) {
          console.warn(`Received 503 error, retrying after delay (attempt ${numRetries + 1}/${this.maxRetries503})...`);
          await delay(1000); // Wait 1 second before retrying
          return this.fetchSample(geometry, timeRange, options, numRetries + 1, true); // Increment retry count
        }
        
        stats.duration = performance.now() - startTime;
        throw new Error(`Error fetching samples (${data.error.code}): ${data.error.message} ${data.error.details}`);
      }

      const processedSamples = data.samples.map((sample: EsriGetSamplesSample) => ({
        x: sample.location.x,
        y: sample.location.y,
        time: sample.attributes.StdTime,
        date: new Date(sample.attributes.StdTime),
        variable: safeParseNumber(sample.attributes[this.variable] ?? ''),
        value: safeParseNumber(sample.value),
        locationId: sample.locationId,
        geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point' as 'rectangle' | 'point'
      })); // this is a CEsriTimeseries[]
      
      // Update stats for successful request
      stats.status = 'success';
      stats.errorType = 'none';
      stats.statusCode = response.status;
      stats.sampleCount = processedSamples.length;
      stats.duration = performance.now() - startTime;
      
      return {
        samples: processedSamples,
        metadata: {
          totalSamples: processedSamples.length,
          timeRange: timeRange,
          geometry,
          geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point'
        },
        stats: stats
      };
    } catch (error) {
      stats.duration = performance.now() - startTime;
      
      // Capture error message if not already set
      if (!stats.errorMessage && error instanceof Error) {
        stats.errorMessage = error.message;
      }
      
      console.error('Error in TempoDataService.fetchSamples:', params, error);
      
      // Still return the stats even on error, wrapped in the error
      const enhancedError = error as Error & { stats?: RequestStats };
      enhancedError.stats = stats;
      throw enhancedError;
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
    
    // Apply parceling based on mode
    const sampleCount = options.sampleCount || 30;
    let parceledRanges: MillisecondRange[];
    let expectedTotalSamples: number | undefined;
    
    switch (this.parcelingMode) {
    case 'none':
      console.log(`📊 Parceling Mode: NONE - Using ${timeRanges.length} ranges as-is`);
      parceledRanges = timeRanges;
      break;
      
    case 'default':
      console.log(`📊 Parceling Mode: DEFAULT - Using fixed parcel size (${this.defaultParcelSize}ms)`);
      parceledRanges = parcelRanges(timeRanges, this.defaultParcelSize);
      console.log(`   Input time ranges: ${timeRanges.length}`);
      console.log(`   Output time ranges: ${parceledRanges.length}`);
      console.log(`   Requests to make: ${parceledRanges.length}`);
      break;
      
    case 'smart': {
      console.log(`📊 Parceling Mode: SMART - Optimizing based on timestamp availability`);
      const smartResult = this.smartParcelTimeRanges(timeRanges, sampleCount);
      parceledRanges = smartResult.ranges;
      expectedTotalSamples = smartResult.expectedTotalSamples;
      console.log(`   Input time ranges: ${timeRanges.length}`);
      console.log(`   Output time ranges: ${parceledRanges.length}`);
      console.log(`   Expected total samples: ${expectedTotalSamples?.toLocaleString()}`);
      console.log(`   Requests to make: ${parceledRanges.length}`);
      if (parceledRanges.length !== timeRanges.length) {
        console.log(`   ✂️  Split ${timeRanges.length} ranges into ${parceledRanges.length} requests`);
      }
      break;
    }
    }
    
    console.log(`Fetching samples for ${parceledRanges.length} time ranges (${timeRanges.length} original)...`);
    const allStats: RequestStats[] = [];
    const totalRanges = parceledRanges.length;
    let completedRanges = 0;
    
    const promises = parceledRanges.map(async (tr, index) => {
      try {
        const result = await delay(100 + this.rateLimitMs * index).then(() => {
          return this.fetchSample(geometry, tr, options);
        });
        
        // Track progress
        completedRanges++;
        if (result.stats) {
          allStats.push(result.stats);
          // Call progress callback if provided
          if (options.onProgress) {
            options.onProgress(result.stats, completedRanges, totalRanges);
          }
        }
        
        return result;
      } catch (error) {
        console.error(`Error fetching sample for time range ${tr.start}-${tr.end}:`, error);
        
        // Track progress even on error
        completedRanges++;
        
        // Collect stats from errors too
        const enhancedError = error as Error & { stats?: RequestStats };
        if (enhancedError.stats) {
          allStats.push(enhancedError.stats);
          // Call progress callback for errors too
          if (options.onProgress) {
            options.onProgress(enhancedError.stats, completedRanges, totalRanges);
          }
        }
        return null;
      }
    });

    return Promise.all(promises).then((results) => {
      const validResults = results.filter((result): result is RawSampleData => result !== null);
      
      // Collect all stats
      validResults.forEach(result => {
        if (result.stats) {
          allStats.push(result.stats);
        }
      });
      
      const samples = validResults.map((result) => result.samples).flat();
      console.log(`Total samples fetched across all time ranges: ${samples.length}`);
      console.log(`Request statistics: ${allStats.length} total requests, ${allStats.filter(s => s.status === 'success').length} successful`);
      
      // Create a combined result with all stats
      const result: RawSampleData & { allStats?: RequestStats[]; expectedTotalSamples?: number } = {
        samples,
        metadata: {
          totalSamples: samples.length,
          timeRange: parceledRanges,
          geometry: geometry,
          geometryType: this.isRectBounds(geometry) ? 'rectangle' : 'point',
        },
        stats: allStats.length > 0 ? allStats[0] : undefined // Keep single stat for backward compatibility
      };
      
      // Add all stats as a separate property for the testing app
      if (allStats.length > 0) {
        result.allStats = allStats;
      }
      
      // Add expected total samples if available (from smart parceling)
      if (expectedTotalSamples !== undefined) {
        result.expectedTotalSamples = expectedTotalSamples;
      }
      
      return result as RawSampleData;
    });
  }

  // ============================================================================
  // AGGREGATION METHODS
  // ============================================================================

  /**
   * Aggregate samples by time (for rectangle areas)
   */
  aggregateByTime(samples: CEsriTimeseries[], stats?: RequestStats[]): TimeSeriesData {
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

    return { 
      values, 
      errors, 
      locations, 
      geometryType: samples[0]?.geometryType || 'rectangle',
      stats: stats 
    };
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
    const rawData = await this.fetchSamples(geometry, localTimeRanges, options) as RawSampleData & { allStats?: RequestStats[]; expectedTotalSamples?: number };
    // const stats = this.getTimeSeriesStatistics(rawData);
    
    // Pass through all stats if available
    const allStats = rawData.allStats || (rawData.stats ? [rawData.stats] : undefined);
    const result = this.aggregateByTime(rawData.samples, allStats);
    
    // Pass through expected total samples if available
    if (rawData.expectedTotalSamples !== undefined) {
      result.expectedTotalSamples = rawData.expectedTotalSamples;
    }
    
    return result;
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
    const sum = validSamples.reduce((acc, val) => acc! + (val ?? 0), 0);
    return { value: sum! / validSamples.length, date: new Date(time) };
  }

  private calculateError(samples: (number | null)[]): DataPointError {
    const validSamples = samples.filter((sample) => sample !== null);
    if (validSamples.length === 0) return { lower: null, upper: null };
    
    const mean = validSamples.reduce((acc, val) => acc! + (val ?? 0), 0)! / validSamples.length;
    const squaredDiffs = validSamples.map((sample) => {
      if (sample === null) return 0;
      return Math.pow(sample - mean, 2);
    });
    // squared standard error of the mean = variance / n
    const squaredSEM = squaredDiffs.reduce((acc, val) => acc + val, 0) / Math.pow(validSamples.length, 2);
    
    return { lower: Math.sqrt(squaredSEM), upper: Math.sqrt(squaredSEM) };
  }

  // ============================================================================
  // SMART PARCELING HELPERS
  // ============================================================================

  /**
   * Efficiently count timestamps in each range using a two-pointer algorithm.
   * Both timestamps and ranges must be sorted in ascending order.
   * Time complexity: O(T + R) where T = number of timestamps, R = number of ranges
   * 
   * @param ranges - Array of time ranges (must be sorted by start time)
   * @returns Array of counts, one per range
   */
  private countTimestampsInRanges(ranges: MillisecondRange[]): number[] {
    if (this.availableTimestamps.length === 0 || ranges.length === 0) {
      return ranges.map(() => 0);
    }

    const counts: number[] = [];
    let timestampIndex = 0; // Pointer into availableTimestamps array
    
    for (const range of ranges) {
      let count = 0;
      
      // Skip timestamps before the current range
      while (timestampIndex < this.availableTimestamps.length && 
             this.availableTimestamps[timestampIndex] < range.start) {
        timestampIndex++;
      }
      
      // Save the starting position for this range
      const rangeStartIndex = timestampIndex;
      
      // Count timestamps within the range
      while (timestampIndex < this.availableTimestamps.length && 
             this.availableTimestamps[timestampIndex] <= range.end) {
        count++;
        timestampIndex++;
      }
      
      counts.push(count);
      
      // Reset to the start position for the next range
      // This handles overlapping or out-of-order ranges
      timestampIndex = rangeStartIndex;
      
      // Optimization: if ranges are guaranteed non-overlapping and sorted,
      // we don't need to reset. But for safety, we reset here.
    }
    
    return counts;
  }

  /**
   * Get timestamps that fall within a given time range (for splitting)
   * @param range - Time range to filter
   * @returns Array of timestamps within the range
   */
  private getTimestampsInRange(range: MillisecondRange): number[] {
    // Binary search for efficiency
    const startIdx = this.binarySearchStart(range.start);
    const endIdx = this.binarySearchEnd(range.end, startIdx);
    
    return this.availableTimestamps.slice(startIdx, endIdx + 1);
  }

  /**
   * Binary search to find the first timestamp >= target
   */
  private binarySearchStart(target: number): number {
    let left = 0;
    let right = this.availableTimestamps.length - 1;
    let result = this.availableTimestamps.length;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.availableTimestamps[mid] >= target) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return result;
  }

  /**
   * Binary search to find the last timestamp <= target
   */
  private binarySearchEnd(target: number, startIdx: number): number {
    let left = startIdx;
    let right = this.availableTimestamps.length - 1;
    let result = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.availableTimestamps[mid] <= target) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return result;
  }

  /**
   * Intelligently parcel time ranges based on sample count and timestamp availability
   * to avoid exceeding the ESRI service limit while maximizing request size
   */
  private smartParcelTimeRanges(
    timeRanges: MillisecondRange[],
    sampleCount: number
  ): { ranges: MillisecondRange[]; expectedTotalSamples: number } {
    // If no timestamps are available, can't do smart parceling
    if (this.availableTimestamps.length === 0) {
      console.warn('No timestamps available for smart parceling, using ranges as provided');
      return { ranges: timeRanges, expectedTotalSamples: 0 };
    }

    const effectiveLimit = Math.floor(this.maxSamplesPerRequest * this.safetyMargin);
    const maxTimestampsPerRequest = Math.floor(effectiveLimit / sampleCount);
    
    if (maxTimestampsPerRequest < 1) {
      console.warn(`Sample count (${sampleCount}) exceeds effective limit (${effectiveLimit}). Cannot parcel safely.`);
      return { ranges: timeRanges, expectedTotalSamples: 0 };
    }
    
    console.log(`Smart parceling: effectiveLimit=${effectiveLimit}, sampleCount=${sampleCount}, maxTimestamps=${maxTimestampsPerRequest}`);

    // Count timestamps in all ranges efficiently with one pass
    const timestampCounts = this.countTimestampsInRanges(timeRanges);
    
    const parceledRanges: MillisecondRange[] = [];
    const totalInputRanges = timeRanges.length;
    let totalOutputRanges = 0;
    let totalTimestampsAcrossAllRanges = 0;
    let skippedEmptyRanges = 0;

    // Log details for each input range
    console.log(`%c📋 Input Range Analysis`, 'color: #9C27B0; font-weight: bold; font-size: 12px');
    
    for (let i = 0; i < timeRanges.length; i++) {
      const range = timeRanges[i];
      const timestampCount = timestampCounts[i];
      const totalSamples = timestampCount * sampleCount;
      
      totalTimestampsAcrossAllRanges += timestampCount;

      // Get the actual timestamps in this range for detailed logging
      const timestampsInRange = this.getTimestampsInRange(range);
      const rangeStart = new Date(range.start).toISOString();
      const rangeEnd = new Date(range.end).toISOString();
      
      if (timestampCount === 0) {
        console.log(`   Range ${i + 1}: [${rangeStart} - ${rangeEnd}]`);
        console.log(`      ❌ NO TIMESTAMPS - Range will be skipped`);
        skippedEmptyRanges++;
        continue;
      }
      
      console.log(`   Range ${i + 1}: [${rangeStart} - ${rangeEnd}]`);
      console.log(`      ✓ ${timestampCount} timestamp(s), ${totalSamples} total samples`);
      
      // Show the actual timestamps (limit to first few if many)
      if (timestampCount <= 5) {
        timestampsInRange.forEach(ts => {
          console.log(`        • ${new Date(ts).toISOString()}`);
        });
      } else {
        timestampsInRange.slice(0, 3).forEach(ts => {
          console.log(`        • ${new Date(ts).toISOString()}`);
        });
        console.log(`        ... and ${timestampCount - 3} more`);
      }

      // If this range fits within the limit, keep it as-is
      if (totalSamples <= effectiveLimit) {
        parceledRanges.push(range);
        totalOutputRanges++;
        continue;
      }

      // Need to split this range
      console.log(`      ⚠️  Exceeds limit (${totalSamples} > ${effectiveLimit}), splitting into ${Math.ceil(timestampCount / maxTimestampsPerRequest)} sub-ranges`);

      // Split timestamps into chunks
      for (let j = 0; j < timestampsInRange.length; j += maxTimestampsPerRequest) {
        const chunkTimestamps = timestampsInRange.slice(j, j + maxTimestampsPerRequest);
        
        if (chunkTimestamps.length === 0) continue;

        // Create a new range from first to last timestamp in this chunk
        const newRange: MillisecondRange = {
          start: chunkTimestamps[0],
          end: chunkTimestamps[chunkTimestamps.length - 1]
        };

        parceledRanges.push(newRange);
        totalOutputRanges++;
      }
    }
    
    // Calculate expected total samples: total timestamps × sample count
    const expectedTotalSamples = totalTimestampsAcrossAllRanges * sampleCount;

    console.log(`%cSmart parceling complete:`, 'color: #4CAF50; font-weight: bold');
    console.log(`   Input ranges:     ${totalInputRanges}`);
    console.log(`   Skipped (empty):  ${skippedEmptyRanges}`);
    console.log(`   Output ranges:    ${totalOutputRanges}`);
    console.log(`   Expected samples: ${expectedTotalSamples.toLocaleString()}`);
    
    return { ranges: parceledRanges, expectedTotalSamples };
  }
} 