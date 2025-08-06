<template>
  <div>
    <div v-if="error" class="text-red">Error: {{ error }}</div>
    <table v-if="samples && Object.keys(samples).length > 0" style="width: 100%; max-height: 120px; overflow-y: auto; border-collapse: collapse;">
      <thead>
        <tr>
          <th class="font-weight-bold text-white">Time</th>
          <th class="font-weight-bold text-white">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(result, time) in samples" :key="time">
          <td class="pa-2" style="border-bottom: 1px solid #eee;">
            {{ new Date(Number(time)) }}
          </td>
          <td class="pa-2" style="border-bottom: 1px solid #eee;">
            {{ result.value !== null ? result.value.toExponential(3) : 'N/A' }}
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="samples && Object.keys(samples).length === 0" class="mt-2">No data for this point/time.</div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
type SampleTablePropType = { samples: Record<number, { value: number | null; date: Date }> | null, error?: string | null };
const _props = defineProps<SampleTablePropType>();
</script>
