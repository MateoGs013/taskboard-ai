<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTeamStore } from '@/stores/team';
import { useIssueStore } from '@/stores/issue';
import { useWorkspaceStore } from '@/stores/workspace';
import { api } from '@/services/api';

const auth = useAuthStore();
const teams = useTeamStore();
const issues = useIssueStore();
const ws = useWorkspaceStore();

const myIssues = ref([]);
const loading = ref(false);

async function load() {
  if (!auth.user?.id || !ws.activeId) return;
  loading.value = true;
  try {
    // Fetch across all teams in workspace
    const all = [];
    for (const t of teams.list) {
      const { issues: list } = await api(`/issues?team_id=${t.id}&assignee_id=${auth.user.id}`);
      all.push(...list);
    }
    myIssues.value = all;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([() => teams.list.length, () => auth.user?.id], load);

const grouped = computed(() => {
  const groups = { open: [], inProgress: [], done: [] };
  for (const i of myIssues.value) {
    // Crude classification — could read status type if needed
    if (i.completed_at) groups.done.push(i);
    else groups.open.push(i);
  }
  return groups;
});

function PRIORITY_NAME(p) { return ['Urgent', 'High', 'Medium', 'Low', 'None'][p] || 'None'; }
function PRIORITY_DOT(p) { return ['p-urgent', 'p-high', 'p-medium', 'p-low', 'p-none'][p] || 'p-none'; }

async function open(id) { await issues.select(id); }
</script>

<template>
  <section class="my-issues">
    <header>
      <h1>Mis issues</h1>
      <p class="muted small">{{ myIssues.length }} asignadas a vos en este workspace</p>
    </header>

    <div v-if="loading" class="muted">Cargando…</div>
    <div v-else-if="!myIssues.length" class="empty">
      No tenés issues asignadas. Bien por vos.
    </div>

    <div v-else class="my-issues__groups">
      <section v-if="grouped.open.length">
        <h2 class="section-title">Abiertas ({{ grouped.open.length }})</h2>
        <ul class="issue-rows">
          <li v-for="i in grouped.open" :key="i.id" @click="open(i.id)">
            <span class="identifier mono">{{ i.identifier }}</span>
            <span class="title">{{ i.title }}</span>
            <span class="priority-tag" :class="PRIORITY_DOT(i.priority)">{{ PRIORITY_NAME(i.priority) }}</span>
            <span class="due muted small" v-if="i.due_date">{{ i.due_date.slice(0, 10) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="grouped.done.length">
        <h2 class="section-title">Completadas ({{ grouped.done.length }})</h2>
        <ul class="issue-rows issue-rows--done">
          <li v-for="i in grouped.done" :key="i.id" @click="open(i.id)">
            <span class="identifier mono">{{ i.identifier }}</span>
            <span class="title">{{ i.title }}</span>
            <span class="muted small">{{ new Date(i.completed_at).toLocaleDateString() }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
