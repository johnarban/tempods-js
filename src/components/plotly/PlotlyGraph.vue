<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<template>
  <div
    ref="graph"
    :id="id"
    class="timeseries"
  >
  </div>
</template>


<script setup lang="ts">
/* slint-disable @typescript-eslint/no-unused-vars */
import { onMounted, ref, watch, nextTick } from "vue";
import { v4 } from "uuid";
import Plotly, { PlotlyHTMLElement, newPlot, restyle, type Data, type Datum, type PlotMouseEvent } from "plotly.js-dist-min";
import type { PlotltGraphDataSet } from '../../types';
import { createErrorBands } from "./plotly_graph_elements";

// https://stackoverflow.com/a/7616484
const generateHash = (string) => {
  let hash = 0;
  for (const char of string) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0; // Constrain to 32bit integer
  }
  return hash;
};

const hashDataset = (data: PlotltGraphDataSet) => {
  const hash = JSON.stringify(data.x) + JSON.stringify(data.y); 
  //JSON.stringify(data.lower) + JSON.stringify(data.upper); // + JSON.stringify(data.errorType);
  return generateHash(hash).toString();
};

export interface PlotlyGraphProps {
  datasets: PlotltGraphDataSet[];
  colors?: string[];
  showErrors?: boolean;
  dataOptions?: Partial<Data>[];
  errorBarStyles?: (Partial<Plotly.ErrorOptions> | null)[];
  names?: string[];
  layoutOptions?: Partial<Plotly.Layout>;
  configOptions?: Partial<Plotly.Config>;
}

const props = defineProps<PlotlyGraphProps>();

const id = `timeseries-${v4()}`;

const plot = ref<PlotlyHTMLElement | null>(null);
const graph = ref<HTMLDivElement | null>(null);

const emit = defineEmits<{
  // Datum is from type of x in DataSet
  (event: "click", value: {x: Datum, y: number, customdata: unknown}): void;
}>();

function datumToDate(datum: Datum): Date | null {
  if (datum === null) { return null; }
  if (datum instanceof Date) { return datum; }
  return new Date(datum);
}

const legendGroups: Record<string, string> = {};
let errorTraces: number[] = [];
const traceVisible = ref<Map<string, boolean>>(new Map());


