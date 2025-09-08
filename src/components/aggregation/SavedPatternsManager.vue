<template>
  <div class="saved-patterns-manager">
    <!-- Search and Filter -->
    <div class="mb-4">
      <v-text-field
        v-model="searchQuery"
        label="Search patterns..."
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        clearable
        class="mb-2"
      />
      <v-row>
        <v-col cols="6">
          <v-select
            v-model="sortBy"
            :items="sortOptions"
            label="Sort by"
            density="compact"
            variant="outlined"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            v-model="filterBy"
            :items="filterOptions"
            label="Filter by"
            density="compact"
            variant="outlined"
          />
        </v-col>
      </v-row>
    </div>

    <!-- Patterns List -->
    <div v-if="filteredPatterns.length === 0" class="text-center pa-6">
      <v-icon size="64" color="grey-darken-1" class="mb-3">
        mdi-folder-open-outline
      </v-icon>
      <div class="text-body-1 text-medium-emphasis mb-2">
        No saved patterns found
      </div>
      <div class="text-body-2 text-disabled">
        Create your first aggregation pattern to get started
      </div>
    </div>

    <div v-else class="patterns-grid">
      <v-card
        v-for="savedPattern in filteredPatterns"
        :key="savedPattern.pattern.id"
        class="pattern-card"
        variant="outlined"
        hover
      >
        <v-card-title class="d-flex align-center justify-space-between pb-2">
          <div class="d-flex align-center ga-2">
            <v-icon
              :color="savedPattern.isFavorite ? 'yellow' : 'grey'"
              @click="toggleFavorite(savedPattern)"
            >
              {{ savedPattern.isFavorite ? 'mdi-star' : 'mdi-star-outline' }}
            </v-icon>
            <span class="text-subtitle-1">{{ savedPattern.pattern.name }}</span>
          </div>
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn
                icon="mdi-dots-vertical"
                size="small"
                variant="text"
                v-bind="props"
              />
            </template>
            <v-list density="compact">
              <v-list-item @click="$emit('load-pattern', savedPattern.pattern)">
                <v-list-item-title>
                  <v-icon class="mr-2">mdi-pencil</v-icon>
                  Edit
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="$emit('duplicate-pattern', savedPattern.pattern)">
                <v-list-item-title>
                  <v-icon class="mr-2">mdi-content-copy</v-icon>
                  Duplicate
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="exportPattern(savedPattern.pattern)">
                <v-list-item-title>
                  <v-icon class="mr-2">mdi-export</v-icon>
                  Export
                </v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item @click="confirmDelete(savedPattern)" class="text-error">
                <v-list-item-title>
                  <v-icon class="mr-2">mdi-delete</v-icon>
                  Delete
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-card-title>

        <v-card-text>
          <div class="pattern-details">
            <!-- Description -->
            <p class="text-body-2 mb-2" v-if="savedPattern.pattern.description">
              {{ savedPattern.pattern.description }}
            </p>

            <!-- Quick Stats -->
            <div class="pattern-stats mb-3">
              <v-chip size="x-small" color="primary" variant="tonal" class="mr-1">
                {{ enabledDaysCount(savedPattern.pattern) }} days
              </v-chip>
              <v-chip size="x-small" color="secondary" variant="tonal" class="mr-1">
                {{ enabledHoursCount(savedPattern.pattern) }} hours
              </v-chip>
              <v-chip size="x-small" color="info" variant="tonal">
                {{ savedPattern.pattern.aggregationMethod }}
              </v-chip>
            </div>

            <!-- Usage Info -->
            <div class="usage-info text-caption text-disabled">
              <div>Used {{ savedPattern.usageCount }} times</div>
              <div>Last used: {{ formatLastUsed(savedPattern.lastUsed) }}</div>
              <div>Created: {{ formatDate(savedPattern.pattern.created) }}</div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            @click="$emit('load-pattern', savedPattern.pattern)"
          >
            <v-icon class="mr-2">mdi-play</v-icon>
            Use Pattern
          </v-btn>
          <v-spacer />
          <v-btn
            color="secondary"
            variant="outlined"
            size="small"
            @click="previewPattern(savedPattern.pattern)"
          >
            <v-icon class="mr-2">mdi-eye</v-icon>
            Preview
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <!-- Import/Export Actions -->
    <div class="import-export-actions mt-6">
      <v-divider class="mb-4" />
      <div class="d-flex ga-2">
        <v-btn
          color="info"
          variant="outlined"
          @click="importPatterns"
        >
          <v-icon class="mr-2">mdi-import</v-icon>
          Import Patterns
        </v-btn>
        <v-btn
          color="info"
          variant="outlined"
          @click="exportAllPatterns"
          :disabled="savedPatterns.length === 0"
        >
          <v-icon class="mr-2">mdi-export</v-icon>
          Export All
        </v-btn>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete the pattern "{{ patternToDelete?.pattern.name }}"?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="executeDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { 
  SavedAggregationPattern, 
  AggregationPattern 
} from '../../types/aggregation';

