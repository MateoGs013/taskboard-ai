<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';

const router = useRouter();
const auth = useAuthStore();
const ws = useWorkspaceStore();
const teams = useTeamStore();

const showCreateWs = ref(false);
const showCreateTeam = ref(false);
const newWsName = ref('');
const newTeamName = ref('');
const newTeamIdentifier = ref('');

const ready = computed(() => !ws.loading && !teams.loading);

async function init() {
  await ws.fetch();
  if (ws.activeId) await teams.fetch(ws.activeId);
}

onMounted(init);

watch(() => ws.activeId, async (id) => {
  teams.reset();
  if (id) await teams.fetch(id);
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
  router.push('/login');
}
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
  </div>
</template>
