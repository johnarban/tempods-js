/* eslint-disable indent */
/* eslint-disable @typescript-eslint/no-unused-vars */

    
import type { Prettify } from "@/types";
import {  toZonedTime } from 'date-fns-tz';
import { 
  type BinSizes, 
  binDurationMs,
  getFoldedPhase,
  applyFloorFunctions,
  _run_value_or_funcion,
  type FoldPeriods } from '../calendar_utils';

import { ResampledData } from "./binData";

import { arrayMax, arrayMin } from './array_math';

export interface FoldedData {
  x: number[];              // folded phases (milliseconds within period)
  xOriginal: number[];      // original timestamps
  y: (number | null)[];
  e?: (number | null)[];
  periodMs: number | ((d: Date) => number);
  periodMsArray?: number[]; // Actual period duration for each point (when periodMs is a function)
  epochStart: number;       // floor of earliest timestamp
  isVariablePeriod?: boolean; // true if periodMs is a function
  aggregated?: ResampledData | null;
  foldedBy: BinSizes;
}

interface FoldOptions {
  binSize: FoldPeriods;
  foldingFunction?: (date: Date) => number; // a number between 0 and periodMs
  periodMs?: number | ((d: Date) => number); // in ms
}



/**
 * TimeSeriesFolder function
 * 
 * Resample the time series data into specified time bins, applying aggregation and error functions.
 * 
 * Inputs:
 * 
 * @param x: number[] - array of timestamps (in ms since epoch)
 * @param y: (number | null)[] - array of data values (can include nulls)
 * @param e?: (number | null)[] - array of error values (can include nulls) [optional]
 * @param timezone?: string - IANA timezone string (e.g. "America/New_York") [optional]
 * @param options: FoldOptions - {binSize?: FoldPeriods, foldingFunction?: (date: Date) => number, periodMs?: number | ((d: Date) => number)}
 * 
 * Outputs:
 * 
 * @returns FoldedData - object containing resampled timestamps, values, and bin identifiers
 */
export function timeSeriesFolder(
  x: number[], 
  y: (number | null)[], 
  e: (number | null)[] = [], 
  timezone: string,
  options: FoldOptions,
): Omit<FoldedData, 'aggregated'> {
  
  // Validation: must provide either binSize or both foldingFunction + periodMs
  if (!options.binSize && !options.foldingFunction) {
    throw new Error('Either binSize or foldingFunction must be provided in foldOptions');
  }
  
  if (options.foldingFunction && !options.periodMs) {
    throw new Error('periodMs must be provided when using a custom foldingFunction');
  }
  
  // Determine the folding function and periodMs
  let foldingFunction: (date: Date) => number;
  let periodMs: number | ((d: Date) => number);
  
  if (options.binSize) {
    // Use binSize path
    foldingFunction = (date: Date) => getFoldedPhase(date, options.binSize!, false);
    const binDurationValue = binDurationMs.get(options.binSize)!;
    periodMs = typeof binDurationValue === 'function' ? binDurationValue : () => binDurationValue;
  } else {
    // Use custom function path (we know these exist from validation)
    foldingFunction = options.foldingFunction!;
    periodMs = options.periodMs!;
  }
  
  
  const justReturnData = 
    x.length === 0 
    || y.length === 0 
    || x.length !== y.length;
  
  if (justReturnData) {
    throw new Error('Please provide valid data and options to fold the data');
  }
  
  // if we aren't binning, we need to at least fake folding
  // so we just convert this to phase
  if (options.binSize === 'none') {
    console.log('[timeSeriesFolder] foldOptions.binSize=none - returning original data');
    const minX = arrayMin(x)!;
    return {
      x: x.map(v => v - minX),
      xOriginal: x,
      y: y,
      e: e,
      periodMs: arrayMax(x)! - minX,
      epochStart: minX,
      isVariablePeriod: false,  
      foldedBy: 'none',
    };
  }
  
  // Fold each timestamp and calculate period durations if variable
  const phase: number[] = [];
  const periodMsArray: number[] = [];
  const isVariablePeriod = typeof periodMs === 'function';
  
  const earliestTimestamp = arrayMin(x)!;
  const epochStartDate = timezone ? toZonedTime(new Date(earliestTimestamp), timezone) : new Date(earliestTimestamp);
  const flooredEpochDate = applyFloorFunctions(epochStartDate, options.binSize as BinSizes);
  const epochStart = flooredEpochDate.getTime();
  
  // fold each timestamp
  x.forEach((timestamp, idx) => {
    const date = timezone ? toZonedTime(timestamp, timezone) : new Date(timestamp);
    const folded = foldingFunction(date); 
    
    phase.push(folded);
    
    // Store actual period duration for this point if variable
    if (isVariablePeriod) {
      periodMsArray.push(_run_value_or_funcion(periodMs, date)!);
    }
    
  });
  
  return {
    x: phase,
    xOriginal: x,
    y: y,
    e: e,
    periodMs: periodMs,
    periodMsArray: isVariablePeriod ? periodMsArray : undefined,
    isVariablePeriod: isVariablePeriod,
    epochStart: epochStart,
    foldedBy: options.binSize || 'none',
  };
}

