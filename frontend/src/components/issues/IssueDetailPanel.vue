<script setup>
import { computed, ref, watch } from 'vue';
import { useIssueStore } from '@/stores/issue';
import { useTeamStore } from '@/stores/team';
import { useAiStore } from '@/stores/ai';
import { useWorkspaceStore } from '@/stores/workspace';

const emit = defineEmits(['close']);
const issues = useIssueStore();
const teams = useTeamStore();
const ai = useAiStore();
const ws = useWorkspaceStore();
const aiBusy = ref(false);

const editingTitle = ref(false);
const titleDraft = ref('');
const descDraft = ref('');
const editingDesc = ref(false);
const newComment = ref('');
const posting = ref(false);

const newSubTitle = ref('');
const addingSub = ref(false);
const showRelationForm = ref(false);
const relationType = ref('blocks');
const relationTargetIdentifier = ref('');
const relationError = ref('');

const RELATION_LABELS = {
  blocks: 'Bloquea',
  blocked_by: 'Bloqueada por',
  relates_to: 'Relacionada con',
  duplicate_of: 'Duplica a',
};

const issue = computed(() => issues.selected);

watch(issue, (v) => {
  if (v) {
    titleDraft.value = v.title;
    descDraft.value = v.description || '';
  }
}, { immediate: true });

const priorityLabel = (p) => ['Urgent', 'High', 'Medium', 'Low', 'None'][p] || 'None';
const priorityClass = (p) => ['p-urgent', 'p-high', 'p-medium', 'p-low', 'p-none'][p] || 'p-none';

async function saveTitle() {
  if (titleDraft.value.trim() && titleDraft.value !== issue.value.title) {
    await issues.update(issue.value.id, { title: titleDraft.value.trim() });
  }
  editingTitle.value = false;
}

async function saveDesc() {
  if (descDraft.value !== (issue.value.description || '')) {
    await issues.update(issue.value.id, { description: descDraft.value });
  }
  editingDesc.value = false;
}

async function aiEnhanceDesc() {
  if (aiBusy.value) return;
  aiBusy.value = true;
  try {
    const data = await ai.enhanceDescription({
      workspaceId: ws.activeId,
      teamId: teams.activeId,
      title: issue.value.title,
      description: issue.value.description || '',
    });
    descDraft.value = data.description;
    editingDesc.value = true;
  } finally {
    aiBusy.value = false;
  }
}

async function changeStatus(e) {
  await issues.move({ issueId: issue.value.id, statusId: e.target.value });
}

async function changePriority(e) {
  await issues.update(issue.value.id, { priority: Number(e.target.value) });
}

async function changeAssignee(e) {
  await issues.update(issue.value.id, { assignee_id: e.target.value || null });
}

async function addSubIssue() {
  if (!newSubTitle.value.trim()) return;
  addingSub.value = true;
  try {
    await issues.createSubIssue(issue.value.id, newSubTitle.value.trim());
    newSubTitle.value = '';
  } finally {
    addingSub.value = false;
  }
}

async function openSubIssue(subId) {
  await issues.select(subId);
}

async function addRelation() {
  relationError.value = '';
  const target = issues.all.find(
    (i) => i.identifier.toLowerCase() === relationTargetIdentifier.value.trim().toLowerCase()
  );
  if (!target) {
    relationError.value = 'No encontré una issue con ese identifier en el team activo.';
    return;
  }
  try {
    await issues.addRelation(issue.value.id, target.id, relationType.value);
    relationTargetIdentifier.value = '';
    showRelationForm.value = false;
  } catch (e) {
    relationError.value = e.message || 'No se pudo crear la relación';
  }
}

async function postComment() {
  if (!newComment.value.trim()) return;
  posting.value = true;
  try {
    await issues.addComment(issue.value.id, newComment.value.trim());
    newComment.value = '';
  } finally {
    posting.value = false;
  }
}
</script>

