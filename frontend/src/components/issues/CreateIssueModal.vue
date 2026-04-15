<script setup>
import { ref } from 'vue';
import { useIssueStore } from '@/stores/issue';
import { useTeamStore } from '@/stores/team';

const props = defineProps({
  teamId: { type: String, required: true },
  defaultStatusId: { type: String, default: null },
});
const emit = defineEmits(['close', 'created']);

const issues = useIssueStore();
const teams = useTeamStore();

const title = ref('');
const description = ref('');
const priority = ref(2);
const type = ref('task');
const statusId = ref(props.defaultStatusId);
const assigneeId = ref(null);
const saving = ref(false);
const error = ref('');

async function submit() {
  if (!title.value.trim()) return;
  saving.value = true;
  error.value = '';
  try {
    await issues.create({
      team_id: props.teamId,
      title: title.value.trim(),
      description: description.value || undefined,
      priority: priority.value,
      type: type.value,
      status_id: statusId.value || undefined,
      assignee_id: assigneeId.value || undefined,
    });
    emit('created');
  } catch (e) {
    error.value = e.message || 'No se pudo crear';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="modal" role="dialog" @click.self="emit('close')">
    <form class="modal__card" @submit.prevent="submit">
      <header>
        <h3>Nueva issue</h3>
        <button type="button" class="icon-btn" @click="emit('close')" aria-label="Cerrar">×</button>
      </header>

      <label>
        <span>Título</span>
        <input v-model="title" required maxlength="200" autofocus />
      </label>

      <label>
        <span>Descripción</span>
        <textarea v-model="description" rows="4" maxlength="10000" />
      </label>

      <div class="row">
        <label>
          <span>Estado</span>
          <select v-model="statusId">
            <option :value="null">Backlog por defecto</option>
            <option v-for="s in teams.statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label>
          <span>Prioridad</span>
          <select v-model.number="priority">
            <option :value="0">Urgent</option>
            <option :value="1">High</option>
            <option :value="2">Medium</option>
            <option :value="3">Low</option>
            <option :value="4">None</option>
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select v-model="type">
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="story">Story</option>
            <option value="epic">Epic</option>
          </select>
        </label>
      </div>

      <label v-if="teams.members.length">
        <span>Asignado a</span>
        <select v-model="assigneeId">
          <option :value="null">Sin asignar</option>
          <option v-for="m in teams.members" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </label>

      <p v-if="error" class="modal__error">{{ error }}</p>

      <footer>
        <button type="button" class="link" @click="emit('close')">Cancelar</button>
        <button type="submit" :disabled="saving || !title.trim()">
          {{ saving ? 'Creando…' : 'Crear issue' }}
        </button>
      </footer>
    </form>
  </div>
</template>
