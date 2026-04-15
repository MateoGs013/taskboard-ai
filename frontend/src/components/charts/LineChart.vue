<script setup>
import { computed } from 'vue';

const props = defineProps({
  series: { type: Array, required: true }, // [{ name, color, points: [{x, y}] }]
  height: { type: Number, default: 220 },
  yLabel: { type: String, default: '' },
});

const w = 720;
const padX = 44;
const padY = 28;
const innerW = w - padX * 2;
const innerH = computed(() => props.height - padY * 2);

const allPoints = computed(() => props.series.flatMap((s) => s.points));
const maxY = computed(() => Math.max(1, ...allPoints.value.map((p) => p.y)));
const len = computed(() => Math.max(1, ...props.series.map((s) => s.points.length)));

function px(i) {
  return padX + (i / Math.max(1, len.value - 1)) * innerW;
}
function py(v) {
  return padY + innerH.value - (v / maxY.value) * innerH.value;
}

function path(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p.y)}`).join(' ');
}

const xLabels = computed(() => {
  const first = props.series[0]?.points || [];
  if (first.length <= 6) return first.map((p, i) => ({ x: px(i), text: String(p.x).slice(5) }));
  // Sample: first, mid, last
  return [0, Math.floor(first.length / 2), first.length - 1].map((i) => ({
    x: px(i),
    text: String(first[i].x).slice(5),
  }));
});
</script>

<template>
  <svg :viewBox="`0 0 ${w} ${height}`" class="chart" preserveAspectRatio="none">
    <line
      v-for="g in 4"
      :key="g"
      :x1="padX"
      :x2="w - padX"
      :y1="padY + (innerH * g) / 4"
      :y2="padY + (innerH * g) / 4"
      class="chart__grid"
    />
    <g v-for="(s, idx) in series" :key="idx">
      <path :d="path(s.points)" :stroke="s.color" stroke-width="2" fill="none" :class="['chart__line', s.dashed && 'chart__line--dashed']" />
      <circle
        v-for="(p, i) in s.points"
        :key="i"
        :cx="px(i)"
        :cy="py(p.y)"
        r="3"
        :fill="s.color"
      />
    </g>
    <text v-for="(l, i) in xLabels" :key="i" :x="l.x" :y="height - 6" text-anchor="middle" class="chart__label">
      {{ l.text }}
    </text>
    <text v-if="yLabel" :x="6" :y="padY - 6" class="chart__axis">{{ yLabel }}</text>
  </svg>
</template>
