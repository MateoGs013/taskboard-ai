<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true },     // [{ label, value, color }]
  size: { type: Number, default: 180 },
  thickness: { type: Number, default: 22 },
  centerLabel: { type: String, default: '' },
});

const total = computed(() => props.data.reduce((s, d) => s + Number(d.value || 0), 0));

const r = computed(() => props.size / 2 - props.thickness / 2);
const cx = computed(() => props.size / 2);
const circumference = computed(() => 2 * Math.PI * r.value);

const segments = computed(() => {
  let offset = 0;
  return props.data.map((d) => {
    const fraction = total.value > 0 ? Number(d.value) / total.value : 0;
    const dashLen = fraction * circumference.value;
    const seg = {
      ...d,
      strokeDasharray: `${dashLen} ${circumference.value - dashLen}`,
      strokeDashoffset: -offset,
      fraction,
    };
    offset += dashLen;
    return seg;
  });
});
</script>

<template>
  <div class="donut">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="chart">
      <circle
        :cx="cx" :cy="cx" :r="r"
        fill="none"
        :stroke="`var(--bg-2)`"
        :stroke-width="thickness"
      />
      <g :transform="`rotate(-90 ${cx} ${cx})`">
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          :cx="cx" :cy="cx" :r="r"
          fill="none"
          :stroke="seg.color"
          :stroke-width="thickness"
          :stroke-dasharray="seg.strokeDasharray"
          :stroke-dashoffset="seg.strokeDashoffset"
          stroke-linecap="butt"
        />
      </g>
      <text :x="cx" :y="cx - 4" text-anchor="middle" class="donut__total">{{ total }}</text>
      <text :x="cx" :y="cx + 14" text-anchor="middle" class="donut__center">{{ centerLabel }}</text>
    </svg>
    <ul class="donut__legend">
      <li v-for="(seg, i) in segments" :key="i">
        <span class="donut__swatch" :style="{ background: seg.color }"></span>
        <span class="donut__label">{{ seg.label }}</span>
        <span class="donut__value">{{ seg.value }}</span>
      </li>
    </ul>
  </div>
</template>
