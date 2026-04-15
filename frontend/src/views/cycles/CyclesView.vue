<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTeamStore } from '@/stores/team';
import { useCycleStore } from '@/stores/cycle';
import { useAiStore } from '@/stores/ai';
import SprintPlannerModal from '@/components/ai/SprintPlannerModal.vue';

const teams = useTeamStore();
const cycles = useCycleStore();
const ai = useAiStore();

const showForm = ref(false);
const planningCycleId = ref(null);
const name = ref('');
const startDate = ref('');
const endDate = ref('');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function prefillDates() {
  const today = new Date().toISOString().slice(0, 10);
  const duration = teams.active?.cycle_duration || 14;
  startDate.value = today;
  endDate.value = addDays(today, duration);
}

async function load() {
  if (teams.activeId) await cycles.fetch(teams.activeId);
}

onMounted(() => {
  prefillDates();
  load();
});
watch(() => teams.activeId, load);

async function createCycle() {
  if (!teams.activeId || !startDate.value || !endDate.value) return;
  await cycles.create({
    teamId: teams.activeId,
    name: name.value.trim() || null,
    startDate: startDate.value,
    endDate: endDate.value,
  });
  name.value = '';
  prefillDates();
  showForm.value = false;
}

function progressPct(c) {
  if (!c.total_points || Number(c.total_points) === 0) {
    return c.issue_count > 0 ? Math.round((Number(c.completed_count) / Number(c.issue_count)) * 100) : 0;
  }
  return Math.round((Number(c.completed_points) / Number(c.total_points)) * 100);
}
</script>

<template>
  <section class="cycles-view">
    <header class="cycles-view__head">
      <div>
        <h1>Cycles</h1>
        <p class="muted small">
          Sprints del team. Agrupá issues, trackeá velocity, cerrá el cycle cuando termina.
        </p>
      </div>
      <button class="btn-primary" @click="showForm = !showForm">
        {{ showForm ? 'Cancelar' : '+ Nuevo cycle' }}
      </button>
    </header>

    <form v-if="showForm" class="cycle-form" @submit.prevent="createCycle">
      <label>
        <span>Nombre (opcional)</span>
        <input v-model="name" placeholder="Ej: Sprint 14 — auth & billing" maxlength="80" />
      </label>
      <div class="row">
        <label>
          <span>Desde</span>
          <input type="date" v-model="startDate" required />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" v-model="endDate" required />
        </label>
      </div>
      <button class="btn-primary" type="submit">Crear cycle</button>
    </form>

    <section v-if="cycles.active" class="cycle-active">
      <div class="cycle-active__head">
        <span class="tag">Activo</span>
        <h2>
          {{ cycles.active.name || `Cycle #${cycles.active.number}` }}
        </h2>
      </div>
      <p class="muted small">
        {{ cycles.active.start_date?.slice(0, 10) }} → {{ cycles.active.end_date?.slice(0, 10) }}
      </p>
      <div class="row">
        <button class="btn-ghost" @click="cycles.complete(cycles.active.id)">Completar cycle</button>
      </div>
    </section>

    <section>
      <h2 class="section-title">Todos los cycles</h2>
      <p v-if="!cycles.list.length && !cycles.loading" class="muted">Todavía no hay cycles.</p>
      <ul class="cycle-list">
        <li v-for="c in cycles.list" :key="c.id" :class="['cycle-item', `cycle-${c.status}`]">
          <header>
            <span class="cycle-num mono">#{{ c.number }}</span>
            <strong>{{ c.name || `Cycle ${c.number}` }}</strong>
            <span class="cycle-status">{{ c.status }}</span>
          </header>
          <p class="muted small">
            {{ c.start_date?.slice(0, 10) }} → {{ c.end_date?.slice(0, 10) }}
          </p>
          <div class="progress">
            <div class="progress__bar" :style="{ width: progressPct(c) + '%' }"></div>
          </div>
          <p class="muted small">
            {{ c.completed_count }}/{{ c.issue_count }} issues
            <template v-if="Number(c.total_points) > 0">
              · {{ c.completed_points }}/{{ c.total_points }} pts
            </template>
            ({{ progressPct(c) }}%)
          </p>
          <footer class="row">
            <button v-if="c.status === 'upcoming'" class="btn-ghost" @click="cycles.start(c.id)">Iniciar</button>
            <button v-if="c.status === 'active'" class="btn-ghost" @click="cycles.complete(c.id)">Completar</button>
            <button
              v-if="ai.online && c.status !== 'completed'"
              class="ai-mini"
              @click="planningCycleId = c.id"
              title="Planificar con IA"
            >
              ✦ Planificar
            </button>
            <button v-if="c.status !== 'active'" class="link danger" @click="cycles.remove(c.id)">Borrar</button>
          </footer>
        </li>
      </ul>
    </section>

    <SprintPlannerModal
      v-if="planningCycleId"
      :cycle-id="planningCycleId"
      @close="planningCycleId = null"
      @assigned="planningCycleId = null"
    />
  </section>
</template>
