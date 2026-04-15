<script setup>
import { ref } from 'vue';
import { useAiStore } from '@/stores/ai';
import { useIssueStore } from '@/stores/issue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';
import { useKeyboard } from '@/composables/useKeyboard';

const emit = defineEmits(['close', 'created']);

const ai = useAiStore();
const issues = useIssueStore();
const ws = useWorkspaceStore();
const teams = useTeamStore();

const step = ref(1);
const description = ref('');
const generating = ref(false);
const generated = ref([]);   // { selected: bool, ...issue }
const error = ref('');
const creating = ref(false);

useKeyboard({ '!Escape': () => emit('close') });

async function generate() {
  if (description.value.trim().length < 10) {
    error.value = 'Describí el objetivo con al menos 10 caracteres.';
    return;
  }
  generating.value = true;
  error.value = '';
  try {
    const data = await ai.generateTasks({
      workspaceId: ws.activeId,
      teamId: teams.activeId,
      description: description.value.trim(),
    });
    generated.value = (data.issues || []).map((i) => ({
      ...i,
      selected: true,
      _editing: false,
    }));
    step.value = 2;
  } catch (e) {
    error.value = e.message || 'No se pudo generar';
  } finally {
    generating.value = false;
  }
}

function toggle(i) { i.selected = !i.selected; }

async function bulkCreate() {
  if (!teams.activeId) return;
  creating.value = true;
  try {
    const toCreate = generated.value.filter((i) => i.selected);
    for (const t of toCreate) {
      await issues.create({
        team_id: teams.activeId,
        title: t.title,
        description: t.description || (t.acceptance_criteria?.length
          ? `## Acceptance criteria\n${t.acceptance_criteria.map((a) => `- ${a}`).join('\n')}`
          : undefined),
        priority: t.priority ?? 2,
        type: t.type || 'task',
        estimate: t.estimate || undefined,
      });
    }
    emit('created', toCreate.length);
  } catch (e) {
    error.value = e.message || 'Error al crear';
  } finally {
    creating.value = false;
  }
}

const PRIORITY_NAMES = ['Urgent', 'High', 'Medium', 'Low', 'None'];
</script>

<template>
  <div class="modal" role="dialog" @click.self="emit('close')">
    <div class="modal__card ai-generate">
      <header>
        <h3>
          <span class="ai-spark">✦</span>
          {{ step === 1 ? 'Generar issues con IA' : `Revisar (${generated.filter(g => g.selected).length}/${generated.length})` }}
        </h3>
        <button type="button" class="icon-btn" @click="emit('close')" aria-label="Cerrar">×</button>
      </header>

      <!-- STEP 1: describe -->
      <div v-if="step === 1" class="ai-step">
        <p class="muted small">
          Describí el objetivo en lenguaje natural. La IA va a sugerir tareas atómicas con prioridad y criterios de aceptación.
          Después podés revisar y elegir cuáles crear.
        </p>
        <textarea
          v-model="description"
          rows="6"
          placeholder="Ejemplo: Necesito armar el onboarding de usuarios nuevos: pantalla de bienvenida, tour interactivo, configuración inicial del workspace, y un email de seguimiento a los 3 días."
          maxlength="2000"
          autofocus
        />
        <p v-if="error" class="modal__error">{{ error }}</p>
        <footer>
          <button type="button" class="link" @click="emit('close')">Cancelar</button>
          <button type="button" class="btn-primary" :disabled="generating || description.trim().length < 10" @click="generate">
            <span v-if="generating">Generando…</span>
            <span v-else>Generar tareas</span>
          </button>
        </footer>
      </div>

      <!-- STEP 2: review -->
      <div v-else class="ai-step">
        <p class="muted small">Tildá las que querés crear. Podés editar el título antes.</p>
        <ul class="ai-task-list">
          <li
            v-for="(t, i) in generated"
            :key="i"
            class="ai-task"
            :class="{ 'ai-task--off': !t.selected }"
          >
            <input type="checkbox" v-model="t.selected" />
            <div class="ai-task__main">
              <input class="ai-task__title" v-model="t.title" maxlength="200" />
              <div class="ai-task__meta">
                <span class="ai-task__type">{{ t.type }}</span>
                <span class="ai-task__priority" :class="`p-${PRIORITY_NAMES[t.priority]?.toLowerCase()}`">
                  {{ PRIORITY_NAMES[t.priority] || 'Medium' }}
                </span>
                <span v-if="t.estimate" class="ai-task__pts">{{ t.estimate }} pts</span>
              </div>
              <p v-if="t.description" class="ai-task__desc">{{ t.description }}</p>
              <ul v-if="t.acceptance_criteria?.length" class="ai-task__ac">
                <li v-for="(ac, idx) in t.acceptance_criteria" :key="idx">{{ ac }}</li>
              </ul>
            </div>
          </li>
        </ul>
        <p v-if="error" class="modal__error">{{ error }}</p>
        <footer>
          <button type="button" class="link" @click="step = 1">← Volver</button>
          <button
            type="button"
            class="btn-primary"
            :disabled="creating || generated.filter(g => g.selected).length === 0"
            @click="bulkCreate"
          >
            <span v-if="creating">Creando…</span>
            <span v-else>Crear {{ generated.filter(g => g.selected).length }} issues</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
