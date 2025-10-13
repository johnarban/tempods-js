/* eslint-disable indent */
/* eslint-disable @typescript-eslint/no-unused-vars */
/** A set of generic routines for aggregating data that comes from 
 * our Tempo Data Serivce
*/
    
import type { Prettify } from "@/types";
import {  toZonedTime } from 'date-fns-tz';
import { aggregateData } from "@/utils/array_operations/aggregator";
import { BinSizes, applyFloorFunctions } from '../calendar_utils';

export interface ResampledData {
  x: (number)[]; 
  y: number[];
  e?: (number | null)[];
  binSize: BinSizes;
  binAssignments: number[];
}


/**
 * TimeSeriesBinner function
 * 
 * Resample the time series data into specified time bins, applying aggregation and error functions.
 * 
 * Inputs:
 * 
 * @param x: number[] - array of timestamps (in ms since epoch)
 * @param y: (number | null)[] - array of data values (can include nulls)
 * @param e?: (number | null)[] - array of error values (can include nulls) [optional]
 * @param timezone?: string - IANA timezone string (e.g. "America/New_York") [optional]
 * @param binSize: BinSizes - size of the bin (e.g. 'day', 'week', etc.)
 * @param aggFunc: mean | median | min | max | sum | rms - aggregation function to apply to each bin
 * @param errorFunc: standardError | stdev | mad - function to calculate error for each bin
 * 
 * Outputs:
 * 
 * @returns ResampledData - object containing resampled timestamps, values, and bin identifiers
 */
export function timeSeriesBinner(
  x: number[], 
  y: (number | null)[], 
  e: (number | null)[] = [], 
  timezone: string,
  binSize: BinSizes,
  aggFunc: 'mean' | 'median' | 'min' | 'max' | 'sum',
  errorFunc: 'standardError' | 'stdev' | 'mad',
  sorted: boolean = true,
): Prettify<ResampledData> {
  
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return {
      x: [],
      y: [],
      e: [],
      binSize,
      binAssignments: [],
    };
  }
  
  // clean x, y, e
  
  // if we aren't binning, just clean the data and return that
  if (binSize === 'none') {
    const cleanedData = x.map((val, idx) => ({ x: val, y: y[idx], e: e ? e[idx] : null }))
    .filter(d => d.y !== null)
    .sort((a, b) => a.x - b.x);
    
    const size = cleanedData.length;
  
    // const cleanedX = cleanedData.map(d => d.x);
    // const cleanedY = cleanedData.map(d => d.y as number);
    // const cleanedE = cleanedData.map(d => d.e);
    const { cleanedX, cleanedY, cleanedE } = cleanedData.reduce((acc, d, idx) => {
        // We can confidently assert d.y as number since it passed the filter step
        acc.cleanedX[idx] = d.x;
        acc.cleanedY[idx] = d.y!; 
        acc.cleanedE[idx] = d.e;
        return acc;
    }, { cleanedX: Array(size) as number[], cleanedY: Array(size) as number[], cleanedE: Array(size) as (number | null)[] });
    return {
      x: cleanedX,
      y: cleanedY,
      e: cleanedE,
      binSize,
      binAssignments: cleanedX,
    };
  }
  
  // Create a map to hold resampled data
  const resampledMap: Map<number, { yValues: number[]; eValues: number[] }> = new Map();
  
  const binnedTimestamps: number[] = x.map(timestamp => {
    const zonedDate = timezone ? toZonedTime(timestamp, timezone) : new Date(timestamp);
    const binDate: Date = applyFloorFunctions(zonedDate, binSize);
    return binDate.getTime();
  });
  
  binnedTimestamps.forEach((binTime, index) => {
    const yValue = y[index];
    const eValue = e ? e[index] : null;
    if (yValue !== null) {
      if (!resampledMap.has(binTime)) {
        resampledMap.set(binTime, { yValues: [], eValues: [] });
      }
      const mapEntry = resampledMap.get(binTime)!;
      mapEntry.yValues.push(yValue);
      if (eValue !== null) {
        mapEntry.eValues.push(eValue);
      }
    }
  });  
  
  let sortedBins: [number, { yValues: number[]; eValues: number[] }][];
  if (!sorted) {
    sortedBins = Array.from(resampledMap.entries()).sort((a, b) => a[0] - b[0]);
  } else {
    sortedBins = Array.from(resampledMap.entries());
  }
  
  const resampledX: ResampledData['x'] = [];
  const resampledY: ResampledData['y'] = [];
  const resampledE: ResampledData['e'] = [];
  const binTimestampToIndex = new Map<number, number>();
  
  sortedBins.forEach(([bin, data]) => {
    if (data.yValues.length === 0) return;
    
    const aggResult = aggregateData(
      data.yValues, 
      data.eValues.length > 0 ? data.eValues : undefined, 
      aggFunc, 
      errorFunc
    );
    
    if (aggResult.value !== null) {
      const outputIndex = resampledX.length;
      binTimestampToIndex.set(bin, outputIndex);
      resampledX.push(bin);
      resampledY.push(aggResult.value);
      resampledE.push(aggResult.error);
    }
  });

  const binAssignments = binnedTimestamps.map(ts => binTimestampToIndex.get(ts) ?? -1);

  return {
    x: resampledX,
    y: resampledY,
    e: resampledE,
    binSize,
    binAssignments
  };
}