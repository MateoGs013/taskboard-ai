<script setup>
import { computed, onMounted, watch } from 'vue';
import { useTeamStore } from '@/stores/team';
import { useCycleStore } from '@/stores/cycle';
import { useAnalyticsStore } from '@/stores/analytics';
import BarChart from '@/components/charts/BarChart.vue';
import LineChart from '@/components/charts/LineChart.vue';
import DonutChart from '@/components/charts/DonutChart.vue';

const teams = useTeamStore();
const cycles = useCycleStore();
const analytics = useAnalyticsStore();

const PRIORITY_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#6b7280'];
const PRIORITY_NAMES = ['Urgent', 'High', 'Medium', 'Low', 'None'];

async function load() {
  if (!teams.activeId) return;
  await analytics.fetch({ teamId: teams.activeId, cycleId: cycles.active?.id });
}

onMounted(load);
watch([() => teams.activeId, () => cycles.active?.id], load);

const velocityChart = computed(() =>
  analytics.velocity.map((c) => ({
    label: `#${c.number}`,
    value: Math.round(c.completed_points || c.completed_count || 0),
    color: c.status === 'active' ? 'var(--accent)' : 'var(--accent-hi)',
  }))
);

const burndownSeries = computed(() => {
  if (!analytics.burndown?.series?.length) return [];
  return [
    { name: 'Restante', color: 'var(--accent-hi)', points: analytics.burndown.series.map((s) => ({ x: s.day, y: s.remaining })) },
    { name: 'Ideal', color: 'var(--text-muted)', dashed: true, points: analytics.burndown.series.map((s) => ({ x: s.day, y: s.ideal })) },
  ];
});

const statusDonut = computed(() =>
  analytics.distribution?.by_status?.map((s) => ({
    label: s.name,
    value: Number(s.count),
    color: s.color,
  })) || []
);

const priorityDonut = computed(() =>
  analytics.distribution?.by_priority?.map((p) => ({
    label: PRIORITY_NAMES[p.priority] || 'None',
    value: Number(p.count),
    color: PRIORITY_COLORS[p.priority] || '#6b7280',
  })) || []
);

const throughputChart = computed(() =>
  analytics.throughput.map((w) => ({
    label: w.week.slice(5),
    value: Number(w.count),
    color: 'var(--accent)',
  }))
);

const totalIssues = computed(() =>
  analytics.distribution?.by_status?.reduce((s, x) => s + Number(x.count), 0) || 0
);

const inProgress = computed(() =>
  analytics.distribution?.by_status?.filter((s) => s.type === 'started').reduce((sum, s) => sum + Number(s.count), 0) || 0
);

const completed = computed(() =>
  analytics.distribution?.by_status?.filter((s) => s.type === 'completed').reduce((sum, s) => sum + Number(s.count), 0) || 0
);

const completionRate = computed(() => {
  if (!totalIssues.value) return 0;
  return Math.round((completed.value / totalIssues.value) * 100);
});
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__head">
      <div>
        <h1>Dashboard</h1>
        <p class="muted small">{{ teams.active?.name }} · análisis de salud del team</p>
      </div>
    </header>

    <!-- KPIs -->
    <section class="kpis">
      <article class="kpi">
        <span class="kpi__label">Issues totales</span>
        <strong class="kpi__value">{{ totalIssues }}</strong>
      </article>
      <article class="kpi">
        <span class="kpi__label">En progreso</span>
        <strong class="kpi__value">{{ inProgress }}</strong>
      </article>
      <article class="kpi">
        <span class="kpi__label">Completadas</span>
        <strong class="kpi__value">{{ completed }}</strong>
      </article>
      <article class="kpi">
        <span class="kpi__label">Completion rate</span>
        <strong class="kpi__value">{{ completionRate }}%</strong>
      </article>
    </section>

    <!-- Velocity + Throughput -->
    <section class="dashboard__grid">
      <article class="card">
        <header><h3>Velocity por cycle</h3><span class="muted small">últimos {{ velocityChart.length }}</span></header>
        <BarChart v-if="velocityChart.length" :data="velocityChart" :height="200" y-label="puntos" />
        <p v-else class="muted small empty">No hay cycles completados todavía.</p>
      </article>

      <article class="card">
        <header><h3>Throughput semanal</h3><span class="muted small">últimas 8 semanas</span></header>
        <BarChart v-if="throughputChart.length" :data="throughputChart" :height="200" y-label="issues" />
        <p v-else class="muted small empty">No hay issues completadas en este rango.</p>
      </article>
    </section>

    <!-- Burndown full width -->
    <article class="card">
      <header>
        <h3>Burndown del cycle activo</h3>
        <span class="muted small" v-if="cycles.active">
          #{{ cycles.active.number }} · {{ analytics.burndown?.total }} pts iniciales
        </span>
      </header>
      <LineChart v-if="burndownSeries.length" :series="burndownSeries" :height="240" y-label="restante" />
      <p v-else class="muted small empty">No hay cycle activo. Iniciá uno desde Cycles para ver el burndown.</p>
    </article>

    <!-- Distribution donuts -->
    <section class="dashboard__grid">
      <article class="card">
        <header><h3>Por status</h3></header>
        <DonutChart v-if="statusDonut.length" :data="statusDonut" center-label="issues" />
      </article>
      <article class="card">
        <header><h3>Por prioridad</h3></header>
        <DonutChart v-if="priorityDonut.length" :data="priorityDonut" center-label="issues" />
      </article>
    </section>

    <!-- Assignee distribution -->
    <article class="card" v-if="analytics.distribution?.by_assignee?.length">
      <header><h3>Carga por assignee</h3></header>
      <BarChart
        :data="analytics.distribution.by_assignee.map(a => ({ label: a.name?.split(' ')[0], value: Number(a.count), color: 'var(--accent-hi)' }))"
        :height="160"
        y-label="issues asignadas"
      />
    </article>
  </section>
</template>
