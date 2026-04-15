<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTeamStore } from '@/stores/team';
import { useProjectStore } from '@/stores/project';

const router = useRouter();
const ws = useWorkspaceStore();
const teams = useTeamStore();
const projects = useProjectStore();

const showCreateProject = ref(false);
const newProjectName = ref('');

async function loadProjects() {
  if (teams.activeId) await projects.fetch(teams.activeId);
}

onMounted(loadProjects);
watch(() => teams.activeId, loadProjects);

async function createProject() {
  if (!newProjectName.value.trim() || !teams.activeId) return;
  await projects.create({ teamId: teams.activeId, name: newProjectName.value.trim() });
  newProjectName.value = '';
  showCreateProject.value = false;
}

function goToBoard(teamId) {
  router.push({ name: 'board-team', params: { teamId } });
}
</script>

<template>
  <section class="home">
    <header class="home__hero">
      <h1>
        <span class="home__greeting">Hola.</span>
        <span class="home__accent">¿Qué construimos hoy?</span>
      </h1>
      <p class="muted">
        Workspace activo: <strong>{{ ws.active?.name ?? '—' }}</strong>
      </p>
    </header>

    <section class="home__block">
      <div class="home__block-head">
        <h2>Teams</h2>
        <span class="count">{{ teams.list.length }}</span>
      </div>
      <div v-if="teams.list.length" class="team-grid">
        <article
          v-for="t in teams.list"
          :key="t.id"
          class="team-card"
          @click="goToBoard(t.id)"
          tabindex="0"
          @keyup.enter="goToBoard(t.id)"
        >
          <span class="team-card__tag">{{ t.identifier }}</span>
          <h3>{{ t.name }}</h3>
          <p class="muted small">{{ t.issue_counter }} issues creadas</p>
        </article>
      </div>
      <p v-else class="muted">
        Todavía no creaste teams. Usá el sidebar para crear el primero.
      </p>
    </section>

    <section class="home__block" v-if="teams.activeId">
      <div class="home__block-head">
        <h2>Proyectos de {{ teams.active?.name }}</h2>
        <button class="btn-ghost" @click="showCreateProject = !showCreateProject">
          {{ showCreateProject ? 'Cancelar' : '+ Nuevo' }}
        </button>
      </div>

      <form v-if="showCreateProject" @submit.prevent="createProject" class="inline-form">
        <input v-model="newProjectName" placeholder="Nombre del proyecto" required />
        <button type="submit">Crear</button>
      </form>

      <div v-if="projects.list.length" class="project-grid">
        <article v-for="p in projects.list" :key="p.id" class="project-card" :style="{ '--c': p.color }">
          <h4>{{ p.name }}</h4>
          <p class="muted small">{{ p.status }}</p>
        </article>
      </div>
      <p v-else-if="!projects.loading" class="muted small">
        Ningún proyecto en este team. Los issues pueden vivir sin proyecto, pero agrupan mejor con uno.
      </p>
    </section>
  </section>
</template>
