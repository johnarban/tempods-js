<template>
  <div class="aggregation-help-content">
    <div class="help-section mb-4">
      <h4 class="text-h6 mb-3">🎯 What is Flexible Aggregation?</h4>
      <p>
        Flexible aggregation allows you to create custom time series by selecting specific 
        combinations of days and hours, then combining the data using various statistical methods.
      </p>
      <p>
        Instead of looking at all data points, you can focus on patterns like "weekday rush hours" 
        or "weekend afternoons" to answer specific research questions.
      </p>
    </div>

    <div class="help-section mb-4">
      <h4 class="text-h6 mb-3">🔧 How to Use</h4>
      <v-stepper density="compact" class="mb-3">
        <v-stepper-header>
          <v-stepper-item value="1" title="Select" />
          <v-divider />
          <v-stepper-item value="2" title="Preview" />
          <v-divider />
          <v-stepper-item value="3" title="Execute" />
        </v-stepper-header>
      </v-stepper>
      <ol>
        <li><strong>Select Days & Hours:</strong> Choose which days of the week and hours of the day to include</li>
        <li><strong>Choose Aggregation:</strong> Pick how to combine data (mean, median, max, etc.) and grouping period</li>
        <li><strong>Preview:</strong> Review what data points will be selected and how they'll be grouped</li>
        <li><strong>Execute:</strong> Run the aggregation and analyze results</li>
      </ol>
    </div>

    <div class="help-section mb-4">
      <h4 class="text-h6 mb-3">📊 Example Workflows</h4>
      
      <v-card class="example-workflow mb-3" variant="tonal">
        <v-card-title class="text-subtitle-1">Comparing Weekday vs Weekend Pollution</v-card-title>
        <v-card-text>
          <p><strong>Step 1:</strong> Create pattern for weekdays (Mon-Fri), all business hours</p>
          <p><strong>Step 2:</strong> Create separate pattern for weekends (Sat-Sun), same hours</p>
          <p><strong>Step 3:</strong> Use weekly aggregation with mean for both</p>
          <p><strong>Result:</strong> Two time series showing weekly averages for weekdays vs weekends</p>
        </v-card-text>
      </v-card>

      <v-card class="example-workflow mb-3" variant="tonal">
        <v-card-title class="text-subtitle-1">Tracking Peak Pollution Events</v-card-title>
        <v-card-text>
          <p><strong>Step 1:</strong> Select all days, all hours</p>
          <p><strong>Step 2:</strong> Use daily aggregation with maximum method</p>
          <p><strong>Result:</strong> Daily peak pollution values to identify extreme events</p>
        </v-card-text>
      </v-card>

      <v-card class="example-workflow" variant="tonal">
        <v-card-title class="text-subtitle-1">Monthly Trend Analysis</v-card-title>
        <v-card-text>
          <p><strong>Step 1:</strong> Select specific hours (e.g., 12 PM only for consistency)</p>
          <p><strong>Step 2:</strong> Include all days, use monthly aggregation with median</p>
          <p><strong>Result:</strong> Monthly median values showing long-term trends</p>
        </v-card-text>
      </v-card>
    </div>

    <div class="help-section">
      <h4 class="text-h6 mb-3">💡 Pro Tips</h4>
      <v-list density="compact">
        <v-list-item>
          <template #prepend>
            <v-icon color="success">mdi-check-circle</v-icon>
          </template>
          <v-list-item-title>Use the preview to verify your selection before executing</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <template #prepend>
            <v-icon color="success">mdi-check-circle</v-icon>
          </template>
          <v-list-item-title>Save frequently used patterns for quick access</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <template #prepend>
            <v-icon color="success">mdi-check-circle</v-icon>
          </template>
          <v-list-item-title>Consider your timezone when selecting hours</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <template #prepend>
            <v-icon color="success">mdi-check-circle</v-icon>
          </template>
          <v-list-item-title>Export results for further analysis in other tools</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <template #prepend>
            <v-icon color="warning">mdi-alert-circle</v-icon>
          </template>
          <v-list-item-title>Larger date ranges may take longer to process</v-list-item-title>
        </v-list-item>
      </v-list>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props or reactive data needed for static help content
</script>

<style scoped>
.aggregation-help-content {
  max-height: 500px;
  overflow-y: auto;
}

.help-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding-bottom: 16px;
}

.help-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.example-workflow {
  border-left: 4px solid var(--v-theme-primary);
}

.example-workflow .v-card-title {
  padding-bottom: 8px;
}

.example-workflow .v-card-text {
  padding-top: 0;
}
</style>