import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    list: [],
    unread: 0,
    open: false,
    pollHandle: null,
  }),
  actions: {
    async fetch() {
      const data = await api('/notifications?limit=30');
      this.list = data.notifications;
      this.unread = data.unread_count;
    },
    async fetchUnreadCount() {
      try {
        const { unread_count } = await api('/notifications/unread-count');
        this.unread = unread_count;
      } catch { /* ignore */ }
    },
    async markRead(id) {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      this.list = this.list.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      this.unread = Math.max(0, this.unread - 1);
    },
    async markAllRead() {
      await api('/notifications/read-all', { method: 'POST' });
      this.list = this.list.map((n) => ({ ...n, is_read: true }));
      this.unread = 0;
    },
    startPolling(intervalMs = 60_000) {
      this.stopPolling();
      this.pollHandle = setInterval(() => this.fetchUnreadCount(), intervalMs);
    },
    stopPolling() {
      if (this.pollHandle) { clearInterval(this.pollHandle); this.pollHandle = null; }
    },
    toggle() { this.open = !this.open; if (this.open) this.fetch(); },
    close() { this.open = false; },
    reset() {
      this.stopPolling();
      this.list = []; this.unread = 0; this.open = false;
    },
  },
});
