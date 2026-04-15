<script setup>
import { onMounted, ref, watch } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useSettingsStore } from '@/stores/settings';

const ws = useWorkspaceStore();
const settings = useSettingsStore();

const tab = ref('members');

const inviteEmail = ref('');
const inviteRole = ref('member');
const inviteError = ref('');

const webhookName = ref('');
const webhookUrl = ref('');
const webhookEvents = ref(['issue.created']);
const webhookCreating = ref(false);

async function loadTab(t) {
  tab.value = t;
  if (!ws.activeId) return;
  if (t === 'members') {
    await settings.fetchMembers(ws.activeId);
    await settings.fetchInvitations(ws.activeId);
  } else if (t === 'webhooks') {
    await Promise.all([
      settings.fetchWebhooks(ws.activeId),
      settings.fetchWebhookEvents(),
    ]);
  }
}

onMounted(() => loadTab('members'));
watch(() => ws.activeId, () => loadTab(tab.value));

async function sendInvite() {
  inviteError.value = '';
  try {
    await settings.invite({
      workspaceId: ws.activeId,
      email: inviteEmail.value,
      role: inviteRole.value,
    });
    inviteEmail.value = '';
  } catch (e) {
    inviteError.value = e.message || 'Error';
  }
}

function inviteLink(inv) {
  return `${location.origin}/invite/${inv.token}`;
}

async function copyInvite(inv) {
  try {
    await navigator.clipboard.writeText(inviteLink(inv));
  } catch { /* noop */ }
}

function toggleWebhookEvent(e) {
  if (webhookEvents.value.includes(e)) {
    webhookEvents.value = webhookEvents.value.filter((x) => x !== e);
  } else {
    webhookEvents.value = [...webhookEvents.value, e];
  }
}

async function createWebhook() {
  if (!webhookName.value.trim() || !webhookUrl.value.trim()) return;
  webhookCreating.value = true;
  try {
    const wh = await settings.createWebhook({
      workspaceId: ws.activeId,
      name: webhookName.value.trim(),
      url: webhookUrl.value.trim(),
      events: webhookEvents.value,
    });
    webhookName.value = '';
    webhookUrl.value = '';
    alert(`Secret del webhook (guardalo — no se muestra de nuevo):\n\n${wh.secret}`);
  } finally {
    webhookCreating.value = false;
  }
}
</script>

<template>
  <section class="settings">
    <header>
      <h1>Configuración</h1>
      <p class="muted small">{{ ws.active?.name }}</p>
    </header>

    <nav class="settings__tabs">
      <button :class="{ active: tab === 'members' }" @click="loadTab('members')">Miembros</button>
      <button :class="{ active: tab === 'webhooks' }" @click="loadTab('webhooks')">Webhooks</button>
    </nav>

    <!-- MEMBERS -->
    <section v-if="tab === 'members'" class="settings__panel">
      <h2 class="section-title">Invitar</h2>
      <form class="inline-form" @submit.prevent="sendInvite">
        <input v-model="inviteEmail" type="email" placeholder="email@ejemplo.com" required />
        <select v-model="inviteRole">
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="guest">Guest</option>
        </select>
        <button class="btn-primary" type="submit">Invitar</button>
      </form>
      <p v-if="inviteError" class="modal__error">{{ inviteError }}</p>

      <h2 class="section-title" v-if="settings.invitations.length">Invitaciones pendientes</h2>
      <ul class="settings__list" v-if="settings.invitations.length">
        <li v-for="inv in settings.invitations.filter(i => !i.accepted_at)" :key="inv.id">
          <span>{{ inv.email }}</span>
          <span class="muted small">{{ inv.role }}</span>
          <span class="muted small mono truncate">{{ inviteLink(inv) }}</span>
          <button class="link" @click="copyInvite(inv)">Copiar link</button>
          <button class="link danger" @click="settings.revokeInvitation({ workspaceId: ws.activeId, id: inv.id })">×</button>
        </li>
      </ul>

      <h2 class="section-title">Miembros ({{ settings.members.length }})</h2>
      <ul class="settings__list">
        <li v-for="m in settings.members" :key="m.id">
          <span class="user__avatar" style="width: 26px; height: 26px;">{{ m.name?.[0] }}</span>
          <div>
            <strong>{{ m.name }}</strong>
            <span class="muted small block">{{ m.email }}</span>
          </div>
          <select
            :value="m.role"
            @change="settings.updateMemberRole({ workspaceId: ws.activeId, userId: m.id, role: $event.target.value })"
            :disabled="m.role === 'owner'"
          >
            <option value="owner" disabled>Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
          <button
            v-if="m.role !== 'owner'"
            class="link danger"
            @click="settings.removeMember({ workspaceId: ws.activeId, userId: m.id })"
          >Quitar</button>
        </li>
      </ul>
    </section>

    <!-- WEBHOOKS -->
    <section v-else-if="tab === 'webhooks'" class="settings__panel">
      <h2 class="section-title">Nuevo webhook</h2>
      <form class="webhook-form" @submit.prevent="createWebhook">
        <label>
          <span>Nombre</span>
          <input v-model="webhookName" placeholder="Slack alerts" required />
        </label>
        <label>
          <span>URL</span>
          <input v-model="webhookUrl" type="url" placeholder="https://hooks.slack.com/..." required />
        </label>
        <div>
          <span class="muted small">Eventos</span>
          <div class="event-chips">
            <label v-for="e in settings.webhookEvents" :key="e" class="chip">
              <input type="checkbox" :checked="webhookEvents.includes(e)" @change="toggleWebhookEvent(e)" />
              {{ e }}
            </label>
          </div>
        </div>
        <button class="btn-primary" type="submit" :disabled="webhookCreating">
          {{ webhookCreating ? 'Creando…' : 'Crear webhook' }}
        </button>
      </form>

      <h2 class="section-title" v-if="settings.webhooks.length">Webhooks activos</h2>
      <ul class="settings__list settings__list--webhooks">
        <li v-for="w in settings.webhooks" :key="w.id">
          <strong>{{ w.name }}</strong>
          <span class="muted small truncate">{{ w.url }}</span>
          <span class="mono small">{{ (w.events || []).length }} eventos</span>
          <span class="muted small">
            <template v-if="w.last_fired_at">
              último: {{ new Date(w.last_fired_at).toLocaleString() }} ({{ w.last_status || 'err' }})
            </template>
            <template v-else>nunca disparado</template>
          </span>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="w.is_active"
              @change="settings.toggleWebhook({ workspaceId: ws.activeId, id: w.id, is_active: $event.target.checked })"
            />
            <span>{{ w.is_active ? 'ON' : 'OFF' }}</span>
          </label>
          <button class="link danger" @click="settings.deleteWebhook({ workspaceId: ws.activeId, id: w.id })">×</button>
        </li>
      </ul>
    </section>
  </section>
</template>
