<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true },         // [{ label, value, color? }]
  height: { type: Number, default: 200 },
  showValues: { type: Boolean, default: true },
  yLabel: { type: String, default: '' },
});

const max = computed(() => Math.max(1, ...props.data.map((d) => Number(d.value || 0))));
const w = 600;
const padX = 40;
const padY = 32;
const innerW = w - padX * 2;
const innerH = computed(() => props.height - padY * 2);
const barW = computed(() => innerW / Math.max(1, props.data.length) * 0.65);
const slot = computed(() => innerW / Math.max(1, props.data.length));

function barX(i) { return padX + slot.value * i + (slot.value - barW.value) / 2; }
function barY(v) { return padY + innerH.value - (v / max.value) * innerH.value; }
function barH(v) { return (v / max.value) * innerH.value; }
</script>

<template>
  <svg :viewBox="`0 0 ${w} ${height}`" class="chart" preserveAspectRatio="none">
    <!-- gridlines -->
    <line
      v-for="g in 4"
      :key="g"
      :x1="padX"
      :x2="w - padX"
      :y1="padY + (innerH * g) / 4"
      :y2="padY + (innerH * g) / 4"
      class="chart__grid"
    />
    <!-- bars -->
    <g v-for="(d, i) in data" :key="i">
      <rect
        :x="barX(i)"
        :y="barY(d.value)"
        :width="barW"
        :height="barH(d.value)"
        :rx="3"
        :fill="d.color || 'var(--accent)'"
        class="chart__bar"
      />
      <text
        v-if="showValues && d.value > 0"
        :x="barX(i) + barW / 2"
        :y="barY(d.value) - 6"
        text-anchor="middle"
        class="chart__value"
      >{{ d.value }}</text>
      <text
        :x="barX(i) + barW / 2"
        :y="height - 8"
        text-anchor="middle"
        class="chart__label"
      >{{ d.label }}</text>
    </g>
    <text v-if="yLabel" :x="6" :y="padY - 6" class="chart__axis">{{ yLabel }}</text>
  </svg>
</template>