const filterNulls = ref(true);  
function filterNullValues(data: PlotltGraphDataSet): PlotltGraphDataSet {
  // filter out any place where
  // data.x or data.y is null or undefined or NaN
  if (!data.x || !data.y) {
    return data;
  }
  const filteredX: Datum[] = [];
  const filteredY: number[] = [];
  const filteredLower: (number | null)[] = [];
  const filteredUpper: (number | null)[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredCustomData: any[] = [];
  data.x.forEach((x, idx) => {
    const y = data.y[idx];
    if (x !== null && x !== undefined && y !== null && y !== undefined && !isNaN(y)) {
      filteredX.push(x);
      filteredY.push(y);
      filteredCustomData.push(data.datasetOptions?.customdata ? data.datasetOptions.customdata[idx] : null);
      if (data.lower) {
        filteredLower.push(data.lower[idx] ?? null); // keep length consistent 
      }
      if (data.upper) {
        filteredUpper.push(data.upper[idx] ?? null); // keep length consistent 
      }
    }
  });
  const result: PlotltGraphDataSet = {
    ...data,
    datasetOptions: {
      ...data.datasetOptions,
      customdata: filteredCustomData,
    },
    x: filteredX,
    y: filteredY,
    name: data.name
  };
  if (data.lower) {
    result.lower = filteredLower;
  } 
  if (data.upper) {
    result.upper = filteredUpper;
  }
  result.errorType = data.errorType;
  
  return result;
}

function renderPlot() {

  errorTraces = [];
  
  const plotlyData: Data[] = [];
  if (props.datasets.length === 0) {
    console.error("No data provided for timeseries graph");
    return;
  }
  

  let max = 0;
  
  props.datasets.forEach((data, index) => {
    // create a hash from the data.x and data.y to be it's "id"
    data = filterNulls.value ? filterNullValues(data) : data;
    
    // check x, and have same length y
    if (!data.x || !data.y || data.x.length !== data.y.length) {
      console.error("Invalid dataset, skipping", data);
      return;
      // throw new Error(`Invalid dataset: x and y must be non-null and of same length. Lengths: x=${data.x?.length}, y=${data.y?.length}`);
    }
    
    const id = hashDataset(data);
    
    max = Math.max(max, Math.max(...data.y.filter((v): v is number => v !== null)));

    const legendGroup = v4();
    if (!traceVisible.value.has(id)) {
      traceVisible.value.set(id, true);
    }
    legendGroups[id] = legendGroup;
    
    
    const errorOptions = {} as Record<'error_y',Plotly.ErrorBar>;
    // https://plotly.com/javascript/error-bars/
    if (props.showErrors && data.errorType === 'bar') {
      const style = (props.errorBarStyles && props.errorBarStyles[index]) || {};
      errorOptions['error_y'] = {
        type: 'data',
        symmetric: false,
        array: data.upper as Datum[],
        arrayminus: data.lower as Datum[] | undefined,
        color: props.colors ? props.colors[index % props.colors.length] : 'red',

        thickness: 1.5,
        width: 0,
        ...style,
      };
      
    }
    const datasetName = data.name || props.names?.[index] || `Dataset ${index + 1}`;
    const dataTraceOptions = {
      mode: "lines+markers",
      legendgroup: legendGroup,
      showlegend: true,
      name: datasetName,
      marker: { color: props.colors ? props.colors[index % props.colors.length] : 'red' },
      visible: traceVisible.value.get(id) ? true : "legendonly",
      ...errorOptions,
      ...props.dataOptions?.[index],
      ...(data.datasetOptions ?? {}), // allow per-dataset options override
    };

    plotlyData.push({
      x: data.x,
      y: data.y,
      ...dataTraceOptions
    } as Data);
    
    const hasErrors = data.lower && data.upper && data.lower.length === data.y.length && data.upper.length === data.y.length;
    // double checking to have valid types
    if (hasErrors && data.lower && data.upper && data.errorType == 'band' && props.showErrors) {
      
      const {lower, upper, max: newMax} = createErrorBands(
        data,
        props.colors ? props.colors[index % props.colors.length] : 'red',
        datasetName,
        legendGroup,
      );

      max = Math.max(max, newMax);

      if (lower === null || upper === null) {
        console.error("Error creating error bands for dataset", index, data);
        return;
      }
      
      const errorBandsVisible = traceVisible.value.get(id) ? true : "legendonly";
      lower['visible'] = errorBandsVisible;
      upper['visible'] = errorBandsVisible;
      
      plotlyData.push(lower);
      errorTraces.push(plotlyData.length - 1);

      plotlyData.push(upper);
      errorTraces.push(plotlyData.length - 1);
    }
  });

  const paddingFactor = 1.1;
  const axisMax = Math.max(1, paddingFactor * max);
  const layout: Partial<Plotly.Layout> = {
    yaxis: {
      title: { text: "Molecules / cm<sup>2</sup>" },
      range: [0, axisMax],
    },
    ...(props.layoutOptions || {}),
  };

  newPlot(graph.value ?? id, plotlyData, layout, {...props.configOptions}).then((el: PlotlyHTMLElement) => {
    plot.value = el;
    el.on("plotly_click", (data: PlotMouseEvent) => {
      console.log("plotly_click event fired", data);
      data.points.forEach(point => {
        console.log("Processing point:", { 
          curveNumber: point.curveNumber, 
          x: point.x, 
          y: point.y,
          customdata: point.customdata,
          isErrorTrace: errorTraces.includes(point.curveNumber)
        });
        
        // Skip error traces (upper/lower bands) but allow clicks on all data traces
        const traceIndex = point.curveNumber;
        const isErrorTrace = errorTraces.includes(traceIndex);
        if (isErrorTrace || point.x == null || point.y == null) {
          console.log("Skipping point - errorTrace:", isErrorTrace, "x null:", point.x == null, "y null:", point.y == null);
          return;
        }
        const date = datumToDate(point.x);
        console.log("Emitting click event with:", {x: point.x, y: point.y, customdata: point.customdata, date});
        emit("click", {x: point.x, y: point.y as number, customdata: point.customdata} );
      });
    });
    el.on('plotly_legendclick', (data) => {
      const trace = plotlyData[data.curveNumber];
      if (!trace) { 
        console.error("No trace for legend click", data);
        return true; 
      }
      // eslint-disable-next-line 
      // @ts-ignore legend group should exist. but guard anyway
      const group = trace.legendgroup as string;
      if (!group) { 
        console.error("No legend group for trace", trace);
        return true; 
      }
      const dataId = Object.keys(legendGroups).find(key => legendGroups[key] === group);
      if (!dataId) { 
        console.error("Could not find data ID for legend group", group);
        return true; 
      }
      const currentlyVisible = traceVisible.value.get(dataId) ?? true;
      traceVisible.value.set(dataId, !currentlyVisible);
      // if currently visible and errors are visible set stlye the error traces too
      nextTick(() => { // next tick so that updated traceVisible is available
        if (props.showErrors) {
          updateErrorDisplay(!currentlyVisible, group);
        }
      });
      return true;
    });
  });
}

function updateErrorDisplay(visible: boolean, legendGroup?: string) {
  if (graph.value) {
    errorTraces.forEach((traceIndex) => {
      const trace = plot.value?.data[traceIndex];
      if (!trace) return;
      if (!graph.value) return;
      // eslint-disable-next-line 
      // @ts-ignore legend group should exist. but guard anyway
      const group = trace.legendgroup as string;
      if (group === undefined) return;
      if (legendGroup && group !== legendGroup) return;
      const dataId = Object.keys(legendGroups).find(key => legendGroups[key] === group);
      if (dataId && traceVisible.value.get(dataId)) {
        restyle(graph.value, { visible: visible ? true : "legendonly" }, [traceIndex]);
      } 
    });
  }
}


onMounted(() => {
  renderPlot();
});


watch(() => props.showErrors, renderPlot);

watch(() => props.datasets, (_newData, _oldData) => {
  console.log("Data prop changed, re-rendering plot");
  renderPlot();
}, { deep: true });

</script>

<style scoped>
.js-plotly-plot  {
  min-width: 30px;
}

</style>
