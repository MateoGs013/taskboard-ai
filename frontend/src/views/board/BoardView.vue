<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { VueDraggable } from 'vue-draggable-plus';
import { useTeamStore } from '@/stores/team';
import { useIssueStore } from '@/stores/issue';
import IssueCard from '@/components/issues/IssueCard.vue';
import IssueDetailPanel from '@/components/issues/IssueDetailPanel.vue';
import CreateIssueModal from '@/components/issues/CreateIssueModal.vue';

const route = useRoute();
const teams = useTeamStore();
const issues = useIssueStore();

const showCreate = ref(false);
const createStatusId = ref(null);

const activeTeamId = computed(() => route.params.teamId || teams.activeId);

async function boot() {
  const teamId = activeTeamId.value;
  if (!teamId) return;
  teams.setActive(teamId);
  await Promise.all([
    teams.fetchStatuses(teamId),
    teams.fetchMembers(teamId),
    issues.fetch(teamId),
  ]);
}

onMounted(boot);
watch(activeTeamId, boot);

const columns = computed(() => {
  const byStatus = issues.byStatus;
  return teams.statuses.map((s) => ({
    ...s,
    issues: byStatus.get(s.id) || [],
  }));
});

function columnClasses(s) {
  return [`col-type-${s.type}`, { 'col-over-wip': s.wip_limit != null && (issues.byStatus.get(s.id)?.length || 0) > s.wip_limit }];
}

function openCreate(statusId) {
  createStatusId.value = statusId;
  showCreate.value = true;
}

function priorityDot(p) {
  const names = ['urgent', 'high', 'medium', 'low', 'none'];
  return names[p] || 'none';
}

async function onDragEnd(evt, targetStatusId) {
  const item = evt.item?._underlying_vm_ || evt.draggedContext?.element;
  if (!item) return;
  const colIssues = columns.value.find((c) => c.id === targetStatusId)?.issues || [];
  const index = colIssues.findIndex((i) => i.id === item.id);
  const before = index > 0 ? colIssues[index - 1]?.id : null;
  const after = index < colIssues.length - 1 ? colIssues[index + 1]?.id : null;
  await issues.move({
    issueId: item.id,
    statusId: targetStatusId,
    beforeId: before,
    afterId: after,
  });
}
</script>

<template>
  <section class="board">
    <header class="board__header">
      <div>
        <h1>{{ teams.active?.name || 'Board' }}</h1>
        <p class="muted small">{{ teams.active?.identifier }} · {{ issues.all.length }} issues</p>
      </div>
      <button class="btn-primary" @click="openCreate(null)">+ Nueva issue</button>
    </header>

    <div class="board__columns" v-if="!issues.loading">
      <article
        v-for="col in columns"
        :key="col.id"
        class="col"
        :class="columnClasses(col)"
        :style="{ '--col-color': col.color }"
      >
        <header class="col__head">
          <span class="col__name">
            <span class="col__dot"></span>
            {{ col.name }}
          </span>
          <span class="col__count">
            {{ col.issues.length }}
            <template v-if="col.wip_limit"> / {{ col.wip_limit }}</template>
          </span>
        </header>

        <VueDraggable
          v-model="col.issues"
          :animation="160"
          group="issues"
          item-key="id"
          ghostClass="card-ghost"
          chosenClass="card-chosen"
          class="col__body"
          @end="onDragEnd($event, col.id)"
        >
          <IssueCard
            v-for="issue in col.issues"
            :key="issue.id"
            :issue="issue"
            :priority-dot="priorityDot(issue.priority)"
            @click="issues.select(issue.id)"
          />
        </VueDraggable>

        <button class="col__add" @click="openCreate(col.id)">+ Añadir</button>
      </article>
    </div>

    <div v-else class="loading">Cargando issues…</div>

    <CreateIssueModal
      v-if="showCreate"
      :team-id="activeTeamId"
      :default-status-id="createStatusId"
      @close="showCreate = false"
      @created="showCreate = false"
    />

    <IssueDetailPanel v-if="issues.selected" @close="issues.clearSelected()" />
  </section>
</template>
