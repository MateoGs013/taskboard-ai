<script setup>
import { onMounted, ref, watch } from 'vue';
import { api, tokens } from '@/services/api';

const props = defineProps({ issueId: { type: String, required: true } });

const attachments = ref([]);
const uploading = ref(false);
const error = ref('');
const fileInput = ref(null);
const dragging = ref(false);

async function load() {
  if (!props.issueId) return;
  const { attachments: list } = await api(`/attachments/issues/${props.issueId}`);
  attachments.value = list;
}

onMounted(load);
watch(() => props.issueId, load);

function isImage(mt) { return mt?.startsWith('image/'); }
function prettySize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function urlWithToken(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(tokens.access)}`;
}

async function upload(file) {
  if (!file) return;
  error.value = '';
  uploading.value = true;
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/attachments/issues/${props.issueId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.access}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    const { attachment } = await res.json();
    attachments.value = [attachment, ...attachments.value];
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onPick(e) {
  const f = e.target.files?.[0];
  if (f) upload(f);
}

function onDrop(e) {
  e.preventDefault();
  dragging.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) upload(f);
}

async function remove(id) {
  if (!confirm('Borrar adjunto?')) return;
  await api(`/attachments/${id}`, { method: 'DELETE' });
  attachments.value = attachments.value.filter((a) => a.id !== id);
}
</script>

<template>
  <section class="attachments">
    <header class="section-head">
      <h3>Adjuntos ({{ attachments.length }})</h3>
    </header>

    <div
      class="attachments__drop"
      :class="{ 'is-drag': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop="onDrop"
      @click="fileInput?.click()"
      tabindex="0"
      @keyup.enter="fileInput?.click()"
    >
      <input ref="fileInput" type="file" hidden @change="onPick" />
      <span v-if="uploading">Subiendo…</span>
      <span v-else>
        <strong>Click o arrastrá</strong> un archivo (max 10 MB)
      </span>
    </div>

    <p v-if="error" class="modal__error">{{ error }}</p>

    <ul v-if="attachments.length" class="attachments__list">
      <li v-for="a in attachments" :key="a.id" class="attachment">
        <a
          v-if="isImage(a.mime_type)"
          :href="urlWithToken(a.url)"
          target="_blank"
          class="attachment__thumb"
        >
          <img :src="urlWithToken(a.url)" :alt="a.filename" loading="lazy" />
        </a>
        <span v-else class="attachment__icon">📎</span>

        <div class="attachment__meta">
          <a :href="urlWithToken(a.url)" target="_blank" :download="a.filename" class="attachment__name">
            {{ a.filename }}
          </a>
          <span class="muted small">{{ prettySize(a.size_bytes) }} · {{ a.user_name || 'Alguien' }}</span>
        </div>
        <button class="link danger" @click="remove(a.id)" aria-label="Borrar">×</button>
      </li>
    </ul>
  </section>
</template>
