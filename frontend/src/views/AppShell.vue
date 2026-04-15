<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';
import { useCycleStore } from '@/stores/cycle';
import { useIssueStore } from '@/stores/issue';
import { useAiStore } from '@/stores/ai';
import { useKeyboard } from '@/composables/useKeyboard';
import AiChatPanel from '@/components/ai/AiChatPanel.vue';
import AiGenerateModal from '@/components/ai/AiGenerateModal.vue';

const router = useRouter();
const auth = useAuthStore();
const ws = useWorkspaceStore();
const teams = useTeamStore();
const cycles = useCycleStore();
const issues = useIssueStore();
const ai = useAiStore();

const showGenerate = ref(false);

const showCreateWs = ref(false);
const showCreateTeam = ref(false);
const newWsName = ref('');
const newTeamName = ref('');
const newTeamIdentifier = ref('');

const ready = computed(() => !ws.loading && !teams.loading);

async function init() {
  await ws.fetch();
  if (ws.activeId) await teams.fetch(ws.activeId);
  if (teams.activeId) await cycles.fetch(teams.activeId);
  ai.fetchStatus();
}

onMounted(init);

watch(() => ws.activeId, async (id) => {
  teams.reset();
  cycles.reset();
  if (id) await teams.fetch(id);
});

watch(() => teams.activeId, async (id) => {
  cycles.reset();
  if (id) await cycles.fetch(id);
});

async function createWs() {
  if (!newWsName.value.trim()) return;
  await ws.create(newWsName.value.trim());
  newWsName.value = '';
  showCreateWs.value = false;
}

async function createTeam() {
  if (!newTeamName.value.trim() || !ws.activeId) return;
  const team = await teams.create({
    workspaceId: ws.activeId,
    name: newTeamName.value.trim(),
    identifier: newTeamIdentifier.value.trim() || undefined,
  });
  newTeamName.value = '';
  newTeamIdentifier.value = '';
  showCreateTeam.value = false;
  router.push({ name: 'board-team', params: { teamId: team.id } });
}

async function logout() {
  await auth.logout();
  ws.reset();
  teams.reset();
  cycles.reset();
  issues.reset();
  router.push('/login');
}

// Global shortcuts: Escape cierra modals/panels (forced), G open chat
useKeyboard({
  '!Escape': () => {
    if (issues.selected) issues.clearSelected();
  },
  g: () => { if (ai.online) ai.openChat(); },
});
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <header class="sidebar__brand">
        <span class="dot"></span>
        <strong>TaskBoard <em>AI</em></strong>
      </header>

      <!-- Workspace switcher -->
      <section class="sidebar__section">
        <div class="sidebar__section-head">
          <span>Workspace</span>
          <button class="icon-btn" @click="showCreateWs = !showCreateWs" aria-label="New workspace">+</button>
        </div>

        <form v-if="showCreateWs" @submit.prevent="createWs" class="inline-form">
          <input v-model="newWsName" placeholder="Nombre del workspace" />
          <button type="submit">Crear</button>
        </form>

        <select
          v-if="ws.list.length"
          class="ws-select"
          :value="ws.activeId"
          @change="ws.setActive($event.target.value)"
        >
          <option v-for="w in ws.list" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
        <p v-else class="muted small">Creá tu primer workspace.</p>
      </section>

      <!-- Top nav -->
      <nav class="sidebar__nav" v-if="ws.activeId">
        <RouterLink :to="{ name: 'home' }" class="nav-link">
          <span class="nav-link__icon">◆</span> Home
        </RouterLink>
        <RouterLink :to="{ name: 'cycles' }" class="nav-link">
          <span class="nav-link__icon">◎</span> Cycles
          <span v-if="cycles.active" class="nav-link__badge">activo</span>
        </RouterLink>
        <RouterLink :to="{ name: 'workflow' }" class="nav-link" v-if="teams.activeId">
          <span class="nav-link__icon">⊞</span> Workflow
        </RouterLink>
      </nav>

      <!-- Teams -->
      <section class="sidebar__section flex-grow" v-if="ws.activeId">
        <div class="sidebar__section-head">
          <span>Teams</span>
          <button class="icon-btn" @click="showCreateTeam = !showCreateTeam" aria-label="New team">+</button>
        </div>

        <form v-if="showCreateTeam" @submit.prevent="createTeam" class="inline-form stack">
          <input v-model="newTeamName" placeholder="Ej: Frontend" required />
          <input v-model="newTeamIdentifier" placeholder="Prefix (FE)" maxlength="6" pattern="[A-Za-z0-9]+" />
          <button type="submit">Crear team</button>
        </form>

        <nav class="team-list">
          <RouterLink
            v-for="t in teams.list"
            :key="t.id"
            :to="{ name: 'board-team', params: { teamId: t.id } }"
            class="team-link"
            @click="teams.setActive(t.id)"
          >
            <span class="team-link__tag">{{ t.identifier }}</span>
            <span class="team-link__name">{{ t.name }}</span>
          </RouterLink>
          <p v-if="!teams.list.length && !teams.loading" class="muted small">
            Todavía no hay teams.
          </p>
        </nav>
      </section>

      <!-- Active cycle -->
      <section v-if="cycles.active" class="sidebar__section active-cycle">
        <div class="sidebar__section-head">
          <span>Cycle activo</span>
        </div>
        <RouterLink :to="{ name: 'cycles' }" class="active-cycle__card">
          <span class="mono small">#{{ cycles.active.number }}</span>
          <strong>{{ cycles.active.name || `Cycle ${cycles.active.number}` }}</strong>
          <span class="muted small">
            hasta {{ cycles.active.end_date?.slice(0, 10) }}
          </span>
        </RouterLink>
      </section>

      <!-- AI status + actions -->
      <section class="sidebar__section">
        <div class="ai-status" :class="{ 'ai-status--online': ai.online, 'ai-status--offline': !ai.online }">
          <span class="ai-status__dot"></span>
          <span class="ai-status__label">
            <template v-if="ai.online">IA online</template>
            <template v-else>IA offline</template>
          </span>
          <button class="link" @click="ai.fetchStatus(true)" :disabled="ai.statusChecking">↻</button>
        </div>
        <div v-if="ai.online" class="ai-actions">
          <button class="ai-cta" @click="showGenerate = true" v-if="teams.activeId">
            ✦ Generar issues
          </button>
          <button class="ai-cta ai-cta--ghost" @click="ai.openChat()">
            ✦ Asistente <kbd>G</kbd>
          </button>
        </div>
      </section>

      <footer class="sidebar__footer">
        <div class="user">
          <span class="user__avatar">{{ auth.user?.name?.[0] ?? '?' }}</span>
          <div>
            <div class="user__name">{{ auth.user?.name }}</div>
            <div class="user__email">{{ auth.user?.email }}</div>
          </div>
        </div>
        <button class="link" @click="logout">Salir</button>
      </footer>
    </aside>

    <main class="main">
      <RouterView v-if="ready" />
      <div v-else class="loading">Cargando…</div>
    </main>

    <AiChatPanel v-if="ai.chatOpen" />
    <AiGenerateModal
      v-if="showGenerate"
      @close="showGenerate = false"
      @created="(n) => { showGenerate = false; if (teams.activeId) issues.fetch(teams.activeId); }"
    />
  </div>
</template>
