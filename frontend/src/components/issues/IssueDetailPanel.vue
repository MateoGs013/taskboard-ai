<script setup>
import { computed, ref, watch } from 'vue';
import { useIssueStore } from '@/stores/issue';
import { useTeamStore } from '@/stores/team';

const emit = defineEmits(['close']);
const issues = useIssueStore();
const teams = useTeamStore();

const editingTitle = ref(false);
const titleDraft = ref('');
const descDraft = ref('');
const editingDesc = ref(false);
const newComment = ref('');
const posting = ref(false);

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

async function changeStatus(e) {
  await issues.move({ issueId: issue.value.id, statusId: e.target.value });
}

async function changePriority(e) {
  await issues.update(issue.value.id, { priority: Number(e.target.value) });
}

async function changeAssignee(e) {
  await issues.update(issue.value.id, { assignee_id: e.target.value || null });
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