const props = defineProps<{
  savedPatterns: SavedAggregationPattern[];
}>();

const emit = defineEmits<{
  'load-pattern': [pattern: AggregationPattern];
  'delete-pattern': [patternId: string];
  'duplicate-pattern': [pattern: AggregationPattern];
}>();

// UI State
const searchQuery = ref('');
const sortBy = ref('lastUsed');
const filterBy = ref('all');
const deleteDialog = ref(false);
const patternToDelete = ref<SavedAggregationPattern | null>(null);

// Options
const sortOptions = [
  { title: 'Last Used', value: 'lastUsed' },
  { title: 'Name', value: 'name' },
  { title: 'Created Date', value: 'created' },
  { title: 'Usage Count', value: 'usageCount' }
];

const filterOptions = [
  { title: 'All Patterns', value: 'all' },
  { title: 'Favorites', value: 'favorites' },
  { title: 'Recently Used', value: 'recent' },
  { title: 'Weekday Patterns', value: 'weekday' },
  { title: 'Custom Ranges', value: 'custom' }
];

// Computed
const filteredPatterns = computed(() => {
  let patterns = [...props.savedPatterns];

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    patterns = patterns.filter(p => 
      p.pattern.name.toLowerCase().includes(query) ||
      p.pattern.description.toLowerCase().includes(query)
    );
  }

  // Apply category filter
  switch (filterBy.value) {
    case 'favorites':
      patterns = patterns.filter(p => p.isFavorite);
      break;
    case 'recent':
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      patterns = patterns.filter(p => p.lastUsed > weekAgo);
      break;
    // Add more filters as needed
  }

  // Apply sorting
  switch (sortBy.value) {
    case 'name':
      patterns.sort((a, b) => a.pattern.name.localeCompare(b.pattern.name));
      break;
    case 'created':
      patterns.sort((a, b) => b.pattern.created.getTime() - a.pattern.created.getTime());
      break;
    case 'usageCount':
      patterns.sort((a, b) => b.usageCount - a.usageCount);
      break;
    case 'lastUsed':
    default:
      patterns.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
      break;
  }

  return patterns;
});

// Methods
function enabledDaysCount(pattern: AggregationPattern): number {
  return pattern.selectedDays.filter(day => day.enabled).length;
}

function enabledHoursCount(pattern: AggregationPattern): number {
  return pattern.selectedHours.filter(hour => hour.enabled).length;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatLastUsed(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

function toggleFavorite(savedPattern: SavedAggregationPattern) {
  savedPattern.isFavorite = !savedPattern.isFavorite;
  // Implementation would persist this change
}

function confirmDelete(savedPattern: SavedAggregationPattern) {
  patternToDelete.value = savedPattern;
  deleteDialog.value = true;
}

function executeDelete() {
  if (patternToDelete.value) {
    emit('delete-pattern', patternToDelete.value.pattern.id);
    patternToDelete.value = null;
  }
  deleteDialog.value = false;
}

function previewPattern(pattern: AggregationPattern) {
  // Implementation would show a preview without loading the pattern
  console.log('Preview pattern:', pattern);
}

function exportPattern(pattern: AggregationPattern) {
  const dataStr = JSON.stringify(pattern, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pattern.name.replace(/[^a-z0-9]/gi, '_')}_pattern.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importPatterns() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const pattern = JSON.parse(e.target?.result as string);
          emit('load-pattern', pattern);
        } catch (error) {
          console.error('Error importing pattern:', error);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function exportAllPatterns() {
  const dataStr = JSON.stringify(props.savedPatterns, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aggregation_patterns.json';
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.saved-patterns-manager {
  max-height: 600px;
  overflow-y: auto;
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.pattern-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pattern-card:hover {
  transform: translateY(-2px);
}

.pattern-details {
  min-height: 120px;
}

.pattern-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.usage-info {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 8px;
  margin-top: 8px;
}

.import-export-actions {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 16px;
}
</style>