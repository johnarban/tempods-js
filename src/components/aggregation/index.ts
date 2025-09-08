// Export all aggregation components for easy importing
export { default as FlexibleAggregationInterface } from './FlexibleAggregationInterface.vue';
export { default as AggregationPreview } from './AggregationPreview.vue';
export { default as AggregationResultsViewer } from './AggregationResultsViewer.vue';
export { default as AggregationWorkflow } from './AggregationWorkflow.vue';
export { default as AggregationHelpContent } from './AggregationHelpContent.vue';

// Export composable
export { useFlexibleAggregation } from '../../composables/useFlexibleAggregation';

// Export types
export type {
  AggregationPattern,
  AggregationPreviewType,
  AggregatedResult,
  SavedAggregationPattern,
  AggregationMethod,
  AggregationPeriod,
  DayOfWeekSelection,
  HourSelection,
  AggregationGroup,
  AggregationResultGroup
} from '../../types/aggregation';