<template>
  <aside class="detail-panel" v-if="issue" role="dialog" aria-label="Issue detail">
    <header class="detail-panel__head">
      <span class="identifier mono">{{ issue.identifier }}</span>
      <button class="icon-btn" @click="emit('close')" aria-label="Cerrar">×</button>
    </header>

    <div class="detail-panel__body">
      <h2 v-if="!editingTitle" @click="editingTitle = true">{{ issue.title }}</h2>
      <input
        v-else
        v-model="titleDraft"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        @keyup.escape="editingTitle = false"
        class="detail-panel__title-input"
        autofocus
      />

      <div class="detail-panel__meta">
        <div class="meta-row">
          <span class="meta-label">Estado</span>
          <select :value="issue.status_id" @change="changeStatus">
            <option v-for="s in teams.statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="meta-row">
          <span class="meta-label">Prioridad</span>
          <select :value="issue.priority" @change="changePriority">
            <option v-for="i in 5" :key="i" :value="i - 1">{{ priorityLabel(i - 1) }}</option>
          </select>
          <span class="priority-dot" :class="priorityClass(issue.priority)"></span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Asignado</span>
          <select :value="issue.assignee_id || ''" @change="changeAssignee">
            <option value="">Sin asignar</option>
            <option v-for="m in teams.members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="meta-row" v-if="issue.labels?.length">
          <span class="meta-label">Labels</span>
          <div class="label-chips">
            <span v-for="l in issue.labels" :key="l.id" class="label" :style="{ '--lc': l.color }">{{ l.name }}</span>
          </div>
        </div>
      </div>

      <section class="detail-panel__desc">
        <h3>Descripción</h3>
        <button v-if="!editingDesc" class="link" @click="editingDesc = true">Editar</button>
        <button
          v-if="ai.online && !editingDesc"
          class="ai-mini"
          :disabled="aiBusy"
          @click="aiEnhanceDesc"
          title="Mejorar con IA"
        >
          ✦ {{ aiBusy ? '…' : 'Mejorar' }}
        </button>
        <p v-if="!editingDesc && issue.description">{{ issue.description }}</p>
        <p v-else-if="!editingDesc" class="muted small">Sin descripción.</p>
        <textarea
          v-else
          v-model="descDraft"
          rows="5"
          @blur="saveDesc"
          @keyup.escape="editingDesc = false"
          autofocus
        />
      </section>

      <section class="detail-panel__section">
        <header class="section-head">
          <h3>Sub-issues ({{ issues.subIssues.length }})</h3>
        </header>
        <ul class="sub-issue-list" v-if="issues.subIssues.length">
          <li
            v-for="s in issues.subIssues"
            :key="s.id"
            class="sub-issue"
            @click="openSubIssue(s.id)"
            tabindex="0"
            @keyup.enter="openSubIssue(s.id)"
          >
            <span class="identifier mono">{{ s.identifier }}</span>
            <span class="title">{{ s.title }}</span>
          </li>
        </ul>
        <form class="sub-issue-form" @submit.prevent="addSubIssue">
          <input
            v-model="newSubTitle"
            placeholder="Nueva sub-issue…"
            maxlength="200"
          />
          <button type="submit" :disabled="addingSub || !newSubTitle.trim()">
            {{ addingSub ? '…' : 'Crear' }}
          </button>
        </form>
      </section>

      <section class="detail-panel__section">
        <header class="section-head">
          <h3>Relaciones ({{ issues.relations.length }})</h3>
          <button class="link" @click="showRelationForm = !showRelationForm">
            {{ showRelationForm ? 'Cancelar' : '+ Añadir' }}
          </button>
        </header>
        <form v-if="showRelationForm" class="relation-form" @submit.prevent="addRelation">
          <select v-model="relationType">
            <option value="blocks">Bloquea</option>
            <option value="blocked_by">Bloqueada por</option>
            <option value="relates_to">Relacionada con</option>
            <option value="duplicate_of">Duplica a</option>
          </select>
          <input
            v-model="relationTargetIdentifier"
            placeholder="Identifier (ej: FE-12)"
            required
          />
          <button type="submit">Añadir</button>
          <p v-if="relationError" class="modal__error">{{ relationError }}</p>
        </form>
        <ul class="relation-list" v-if="issues.relations.length">
          <li v-for="r in issues.relations" :key="r.id" class="relation-row">
            <span class="relation-type">{{ RELATION_LABELS[r.type] }}</span>
            <span class="identifier mono">{{ r.related_identifier }}</span>
            <span class="title">{{ r.related_title }}</span>
            <button class="link danger" @click="issues.removeRelation(issue.id, r.id)">×</button>
          </li>
        </ul>
        <p v-else-if="!showRelationForm" class="muted small">Sin relaciones.</p>
      </section>

      <section class="detail-panel__comments">
        <h3>Comentarios ({{ issues.comments.length }})</h3>
        <ul class="comment-list">
          <li v-for="c in issues.comments" :key="c.id" class="comment">
            <header>
              <strong>{{ c.user_name || 'Anon' }}</strong>
              <time>{{ new Date(c.created_at).toLocaleString() }}</time>
            </header>
            <p>{{ c.body }}</p>
          </li>
        </ul>
        <form class="comment-form" @submit.prevent="postComment">
          <textarea v-model="newComment" rows="2" placeholder="Escribí un comentario…" />
          <button type="submit" :disabled="posting || !newComment.trim()">
            {{ posting ? 'Enviando…' : 'Publicar' }}
          </button>
        </form>
      </section>
    </div>
  </aside>
</template>
