<script setup>
import { computed, onMounted, watch } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useActivityStore } from '@/stores/activity';
import { useIssueStore } from '@/stores/issue';

const ws = useWorkspaceStore();
const activity = useActivityStore();
const issues = useIssueStore();

async function load() {
  if (ws.activeId) await activity.fetchFeed(ws.activeId);
}
onMounted(load);
watch(() => ws.activeId, load);

function prettyAction(a) {
  switch (a.action) {
    case 'created': return 'creó';
    case 'updated': return 'editó';
    case 'moved': return 'movió';
    case 'archived': return 'archivó';
    default: return a.action;
  }
}

function changeSummary(a) {
  if (a.action === 'moved') return '→ cambió de estado';
  if (a.action === 'updated' && a.new_value) {
    return Object.keys(a.new_value).slice(0, 3).join(', ');
  }
  return '';
}

async function open(issueId) {
  if (issueId) await issues.select(issueId);
}

const grouped = computed(() => {
  const byDay = new Map();
  for (const a of activity.feed) {
    const key = new Date(a.created_at).toDateString();
    const arr = byDay.get(key) || [];
    arr.push(a);
    byDay.set(key, arr);
  }
  return Array.from(byDay.entries());
});
</script>

<template>
  <section class="activity-view">
    <header>
      <h1>Activity</h1>
      <p class="muted small">Últimos 80 cambios en {{ ws.active?.name }}</p>
    </header>

    <div v-if="activity.loading" class="muted">Cargando…</div>
    <div v-else-if="!activity.feed.length" class="empty">Sin actividad todavía.</div>

    <template v-else v-for="([day, items]) in grouped" :key="day">
      <h2 class="section-title">{{ day }}</h2>
      <ul class="activity-feed">
        <li
          v-for="a in items"
          :key="a.id"
          class="activity-item"
          @click="open(a.issue_id)"
        >
          <span class="activity-item__dot"></span>
          <div class="activity-item__body">
            <p>
              <strong>{{ a.user_name || 'Alguien' }}</strong>
              {{ prettyAction(a) }}
              <span class="identifier mono">{{ a.issue_identifier || '?' }}</span>
              <span class="muted small">{{ a.issue_title }}</span>
            </p>
            <span class="muted small">
              {{ changeSummary(a) }} · {{ new Date(a.created_at).toLocaleTimeString() }}
            </span>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
