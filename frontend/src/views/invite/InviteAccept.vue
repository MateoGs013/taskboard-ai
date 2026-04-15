<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { api } from '@/services/api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ws = useWorkspaceStore();

const invitation = ref(null);
const error = ref('');
const loading = ref(true);
const accepting = ref(false);

onMounted(async () => {
  await auth.init();
  try {
    const { invitation: inv } = await api(`/workspaces/invitations/by-token/${route.params.token}`, { auth: false });
    invitation.value = inv;
  } catch (e) {
    error.value = e.message || 'Invitación no encontrada';
  } finally {
    loading.value = false;
  }
});

async function accept() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'register', query: { redirect: route.fullPath } });
    return;
  }
  accepting.value = true;
  try {
    const { workspace_id } = await api(`/workspaces/invitations/by-token/${route.params.token}/accept`, {
      method: 'POST',
    });
    await ws.fetch();
    ws.setActive(workspace_id);
    router.push({ name: 'home' });
  } catch (e) {
    error.value = e.message;
  } finally {
    accepting.value = false;
  }
}
</script>

<template>
  <main class="auth">
    <div class="auth__card">
      <h1>Invitación a <span>workspace</span></h1>
      <div v-if="loading" class="muted small">Cargando…</div>
      <div v-else-if="error" class="modal__error">{{ error }}</div>
      <div v-else-if="invitation">
        <p class="auth__sub">
          Te invitaron a unirte a <strong>{{ invitation.workspace_name }}</strong> como
          <strong>{{ invitation.role }}</strong>.
          <template v-if="invitation.inviter_name"><br>De parte de {{ invitation.inviter_name }}.</template>
        </p>
        <button class="btn-primary" :disabled="accepting" @click="accept">
          <template v-if="!auth.isAuthenticated">Registrarme y aceptar</template>
          <template v-else-if="accepting">Aceptando…</template>
          <template v-else>Aceptar invitación</template>
        </button>
        <p v-if="invitation.accepted_at" class="muted small">
          Ya aceptaste esta invitación.
        </p>
      </div>
    </div>
  </main>
</template>
