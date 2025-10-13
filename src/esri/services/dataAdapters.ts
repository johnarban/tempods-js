import type { UserDataset, PlotltGraphDataSet } from '@/types';
import type { ResampledData } from '../../utils/array_operations/binData';
import type { FoldedData } from '../../utils/array_operations/foldData';
import { type BinSizes, getBinSizeAsMs } from '../../utils/calendar_utils';


export function userDatasetToArrays(selection: UserDataset): {
  x: number[];
  y: (number | null)[];
  e: (number | null)[];
} {
  if (!selection.samples) {
    return { x: [], y: [], e: [] };
  }

  
  // Sort by timestamp to ensure chronological order
  // const sortedEntries = Object.entries(selection.samples)
  //   .sort(([tsA], [tsB]) => parseInt(tsA) - parseInt(tsB));
  // slightly faster for large arrays
  const keys = Object.keys(selection.samples);
  
  const sortedKeys = keys.sort((tsA, tsB) => +tsA - +tsB); 
  
  // with large arrays, pre-allocate to avoid dynamic resizing & copying
  const size = sortedKeys.length;
  const x: number[] = new Array(size);
  const y: (number | null)[] = new Array(size);
  const e: (number | null)[] = new Array(size);
  
  sortedKeys.forEach((timestamp, i) => {
    const ts = +timestamp;
    x[i] = ts;
    const aggValue = selection.samples![ts];
    y[i] = aggValue.value;
    
    // Extract error if available
    const error = selection.errors?.[ts];
    if (error) {
      // could do upper + lower / 2 for asymmetric errors, but ehhh...
      e[i] = error.upper ?? null;
    } else {
      e[i] = null;
    }
  });

  return { x, y, e };
}

/**
 * Helper class to convert data to Plotly format
 * Assumes errors are symmetric
 */
class PlotlyDatasetBuilder<T extends number | Date> {
  private _x: T[];
  private _y: (number | null)[];
  private _lower: (number | null)[];
  private _upper: (number | null)[];
  private errorType: 'bar' | 'band';
  private _size: number = 0;
  private _length: number = 0; // Track actual used length

  constructor(useErrorBars: boolean = false, size: number) {
    this.errorType = useErrorBars ? 'bar' : 'band';
    // Pre-allocate arrays with known size
    this._x = new Array(size);
    this._y = new Array(size);
    this._lower = new Array(size);
    this._upper = new Array(size);
    this._size = size;
  }

  addPoint(x: T, y: number | null, error?: number | null) {
    const index = this._length++;
    this._x[index] = x;
    this._y[index] = y;
    
    if (error !== null && error !== undefined && y !== null) {
      this._lower[index] = error;
      this._upper[index] = error;
    } else {
      this._lower[index] = null;
      this._upper[index] = null;
    }
  }

  build(): Omit<PlotltGraphDataSet, 'name'> {
    if (this._length === this._size) {
      return {
        x: this._x,
        y: this._y,
        lower: this._lower,
        upper: this._upper,
        errorType: this.errorType
      };
    }
    // Slice to actual used length
    return {
      x: this._x.slice(0, this._length),
      y: this._y.slice(0, this._length),
      lower: this._lower.slice(0, this._length),
      upper: this._upper.slice(0, this._length),
      errorType: this.errorType
    };
  }
  
  buildWithName(name: string): PlotltGraphDataSet {
    return {
      name,
      ...this.build()
    };
  }
}

/**
 * Convert ResampledData to Plotly format
 */
export function resampledDataToPlotly(
  data: ResampledData,
  name: string,
  useErrorBars: boolean = false
): PlotltGraphDataSet {
  const builder = new PlotlyDatasetBuilder(useErrorBars, data.y.length);
  
  data.y.forEach((y, idx) => {
    const x = data.x[idx] as number;
    const error = data.e?.[idx];
    builder.addPoint(x, y, error);
  });
  
  return builder.buildWithName(name);
}



/**
 * Convert FoldedData raw points to Plotly format
 * 
 * Handles two cases for x-axis values:
 * 1. includeBinPhase=true: Show phase distribution with fractional bin positions (vertical stripes)
 * 2. includeBinPhase=false: Collapse to bins using pre-computed bin positions from binAssignments
 * By default the folded data only phase folded and not binned. This is purely about display
 * Note: binAssignments is always present when we have aggregated.binSize (created by timeSeriesBinner)
 */

