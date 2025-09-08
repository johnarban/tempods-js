<template>
  <div ref="chartContainer" class="aggregation-chart">
    <div v-if="loading" class="chart-loading">
      <v-progress-circular indeterminate color="primary" />
      <div class="text-caption mt-2">Rendering chart...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { newPlot, restyle, type Data, type Layout, type PlotlyHTMLElement } from 'plotly.js-dist-min';
import type { AggregatedResult } from '../../types/aggregation';

const props = defineProps<{
  results: AggregatedResult;
  showErrorBars: boolean;
  chartType: 'line' | 'bar' | 'scatter';
}>();

const emit = defineEmits<{
  'point-click': [group: any];
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const plotElement = ref<PlotlyHTMLElement | null>(null);

async function renderChart() {
  if (!chartContainer.value || props.results.groups.length === 0) return;
  
  loading.value = true;
  
  try {
    const data = createPlotlyData();
    const layout = createPlotlyLayout();
    
    const plot = await newPlot(chartContainer.value, data, layout, {
      responsive: true,
      displayModeBar: false
    });
    
    plotElement.value = plot;
    
    // Add click handler
    plot.on('plotly_click', (eventData) => {
      if (eventData.points.length > 0) {
        const pointIndex = eventData.points[0].pointIndex;
        const group = props.results.groups[pointIndex];
        emit('point-click', group);
      }
    });
    
  } catch (error) {
    console.error('Error rendering chart:', error);
  } finally {
    loading.value = false;
  }
}

function createPlotlyData(): Data[] {
  const groups = props.results.groups;
  const timestamps = groups.map(g => new Date(g.timestamp));
  const values = groups.map(g => g.value);
  const errors = groups.map(g => g.error.upper);
  
  const baseTrace: Partial<Data> = {
    x: timestamps,
    y: values,
    name: props.results.metadata.pattern.name,
    hovertemplate: '<b>%{text}</b><br>' +
                   'Value: %{y:.2e}<br>' +
                   'Sample Size: %{customdata}<br>' +
                   '<extra></extra>',
    text: groups.map(g => g.label),
    customdata: groups.map(g => g.sampleSize)
  };

  const traces: Data[] = [];

  switch (props.chartType) {
    case 'line':
      traces.push({
        ...baseTrace,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1976d2', width: 2 },
        marker: { size: 6, color: '#1976d2' }
      });
      break;
      
    case 'bar':
      traces.push({
        ...baseTrace,
        type: 'bar',
        marker: { color: '#1976d2', opacity: 0.8 }
      });
      break;
      
    case 'scatter':
      traces.push({
        ...baseTrace,
        type: 'scatter',
        mode: 'markers',
        marker: { 
          size: groups.map(g => Math.max(6, Math.min(20, g.sampleSize / 2))),
          color: '#1976d2',
          opacity: 0.7
        }
      });
      break;
  }

  // Add error bars if enabled
  if (props.showErrorBars && props.chartType !== 'bar') {
    const mainTrace = traces[0];
    if (mainTrace) {
      mainTrace.error_y = {
        type: 'data',
        array: errors,
        visible: true,
        color: '#666',
        thickness: 1,
        width: 3
      };
    }
  }

  return traces;
}

function createPlotlyLayout(): Partial<Layout> {
  const pattern = props.results.metadata.pattern;
  
  return {
    title: {
      text: `${pattern.name} - ${pattern.aggregationMethod.toUpperCase()} by ${pattern.aggregationPeriod}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'Date',
      type: 'date'
    },
    yaxis: {
      title: `${pattern.aggregationMethod.toUpperCase()} Value (molecules/cm²)`,
      type: 'log',
      exponentformat: 'e'
    },
    margin: { t: 60, r: 40, b: 60, l: 80 },
    hovermode: 'closest',
    showlegend: false,
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)'
  };
}

function exportResults() {
  const csvData = convertToCSV();
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aggregation_results_${props.results.metadata.pattern.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function convertToCSV(): string {
  const headers = [
    'Group Label',
    'Timestamp',
    'Date',
    'Value',
    'Error Lower',
    'Error Upper',
    'Sample Size',
    'Start Date',
    'End Date'
  ];
  
  const rows = props.results.groups.map(group => [
    group.label,
    group.timestamp,
    new Date(group.timestamp).toISOString(),
    group.value?.toString() || 'null',
    group.error.lower?.toString() || 'null',
    group.error.upper?.toString() || 'null',
    group.sampleSize,
    new Date(group.dateRange.start).toISOString(),
    new Date(group.dateRange.end).toISOString()
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

// Computed
const compressionRatio = computed(() => {
  if (props.results.metadata.totalInputPoints === 0) return 0;
  return Math.round((1 - props.results.metadata.totalOutputPoints / props.results.metadata.totalInputPoints) * 100);
});

const averageSampleSize = computed(() => {
  if (props.results.groups.length === 0) return 0;
  const total = props.results.groups.reduce((sum, group) => sum + group.sampleSize, 0);
  return Math.round(total / props.results.groups.length);
});

const enabledDaysCount = computed(() => 
  props.results.metadata.pattern.selectedDays.filter(day => day.enabled).length
);

const enabledHoursCount = computed(() => 
  props.results.metadata.pattern.selectedHours.filter(hour => hour.enabled).length
);

// Lifecycle
onMounted(() => {
  nextTick(() => {
    renderChart();
  });
});

// Watchers
watch([() => props.chartType, () => props.showErrorBars], () => {
  renderChart();
});

watch(() => props.results, () => {
  renderChart();
}, { deep: true });
</script>

<style scoped>
.aggregation-chart {
  min-height: 400px;
  position: relative;
}

.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.results-summary .v-card {
  min-height: 80px;
}

.pattern-info {
  background: rgba(var(--v-theme-primary), 0.05);
}

.visualization-section {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 16px;
}

.chart-controls {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 12px;
}
</style>