import { timeSeriesBinner } from "./binData";

/**
 * Fold time series data and bin the result
 * 
 * This function first folds the data onto a repeating period, then bins within that fold.
 * The key insight: we add epochStart to folded x values to create valid timestamps for binning,
 * then subtract it back out to get relative time values that match the folded data.
 * 
 * Example: Folding a year by 'day' and binning by 'hour'
 * 1. Fold creates x values as milliseconds within a day (0 to 86400000)
 * 2. epochStart is the floored earliest timestamp (e.g., Jan 1 2024 00:00:00)
 * 3. x + epochStart creates valid dates (Jan 1 00:00:00, Jan 1 00:05:00, etc.)
 * 4. timeSeriesBinner bins these by hour (grouping all same-hour values)
 * 5. Subtract epochStart to get back to milliseconds within day (0, 3600000, etc.)
 * 
 */
export function timeseriesFoldAndBin(
  x: number[], 
  y: (number | null)[], 
  e: (number | null)[] = [],
  timezone: string,
  foldOptions: FoldOptions,
  binsize: BinSizes,
  aggFunc: 'mean' | 'median' | 'min' | 'max' | 'sum',
  errorFunc: 'standardError' | 'stdev' | 'mad',
): Prettify<FoldedData> {
  
  const foldedData = timeSeriesFolder(
    x, y, e, timezone,
    foldOptions,
  );
  
  if (foldedData.x.length === 0) {
    return foldedData;
  }
  
  if (binsize === 'none') {
    return foldedData;
  }
  
  // Add epochStart to folded x values to create valid timestamps for binning
  const xForBinning = foldedData.x.map(v => foldedData.epochStart + v);

  // IMPORTANT: We must NOT apply timezone conversion again in the binner!
  // The folded x values were already calculated in the target timezone,
  // so epochStart + foldedX gives us timestamps that when interpreted as UTC
  // will bin correctly. Passing empty string '' for timezone prevents double conversion.
  const binned = timeSeriesBinner(
    xForBinning, 
    foldedData.y, 
    foldedData.e, 
    '', // Empty timezone - don't apply conversion, timestamps are already correct
    binsize,
    aggFunc,
    errorFunc,
    false
  );

  // Subtract epochStart from binned x values to get back to relative time
  const adjustedX = binned.x.map(v => (v as number) - foldedData.epochStart);
  
  (foldedData as FoldedData).aggregated = {
    x: adjustedX,
    y: binned.y,
    e: binned.e,
    binSize: binned.binSize,
    binAssignments: binned.binAssignments
  };
  
  return foldedData;
} 


