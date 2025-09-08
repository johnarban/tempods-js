import { ref } from 'vue';
import type { 
  AggregationPattern, 
  AggregationPreview,
  AggregatedResult,
  SavedAggregationPattern,
  AggregationGroup,
  AggregationResultGroup,
  MillisecondRange
} from '../types/aggregation';

export function useFlexibleAggregation() {
  const savedPatterns = ref<SavedAggregationPattern[]>([]);

  /**
   * Generate preview of what data points will be selected and how they'll be aggregated
   */
  async function generatePreview(
    pattern: AggregationPattern,
    availableTimestamps: number[]
  ): Promise<AggregationPreview> {
    const selectedTimestamps = selectTimestamps(pattern, availableTimestamps);
    const aggregationGroups = createAggregationGroups(selectedTimestamps, pattern);
    
    return {
      selectedTimestamps,
      totalDataPoints: selectedTimestamps.length,
      aggregationGroups,
      estimatedOutputSize: aggregationGroups.length
    };
  }

  /**
   * Execute the actual aggregation with real data
   */
  async function executeAggregation(
    pattern: AggregationPattern,
    preview: AggregationPreview,
    region: any // Current region for data fetching
  ): Promise<AggregatedResult> {
    // This would integrate with the existing ESRI data fetching system
    const groups: AggregationResultGroup[] = [];
    
    for (const previewGroup of preview.aggregationGroups) {
      // Fetch data for this group's timestamps
      const groupData = await fetchDataForTimestamps(
        region,
        previewGroup.timestamps,
        pattern
      );
      
      // Apply aggregation method
      const aggregatedValue = applyAggregationMethod(
        groupData.values,
        pattern.aggregationMethod
      );
      
      groups.push({
        id: previewGroup.id,
        label: previewGroup.label,
        timestamp: Math.floor((previewGroup.startTime + previewGroup.endTime) / 2),
        value: aggregatedValue.value,
        error: aggregatedValue.error,
        sampleSize: groupData.values.length,
        rawValues: groupData.values,
        dateRange: {
          start: previewGroup.startTime,
          end: previewGroup.endTime
        }
      });
    }

    return {
      groups,
      metadata: {
        pattern,
        totalInputPoints: preview.totalDataPoints,
        totalOutputPoints: groups.length,
        aggregationDate: new Date()
      }
    };
  }

  /**
   * Select timestamps based on pattern criteria
   */
  function selectTimestamps(
    pattern: AggregationPattern,
    availableTimestamps: number[]
  ): number[] {
    const enabledDays = pattern.selectedDays
      .filter(day => day.enabled)
      .map(day => day.dayIndex);
    
    const enabledHours = pattern.selectedHours
      .filter(hour => hour.enabled)
      .map(hour => ({ hour: hour.hour, minute: hour.minute }));

    const startTime = pattern.dateRange.start.getTime();
    const endTime = pattern.dateRange.end.getTime();

    return availableTimestamps.filter(timestamp => {
      // Check if timestamp is within date range
      if (timestamp < startTime || timestamp > endTime) {
        return false;
      }

      const date = new Date(timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const minute = date.getMinutes();

      // Check if day of week is enabled
      if (!enabledDays.includes(dayOfWeek)) {
        return false;
      }

      // Check if hour/minute combination is enabled
      return enabledHours.some(timeSlot => 
        timeSlot.hour === hour && timeSlot.minute === minute
      );
    });
  }

  /**
   * Create aggregation groups based on the aggregation period
   */
  function createAggregationGroups(
    timestamps: number[],
    pattern: AggregationPattern
  ): AggregationGroup[] {
    if (pattern.aggregationPeriod === 'none') {
      // No grouping - each timestamp is its own group
      return timestamps.map((timestamp, index) => ({
        id: `group-${index}`,
        label: new Date(timestamp).toLocaleDateString(),
        startTime: timestamp,
        endTime: timestamp,
        timestamps: [timestamp],
        dataPointCount: 1
      }));
    }

    const groups: AggregationGroup[] = [];
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    
    let currentGroupStart = sortedTimestamps[0];
    let currentGroupTimestamps: number[] = [];
    
    for (const timestamp of sortedTimestamps) {
      const groupPeriodEnd = getGroupPeriodEnd(currentGroupStart, pattern.aggregationPeriod);
      
      if (timestamp <= groupPeriodEnd) {
        currentGroupTimestamps.push(timestamp);
      } else {
        // Finalize current group
        if (currentGroupTimestamps.length > 0) {
          groups.push({
            id: `group-${groups.length}`,
            label: getGroupLabel(currentGroupStart, groupPeriodEnd, pattern.aggregationPeriod),
            startTime: currentGroupStart,
            endTime: groupPeriodEnd,
            timestamps: [...currentGroupTimestamps],
            dataPointCount: currentGroupTimestamps.length
          });
        }
        
        // Start new group
        currentGroupStart = timestamp;
        currentGroupTimestamps = [timestamp];
      }
    }
    
    // Add final group
    if (currentGroupTimestamps.length > 0) {
      const groupPeriodEnd = getGroupPeriodEnd(currentGroupStart, pattern.aggregationPeriod);
      groups.push({
        id: `group-${groups.length}`,
        label: getGroupLabel(currentGroupStart, groupPeriodEnd, pattern.aggregationPeriod),
        startTime: currentGroupStart,
        endTime: groupPeriodEnd,
        timestamps: currentGroupTimestamps,
        dataPointCount: currentGroupTimestamps.length
      });
    }

    return groups;
  }

  /**
   * Get the end time for a group period
   */
  function getGroupPeriodEnd(startTime: number, period: string): number {
    const startDate = new Date(startTime);
    
    switch (period) {
      case 'daily':
        return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).getTime() - 1;
      case 'weekly':
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
        return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).getTime() - 1;
      case 'biweekly':
        const biweekStart = new Date(startDate);
        biweekStart.setDate(startDate.getDate() - startDate.getDay());
        return new Date(biweekStart.getTime() + 14 * 24 * 60 * 60 * 1000).getTime() - 1;
      case 'monthly':
        return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      case 'quarterly':
        const quarter = Math.floor(startDate.getMonth() / 3);
        return new Date(startDate.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999).getTime();
      default:
        return startTime;
    }
  }

  /**
   * Generate a label for an aggregation group
   */
  function getGroupLabel(startTime: number, endTime: number, period: string): string {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    switch (period) {
      case 'daily':
        return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'weekly':
        return `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'biweekly':
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'monthly':
        return startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      case 'quarterly':
        const quarter = Math.floor(startDate.getMonth() / 3) + 1;
        return `Q${quarter} ${startDate.getFullYear()}`;
      default:
        return startDate.toLocaleDateString();
    }
  }

  /**
   * Fetch data for specific timestamps (integrates with existing ESRI system)
   */
  async function fetchDataForTimestamps(
    region: any,
    timestamps: number[],
    _pattern: AggregationPattern
  ): Promise<{ values: number[]; errors: number[] }> {
    // This would integrate with the existing TempoDataService
    // For now, return mock data
    const values = timestamps.map(() => Math.random() * 1000000 + region?.id ? 100000 : 0);
    const errors = values.map(v => v * 0.1);
    
    return { values, errors };
  }

  /**
   * Apply aggregation method to a set of values
   */
  function applyAggregationMethod(
    values: number[],
    method: string
  ): { value: number | null; error: { lower: number | null; upper: number | null } } {
    if (values.length === 0) {
      return { value: null, error: { lower: null, upper: null } };
    }

    const validValues = values.filter(v => v !== null && !isNaN(v));
    if (validValues.length === 0) {
      return { value: null, error: { lower: null, upper: null } };
    }

    let result: number;
    switch (method) {
      case 'mean':
        result = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
        break;
      case 'median':
        const sorted = [...validValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
        break;
      case 'sum':
        result = validValues.reduce((sum, val) => sum + val, 0);
        break;
      case 'min':
        result = Math.min(...validValues);
        break;
      case 'max':
        result = Math.max(...validValues);
        break;
      case 'count':
        result = validValues.length;
        break;
      default:
        result = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    }

    // Calculate standard error
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
    const standardError = Math.sqrt(variance / validValues.length);

    return {
      value: result,
      error: {
        lower: standardError,
        upper: standardError
      }
    };
  }

  /**
   * Validate that a pattern has the minimum required selections
   */
  function validatePattern(pattern: AggregationPattern): boolean {
    const hasDays = pattern.selectedDays.some(day => day.enabled);
    const hasHours = pattern.selectedHours.some(hour => hour.enabled);
    const hasValidDateRange = pattern.dateRange.start < pattern.dateRange.end;
    const hasName = pattern.name.trim().length > 0;
    
    return hasDays && hasHours && hasValidDateRange && hasName;
  }

  /**
   * Save pattern to local storage or backend
   */
  async function savePattern(pattern: AggregationPattern): Promise<void> {
    const savedPattern: SavedAggregationPattern = {
      pattern: { ...pattern, modified: new Date() },
      isFavorite: false,
      usageCount: 0,
      lastUsed: new Date()
    };
    
    // Save to localStorage for now (could be replaced with backend storage)
    const existing = localStorage.getItem('aggregation-patterns');
    const patterns = existing ? JSON.parse(existing) : [];
    patterns.push(savedPattern);
    localStorage.setItem('aggregation-patterns', JSON.stringify(patterns));
    
    savedPatterns.value.push(savedPattern);
  }

  /**
   * Load saved patterns from storage
   */
  async function loadSavedPatterns(): Promise<SavedAggregationPattern[]> {
    try {
      const stored = localStorage.getItem('aggregation-patterns');
      if (stored) {
        const patterns = JSON.parse(stored);
        // Convert date strings back to Date objects
        return patterns.map((p: any) => ({
          ...p,
          pattern: {
            ...p.pattern,
            dateRange: {
              start: new Date(p.pattern.dateRange.start),
              end: new Date(p.pattern.dateRange.end)
            },
            created: new Date(p.pattern.created),
            modified: new Date(p.pattern.modified)
          },
          lastUsed: new Date(p.lastUsed)
        }));
      }
    } catch (error) {
      console.error('Error loading saved patterns:', error);
    }
    return [];
  }

  /**
   * Create default patterns for common use cases
   */
  function createDefaultPatterns(): AggregationPattern[] {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return [
      {
        id: 'weekday-business-hours',
        name: 'Weekday Business Hours',
        description: 'Monday-Friday, 9 AM to 5 PM, weekly aggregation',
        selectedDays: [
          { enabled: false, dayIndex: 0, dayName: 'Sunday' },
          { enabled: true, dayIndex: 1, dayName: 'Monday' },
          { enabled: true, dayIndex: 2, dayName: 'Tuesday' },
          { enabled: true, dayIndex: 3, dayName: 'Wednesday' },
          { enabled: true, dayIndex: 4, dayName: 'Thursday' },
          { enabled: true, dayIndex: 5, dayName: 'Friday' },
          { enabled: false, dayIndex: 6, dayName: 'Saturday' }
        ],
        selectedHours: Array.from({ length: 24 }, (_, hour) => ({
          enabled: hour >= 9 && hour <= 17,
          hour,
          minute: 0,
          displayTime: new Date(0, 0, 0, hour, 0).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true
          })
        })),
        dateRange: { start: thirtyDaysAgo, end: now },
        aggregationMethod: 'mean',
        aggregationPeriod: 'weekly',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created: now,
        modified: now
      },
      {
        id: 'rush-hour-pattern',
        name: 'Rush Hour Pattern',
        description: 'Weekdays during morning and evening rush hours',
        selectedDays: [
          { enabled: false, dayIndex: 0, dayName: 'Sunday' },
          { enabled: true, dayIndex: 1, dayName: 'Monday' },
          { enabled: true, dayIndex: 2, dayName: 'Tuesday' },
          { enabled: true, dayIndex: 3, dayName: 'Wednesday' },
          { enabled: true, dayIndex: 4, dayName: 'Thursday' },
          { enabled: true, dayIndex: 5, dayName: 'Friday' },
          { enabled: false, dayIndex: 6, dayName: 'Saturday' }
        ],
        selectedHours: Array.from({ length: 24 }, (_, hour) => ({
          enabled: (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19),
          hour,
          minute: 0,
          displayTime: new Date(0, 0, 0, hour, 0).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true
          })
        })),
        dateRange: { start: thirtyDaysAgo, end: now },
        aggregationMethod: 'mean',
        aggregationPeriod: 'weekly',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created: now,
        modified: now
      }
    ];
  }

  return {
    generatePreview,
    executeAggregation,
    savePattern,
    loadSavedPatterns,
    validatePattern,
    createDefaultPatterns,
    savedPatterns
  };
}