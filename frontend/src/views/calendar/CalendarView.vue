<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTeamStore } from '@/stores/team';
import { useIssueStore } from '@/stores/issue';

const teams = useTeamStore();
const issues = useIssueStore();

const now = new Date();
const cursor = ref(new Date(now.getFullYear(), now.getMonth(), 1));

const monthLabel = computed(() => cursor.value.toLocaleString('es', { month: 'long', year: 'numeric' }));

function startOfMonthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  return new Date(first.getFullYear(), first.getMonth(), 1 - offset);
}

const days = computed(() => {
  const start = startOfMonthGrid(cursor.value);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
});

const issuesByDay = computed(() => {
  const map = new Map();
  for (const i of issues.all) {
    if (!i.due_date) continue;
    const key = i.due_date.slice(0, 10);
    const arr = map.get(key) || [];
    arr.push(i);
    map.set(key, arr);
  }
  return map;
});

function isToday(d) {
  const t = new Date();
  return d.toDateString() === t.toDateString();
}
function isInMonth(d) { return d.getMonth() === cursor.value.getMonth(); }
function dayKey(d) { return d.toISOString().slice(0, 10); }

function prev() { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1); }
function next() { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1); }
function today() { cursor.value = new Date(now.getFullYear(), now.getMonth(), 1); }

async function load() {
  if (teams.activeId) await issues.fetch(teams.activeId);
}
onMounted(load);
watch(() => teams.activeId, load);
</script>

<template>
  <section class="calendar">
    <header class="calendar__head">
      <div>
        <h1>Calendario</h1>
        <p class="muted small">Issues con due date — {{ teams.active?.name }}</p>
      </div>
      <div class="calendar__nav">
        <button @click="prev">←</button>
        <strong>{{ monthLabel }}</strong>
        <button @click="next">→</button>
        <button @click="today" class="btn-ghost">Hoy</button>
      </div>
    </header>

    <div class="calendar__weekdays">
      <span v-for="d in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="d">{{ d }}</span>
    </div>

    <div class="calendar__grid">
      <div
        v-for="(d, idx) in days"
        :key="idx"
        class="calendar__cell"
        :class="{ 'is-today': isToday(d), 'is-out': !isInMonth(d) }"
      >
        <span class="calendar__date">{{ d.getDate() }}</span>
        <ul class="calendar__items">
          <li
            v-for="i in (issuesByDay.get(dayKey(d)) || []).slice(0, 3)"
            :key="i.id"
            class="calendar__item"
            @click="issues.select(i.id)"
          >
            <span class="identifier mono">{{ i.identifier }}</span>
            <span class="title">{{ i.title }}</span>
          </li>
          <li v-if="(issuesByDay.get(dayKey(d)) || []).length > 3" class="calendar__more">
            +{{ (issuesByDay.get(dayKey(d)) || []).length - 3 }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
