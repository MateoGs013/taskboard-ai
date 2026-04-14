<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';

const auth = useAuthStore();
const workspaces = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await api('/workspaces');
    workspaces.value = data.workspaces;
  } finally {
    loading.value = false;
  }
});

async function createWorkspace() {
  const name = prompt('Nombre del workspace:');
  if (!name) return;
  const { workspace } = await api('/workspaces', { method: 'POST', body: { name } });
  workspaces.value = [workspace, ...workspaces.value];
}
</script>

<template>
  <main class="board-shell">
    <header class="board-shell__header">
      <h1>TaskBoard <span>AI</span></h1>
      <div class="board-shell__user">
        <span>{{ auth.user?.name }}</span>
        <button type="button" class="link" @click="auth.logout().then(() => $router.push('/login'))">
          Salir
        </button>
      </div>
    </header>

    <section class="board-shell__body">
      <div class="board-shell__workspaces">
        <div class="board-shell__workspaces-head">
          <h2>Workspaces</h2>
          <button type="button" @click="createWorkspace">+ Nuevo</button>
        </div>

        <p v-if="loading" class="muted">Cargando…</p>
        <p v-else-if="workspaces.length === 0" class="muted">
          Todavía no tenés ningún workspace. Creá el primero.
        </p>
        <ul v-else class="workspace-list">
          <li v-for="ws in workspaces" :key="ws.id">
            <strong>{{ ws.name }}</strong>
            <span class="role">{{ ws.role }}</span>
          </li>
        </ul>
      </div>

      <aside class="board-shell__hint">
        <h3>Próximo paso</h3>
        <p>
          El board vive acá. En la próxima fase se agregan teams, workflows, columnas y drag & drop
          de issues. El scaffold ya tiene auth funcional, workspace CRUD básico y el schema completo
          en la DB.
        </p>
      </aside>
    </section>
  </main>
</template>
