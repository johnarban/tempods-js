export interface TimeSlot {
  hour: number;
  minute: number;
}

export interface DayOfWeekSelection {
  enabled: boolean;
  dayIndex: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
}

export interface HourSelection {
  enabled: boolean;
  hour: number;
  minute: number;
  displayTime: string;
}

export interface AggregationPattern {
  id: string;
  name: string;
  description: string;
  selectedDays: DayOfWeekSelection[];
  selectedHours: HourSelection[];
  dateRange: {
    start: Date;
    end: Date;
  };
  aggregationMethod: AggregationMethod;
  aggregationPeriod: AggregationPeriod;
  timezone: string;
  created: Date;
  modified: Date;
}

export type AggregationMethod = 'mean' | 'median' | 'sum' | 'min' | 'max' | 'count';

export type AggregationPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'none';

export interface AggregationPreviewType {
  selectedTimestamps: number[];
  totalDataPoints: number;
  aggregationGroups: AggregationGroup[];
  estimatedOutputSize: number;
}

export interface AggregationGroup {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  timestamps: number[];
  dataPointCount: number;
}

export interface AggregatedResult {
  groups: AggregationResultGroup[];
  metadata: {
    pattern: AggregationPattern;
    totalInputPoints: number;
    totalOutputPoints: number;
    aggregationDate: Date;
  };
}

export interface AggregationResultGroup {
  id: string;
  label: string;
  timestamp: number; // Representative timestamp for the group
  value: number | null;
  error: {
    lower: number | null;
    upper: number | null;
  };
  sampleSize: number;
  rawValues: number[];
  dateRange: {
    start: number;
    end: number;
  };
}

export interface SavedAggregationPattern {
  pattern: AggregationPattern;
  isFavorite: boolean;
  usageCount: number;
  lastUsed: Date;
}