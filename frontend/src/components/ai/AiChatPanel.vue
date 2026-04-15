<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useAiStore } from '@/stores/ai';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';
import { useKeyboard } from '@/composables/useKeyboard';

const ai = useAiStore();
const ws = useWorkspaceStore();
const teams = useTeamStore();

const input = ref('');
const scroller = ref(null);
const showHistory = ref(false);

useKeyboard({ '!Escape': () => ai.closeChat() });

onMounted(async () => {
  if (ws.activeId) await ai.fetchConversations(ws.activeId);
});

watch(() => ai.messages.length, async () => {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
});

async function send() {
  if (!input.value.trim() || ai.streaming) return;
  const msg = input.value.trim();
  input.value = '';
  await ai.sendMessage({
    workspaceId: ws.activeId,
    teamId: teams.activeId,
    message: msg,
  });
  if (ws.activeId) ai.fetchConversations(ws.activeId);
}

async function loadConv(id) {
  await ai.loadConversation(id);
  showHistory.value = false;
}

function newChat() {
  ai.newConversation();
  showHistory.value = false;
}

const empty = computed(() => ai.messages.length === 0);
</script>

<template>
  <aside class="ai-chat" role="dialog" aria-label="AI assistant">
    <header class="ai-chat__head">
      <div class="ai-chat__title">
        <span class="ai-spark">✦</span>
        <strong>Asistente</strong>
        <span v-if="ai.online" class="online-dot" title="Ollama online"></span>
        <span v-else class="offline-dot" title="Ollama offline"></span>
      </div>
      <div class="ai-chat__actions">
        <button class="icon-btn" @click="showHistory = !showHistory" :title="showHistory ? 'Ocultar' : 'Historial'">
          ⌘
        </button>
        <button class="icon-btn" @click="newChat" title="Nueva conversación">+</button>
        <button class="icon-btn" @click="ai.closeChat()" aria-label="Cerrar">×</button>
      </div>
    </header>

    <div v-if="showHistory" class="ai-chat__history">
      <p v-if="!ai.conversations.length" class="muted small">Sin conversaciones todavía.</p>
      <ul>
        <li v-for="c in ai.conversations" :key="c.id">
          <button @click="loadConv(c.id)" :class="{ active: ai.activeConversationId === c.id }">
            <span>{{ c.title || 'Sin título' }}</span>
            <small>{{ c.msg_count }} msg · {{ new Date(c.updated_at).toLocaleDateString() }}</small>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="!ai.online" class="ai-chat__offline">
      <p>Ollama no está accesible.</p>
      <p class="small muted">
        Iniciá Ollama en <code>{{ ai.status?.host }}</code> y descargá los modelos:
        <code>ollama pull qwen3.5:9b</code>
      </p>
      <button @click="ai.fetchStatus(true)" :disabled="ai.statusChecking">
        {{ ai.statusChecking ? 'Verificando…' : 'Reintentar' }}
      </button>
    </div>

    <div v-else class="ai-chat__body" ref="scroller">
      <div v-if="empty" class="ai-chat__empty">
        <p class="ai-chat__greeting">¿En qué te ayudo?</p>
        <ul class="ai-chat__suggestions">
          <li><button @click="input = 'Generá 5 tareas para implementar OAuth con Google'">Generá 5 tareas para implementar OAuth con Google</button></li>
          <li><button @click="input = 'Cuáles son los riesgos del próximo cycle?'">Cuáles son los riesgos del próximo cycle?</button></li>
          <li><button @click="input = 'Resumí qué se hizo esta semana en el team activo'">Resumí qué se hizo esta semana</button></li>
        </ul>
      </div>
      <div v-else class="ai-chat__messages">
        <div
          v-for="(m, i) in ai.messages"
          :key="i"
          class="ai-msg"
          :class="`ai-msg--${m.role}`"
        >
          <span class="ai-msg__role">{{ m.role === 'user' ? 'Vos' : 'Eros' }}</span>
          <p class="ai-msg__content">{{ m.content }}<span v-if="m.streaming" class="cursor"></span></p>
        </div>
      </div>
    </div>

    <form class="ai-chat__form" @submit.prevent="send" v-if="ai.online">
      <textarea
        v-model="input"
        rows="2"
        placeholder="Preguntá o pedile algo… (Enter para enviar)"
        @keydown.enter.exact.prevent="send"
        :disabled="ai.streaming"
      />
      <button type="submit" :disabled="!input.trim() || ai.streaming">
        {{ ai.streaming ? '…' : 'Enviar' }}
      </button>
    </form>
  </aside>
</template>
