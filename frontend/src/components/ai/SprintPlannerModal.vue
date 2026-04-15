<script setup>
import { ref } from 'vue';
import { useAiStore } from '@/stores/ai';
import { useIssueStore } from '@/stores/issue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';
import { api } from '@/services/api';
import { useKeyboard } from '@/composables/useKeyboard';

const props = defineProps({ cycleId: { type: String, required: true } });
const emit = defineEmits(['close', 'assigned']);

const ai = useAiStore();
const issues = useIssueStore();
const ws = useWorkspaceStore();
const teams = useTeamStore();

const capacity = ref(20);
const planning = ref(false);
const result = ref(null);
const assigning = ref(false);
const error = ref('');

useKeyboard({ '!Escape': () => emit('close') });

async function generate() {
  planning.value = true;
  error.value = '';
  try {
    result.value = await ai.planSprint({
      workspaceId: ws.activeId,
      teamId: teams.activeId,
      cycleId: props.cycleId,
      capacity: Number(capacity.value),
    });
  } catch (e) {
    error.value = e.message || 'Falló la planificación';
  } finally {
    planning.value = false;
  }
}

async function assignAll() {
  if (!result.value?.selected?.length) return;
  assigning.value = true;
  try {
    // Fetch issues by identifier from current store + create lookup
    const ids = result.value.selected
      .map((s) => issues.all.find((i) => i.identifier === s.identifier)?.id)
      .filter(Boolean);
    for (const id of ids) {
      await api(`/issues/${id}`, { method: 'PATCH', body: { cycle_id: props.cycleId } });
    }
    if (teams.activeId) await issues.fetch(teams.activeId);
    emit('assigned', ids.length);
  } catch (e) {
    error.value = e.message || 'No se pudo asignar';
  } finally {
    assigning.value = false;
  }
}
</script>

<template>
  <div class="modal" role="dialog" @click.self="emit('close')">
    <div class="modal__card ai-sprint">
      <header>
        <h3><span class="ai-spark">✦</span> Planificar cycle con IA</h3>
        <button class="icon-btn" @click="emit('close')" aria-label="Cerrar">×</button>
      </header>

      <div v-if="!result" class="ai-step">
        <p class="muted small">
          Sugiero qué issues meter en este cycle priorizando por urgencia y respetando tu capacidad.
        </p>
        <label>
          <span>Capacidad estimada (story points)</span>
          <input type="number" v-model.number="capacity" min="1" max="500" />
        </label>
        <p v-if="error" class="modal__error">{{ error }}</p>
        <footer>
          <button class="link" @click="emit('close')">Cancelar</button>
          <button class="btn-primary" :disabled="planning" @click="generate">
            {{ planning ? 'Planificando…' : 'Generar plan' }}
          </button>
        </footer>
      </div>

      <div v-else class="ai-step">
        <section class="ai-sprint__summary">
          <div>
            <span class="muted small">Issues sugeridas</span>
            <strong>{{ result.selected.length }}</strong>
          </div>
          <div v-if="result.total_points">
            <span class="muted small">Puntos totales</span>
            <strong>{{ result.total_points }}</strong>
          </div>
        </section>

        <h4 class="section-title">Issues</h4>
        <ul class="ai-sprint__list">
          <li v-for="(s, idx) in result.selected" :key="idx">
            <span class="identifier mono">{{ s.identifier }}</span>
            <span class="reason">{{ s.reason }}</span>
          </li>
        </ul>

        <section v-if="result.risks?.length">
          <h4 class="section-title">Riesgos</h4>
          <ul class="ai-sprint__risks">
            <li v-for="(r, idx) in result.risks" :key="idx">⚠ {{ r }}</li>
          </ul>
        </section>

        <section v-if="result.recommendations?.length">
          <h4 class="section-title">Recomendaciones</h4>
          <ul>
            <li v-for="(r, idx) in result.recommendations" :key="idx">→ {{ r }}</li>
          </ul>
        </section>

        <p v-if="error" class="modal__error">{{ error }}</p>

        <footer>
          <button class="link" @click="result = null">← Regenerar</button>
          <button class="btn-primary" :disabled="assigning" @click="assignAll">
            {{ assigning ? 'Asignando…' : `Asignar ${result.selected.length} al cycle` }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
