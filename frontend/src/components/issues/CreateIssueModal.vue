<script setup>
import { ref } from 'vue';
import { useIssueStore } from '@/stores/issue';
import { useTeamStore } from '@/stores/team';
import { useCycleStore } from '@/stores/cycle';
import { useAiStore } from '@/stores/ai';
import { useWorkspaceStore } from '@/stores/workspace';
import { useKeyboard } from '@/composables/useKeyboard';

const props = defineProps({
  teamId: { type: String, required: true },
  defaultStatusId: { type: String, default: null },
});
const emit = defineEmits(['close', 'created']);

const issues = useIssueStore();
const teams = useTeamStore();
const cycles = useCycleStore();
const ai = useAiStore();
const ws = useWorkspaceStore();

const aiBusy = ref(false);
const aiPriorityHint = ref(null);

const title = ref('');
const description = ref('');
const priority = ref(2);
const type = ref('task');
const statusId = ref(props.defaultStatusId);
const assigneeId = ref(null);
const cycleId = ref(cycles.active?.id || null);
const saving = ref(false);
const error = ref('');

useKeyboard({
  '!Escape': () => emit('close'),
});

async function aiEnhance() {
  if (!title.value.trim() || aiBusy.value) return;
  aiBusy.value = true;
  try {
    const data = await ai.enhanceDescription({
      workspaceId: ws.activeId,
      teamId: props.teamId,
      title: title.value.trim(),
      description: description.value,
    });
    description.value = data.description;
  } catch (e) {
    error.value = e.message || 'No se pudo mejorar';
  } finally {
    aiBusy.value = false;
  }
}

async function aiSuggestPriority() {
  if (!title.value.trim() || aiBusy.value) return;
  aiBusy.value = true;
  try {
    const data = await ai.suggestPriority({
      workspaceId: ws.activeId,
      teamId: props.teamId,
      title: title.value.trim(),
      description: description.value,
    });
    priority.value = data.priority;
    aiPriorityHint.value = data.reasoning;
  } catch (e) {
    error.value = e.message || 'No se pudo sugerir';
  } finally {
    aiBusy.value = false;
  }
}

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
      cycle_id: cycleId.value || undefined,
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
        <span class="label-with-action">
          Descripción
          <button
            type="button"
            class="ai-mini"
            v-if="ai.online && title.trim()"
            :disabled="aiBusy"
            @click="aiEnhance"
            title="Mejorar con IA"
          >
            ✦ {{ aiBusy ? '…' : 'Mejorar' }}
          </button>
        </span>
        <textarea v-model="description" rows="5" maxlength="10000" />
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
          <span class="label-with-action">
            Prioridad
            <button
              type="button"
              class="ai-mini"
              v-if="ai.online && title.trim()"
              :disabled="aiBusy"
              @click="aiSuggestPriority"
              title="Sugerir prioridad"
            >
              ✦ Sugerir
            </button>
          </span>
          <select v-model.number="priority">
            <option :value="0">Urgent</option>
            <option :value="1">High</option>
            <option :value="2">Medium</option>
            <option :value="3">Low</option>
            <option :value="4">None</option>
          </select>
          <small v-if="aiPriorityHint" class="ai-hint">{{ aiPriorityHint }}</small>
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

      <div class="row">
        <label v-if="teams.members.length">
          <span>Asignado a</span>
          <select v-model="assigneeId">
            <option :value="null">Sin asignar</option>
            <option v-for="m in teams.members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <label v-if="cycles.list.length">
          <span>Cycle</span>
          <select v-model="cycleId">
            <option :value="null">Sin cycle</option>
            <option v-for="c in cycles.list" :key="c.id" :value="c.id">
              #{{ c.number }} {{ c.name || '' }}
            </option>
          </select>
        </label>
      </div>

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
