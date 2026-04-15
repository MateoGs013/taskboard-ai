<script setup>
import { useNotificationStore } from '@/stores/notification';
import { useIssueStore } from '@/stores/issue';

const notif = useNotificationStore();
const issues = useIssueStore();

const ICONS = {
  assigned: '◆',
  mentioned: '@',
  commented: '💬',
  status_changed: '↻',
  completed: '✓',
  cycle_started: '◎',
};

async function open(n) {
  notif.markRead(n.id);
  if (n.issue_id) await issues.select(n.issue_id);
}
</script>

<template>
  <div class="notif">
    <button class="notif__bell" @click="notif.toggle()" aria-label="Notificaciones">
      <span>🔔</span>
      <span v-if="notif.unread > 0" class="notif__badge">{{ notif.unread > 99 ? '99+' : notif.unread }}</span>
    </button>

    <div v-if="notif.open" class="notif__dropdown" @click.stop>
      <header>
        <strong>Notificaciones</strong>
        <button v-if="notif.unread" class="link" @click="notif.markAllRead()">Marcar todas</button>
      </header>
      <ul v-if="notif.list.length">
        <li
          v-for="n in notif.list"
          :key="n.id"
          :class="{ unread: !n.is_read }"
          @click="open(n)"
        >
          <span class="notif__icon">{{ ICONS[n.type] || '•' }}</span>
          <div class="notif__body">
            <strong>{{ n.title }}</strong>
            <p v-if="n.body" class="muted small">{{ n.body }}</p>
            <time>{{ new Date(n.created_at).toLocaleString() }}</time>
          </div>
        </li>
      </ul>
      <p v-else class="muted small empty">Sin notificaciones todavía.</p>
    </div>

    <div v-if="notif.open" class="notif__overlay" @click="notif.close()"></div>
  </div>
</template>
