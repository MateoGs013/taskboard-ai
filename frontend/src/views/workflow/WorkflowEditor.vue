<script setup>
import { onMounted, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useTeamStore } from '@/stores/team';
import { api } from '@/services/api';

const teams = useTeamStore();
const statuses = ref([]);
const saving = ref(false);
const showNew = ref(false);
const newName = ref('');
const newType = ref('started');
const newColor = ref('#6366f1');

async function load() {
  if (!teams.activeId) return;
  const { statuses: s } = await api(`/teams/${teams.activeId}/statuses`);
  statuses.value = s;
}

onMounted(load);
watch(() => teams.activeId, load);

async function onReorder() {
  if (!teams.activeId) return;
  const ordered_ids = statuses.value.map((s) => s.id);
  await api(`/teams/${teams.activeId}/statuses/reorder`, {
    method: 'POST',
    body: { ordered_ids },
  });
  // Refresh teams store's statuses cache
  await teams.fetchStatuses(teams.activeId);
}

async function updateStatus(id, patch) {
  saving.value = true;
  try {
    const { status } = await api(`/teams/${teams.activeId}/statuses/${id}`, {
      method: 'PATCH',
      body: patch,
    });
    statuses.value = statuses.value.map((s) => (s.id === id ? status : s));
    await teams.fetchStatuses(teams.activeId);
  } finally {
    saving.value = false;
  }
}

async function createStatus() {
  if (!newName.value.trim()) return;
  await api(`/teams/${teams.activeId}/statuses`, {
    method: 'POST',
    body: { name: newName.value.trim(), type: newType.value, color: newColor.value },
  });
  newName.value = '';
  showNew.value = false;
  await load();
  await teams.fetchStatuses(teams.activeId);
}

async function deleteStatus(id) {
  if (!confirm('Borrar este status? Las issues se moverán al primer status.')) return;
  await api(`/teams/${teams.activeId}/statuses/${id}`, { method: 'DELETE' });
  statuses.value = statuses.value.filter((s) => s.id !== id);
  await teams.fetchStatuses(teams.activeId);
}
</script>

<template>
  <section class="workflow-editor">
    <header>
      <div>
        <h1>Workflow de {{ teams.active?.name }}</h1>
        <p class="muted small">
          Reordená arrastrando. Cada columna tiene un tipo semántico que alimenta los reportes.
        </p>
      </div>
      <button class="btn-primary" @click="showNew = !showNew">
        {{ showNew ? 'Cancelar' : '+ Nueva columna' }}
      </button>
    </header>

    <form v-if="showNew" class="new-status" @submit.prevent="createStatus">
      <label>
        <span>Nombre</span>
        <input v-model="newName" required maxlength="40" placeholder="Ej: QA" />
      </label>
      <label>
        <span>Tipo</span>
        <select v-model="newType">
          <option value="backlog">Backlog</option>
          <option value="unstarted">Unstarted</option>
          <option value="started">Started</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label>
        <span>Color</span>
        <input type="color" v-model="newColor" />
      </label>
      <button class="btn-primary" type="submit">Crear</button>
    </form>

    <VueDraggable
      v-model="statuses"
      :animation="160"
      handle=".drag-handle"
      item-key="id"
      class="status-list"
      @end="onReorder"
    >
      <div v-for="s in statuses" :key="s.id" class="status-row" :style="{ '--col-color': s.color }">
        <button class="drag-handle" aria-label="Reordenar">⋮⋮</button>
        <span class="dot"></span>
        <input
          class="status-name"
          :value="s.name"
          @change="updateStatus(s.id, { name: $event.target.value })"
        />
        <span class="status-type">{{ s.type }}</span>
        <input
          type="color"
          :value="s.color"
          @change="updateStatus(s.id, { color: $event.target.value })"
          title="Color"
        />
        <label class="wip">
          <span>WIP</span>
          <input
            type="number"
            min="0"
            :value="s.wip_limit || ''"
            placeholder="—"
            @change="updateStatus(s.id, { wip_limit: $event.target.value ? Number($event.target.value) : null })"
          />
        </label>
        <button class="link danger" @click="deleteStatus(s.id)" :disabled="statuses.length <= 1">Borrar</button>
      </div>
    </VueDraggable>
  </section>
</template>