export function foldedDataRawToPlotly(
  data: FoldedData,
  name: string,
  alignToBinCenter: boolean = false,
  includeBinPhase: boolean = true
): PlotltGraphDataSet {
  const builder = new PlotlyDatasetBuilder(true, data.x.length); // Raw data always uses error bars
  
  const binForScaling = data.aggregated?.binSize || data.foldedBy;
  
  
  
  // if the data is not folded, then it is just binned 
  // so we just replicate resampledData but we need to 
  // adjust the x values to the correct epoch
  // (folding data removes the epoch offset)
  if (data.foldedBy === 'none') {
    data.x.forEach((x, idx) => {
      const y = data.y[idx];
      const error = data.e?.[idx];
      let xValue: number = x + data.epochStart;
      if (!includeBinPhase && data.aggregated) {
        const binTimestamp = data.aggregated.x[data.aggregated.binAssignments![idx]];
        xValue = binTimestamp + data.epochStart;
        if (alignToBinCenter) {
          xValue = xValue + 0.5;
        }
      }
      builder.addPoint(new Date(xValue), y, error);
    });
    return builder.buildWithName(name); // early return
  }
  // the data is folded
  data.x.forEach((phase, idx) => {
    const y = data.y[idx];
    const error = data.e?.[idx];
    
    let xValue: number;
    
    if (includeBinPhase || !data.aggregated) {
      // need to get for each point because of month/year length variability
      const norm = getBinSizeAsMs(binForScaling, new Date(data.xOriginal[idx])); 
      xValue = norm ? phase / norm : phase; // in units of the bin size
      // we don't `alignToBinCenter` if we are using bin phases
      // cuz then it would be phase + 0.5 which is weird
    } else {
      // Use the aggregated bin's phase value, scaled to bin units
      const binIndex = data.aggregated.binAssignments![idx];
      if (binIndex < 0) {
        console.error(`[foldedDataRawToPlotly] Invalid bin index ${binIndex} for point index ${idx}`);
        return; // frankly, my dear, there shouldn't be negative indices.
      }
      
      const binPhase = data.aggregated.x[binIndex];
      const norm = getBinSizeAsMs(binForScaling, new Date(data.xOriginal[idx]));
      xValue = norm ? binPhase / norm : binPhase;
      if (alignToBinCenter) {
        xValue = xValue + 0.5;
      }
    }
    
    builder.addPoint(xValue, y, error);
  });
  
  return builder.buildWithName(name);
}

/**
 * Convert FoldedData aggregated results to Plotly format
 * 
 * Aggregated/binned data shows the bins as they are (no automatic modulo).
 * The binSize parameter determines the unit (e.g., 'hour' means bin numbers are hours).
 */
export function foldedDataAggregatedToPlotly(
  data: FoldedData,
  name: string,
  alignToBinCenter: boolean = false,
  useErrorBars: boolean = false,
  binSize?: BinSizes
): PlotltGraphDataSet {
  if (!data.aggregated) {
    return {
      name,
      x: [],
      y: [],
      errorType: useErrorBars ? 'bar' : 'band'
    };
  }

  const builder = new PlotlyDatasetBuilder(useErrorBars, data.aggregated.y.length);
  
  if (data.foldedBy === 'none') {
    data.aggregated.x.forEach((x, idx) => {
      const y = data.aggregated!.y[idx];
      const error = data.aggregated!.e?.[idx];
      builder.addPoint(new Date(x + data.epochStart), y, error);
    });
    return builder.buildWithName(name);
  }
  
  const effectiveBinSize = binSize || data.aggregated.binSize;
  
  // Get a reference date for bin size calculation (use epochStart)
  const referenceDate = new Date(data.epochStart);
  
  data.aggregated.x.forEach((phase, idx) => {
    // Scale the phase to bin units (e.g., milliseconds -> hours)
    const norm = effectiveBinSize ? getBinSizeAsMs(effectiveBinSize, referenceDate) : 1;
    let xValue = norm ? phase / norm : phase;
    
    if (alignToBinCenter) {
      xValue = xValue + 0.5;
    }
    
    const y = data.aggregated!.y[idx];
    const error = data.aggregated!.e?.[idx];
    builder.addPoint(xValue, y, error);
  });
  
  return builder.buildWithName(name);
}

/**
 * Helper to get bin count for display purposes
 */
export function getFoldedDataPointCount(data: FoldedData | ResampledData | null): number {
  if (!data) return 0;
  
  // Check if it's FoldedData with aggregated results
  if ('aggregated' in data && data.aggregated) {
    return data.aggregated.x.length;
  }
  
  // Check if it's ResampledData or FoldedData without aggregation
  if ('x' in data) {
    return data.x.length;
  }
  
  return 0;
}
