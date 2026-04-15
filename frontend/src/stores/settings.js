import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    members: [],
    invitations: [],
    webhooks: [],
    webhookEvents: [],
    loading: false,
  }),
  actions: {
    async fetchMembers(workspaceId) {
      const data = await api(`/workspaces/${workspaceId}/members`);
      this.members = data.members;
    },
    async fetchInvitations(workspaceId) {
      const data = await api(`/workspaces/${workspaceId}/invitations`);
      this.invitations = data.invitations;
    },
    async invite({ workspaceId, email, role }) {
      const { invitation } = await api(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: { email, role },
      });
      this.invitations = [invitation, ...this.invitations];
      return invitation;
    },
    async revokeInvitation({ workspaceId, id }) {
      await api(`/workspaces/${workspaceId}/invitations/${id}`, { method: 'DELETE' });
      this.invitations = this.invitations.filter((i) => i.id !== id);
    },
    async updateMemberRole({ workspaceId, userId, role }) {
      await api(`/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
      });
      this.members = this.members.map((m) => (m.id === userId ? { ...m, role } : m));
    },
    async removeMember({ workspaceId, userId }) {
      await api(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
      this.members = this.members.filter((m) => m.id !== userId);
    },
    async fetchWebhooks(workspaceId) {
      const data = await api(`/webhooks?workspace_id=${workspaceId}`);
      this.webhooks = data.webhooks;
    },
    async fetchWebhookEvents() {
      const data = await api('/webhooks/events');
      this.webhookEvents = data.events;
    },
    async createWebhook({ workspaceId, name, url, events }) {
      const { webhook } = await api('/webhooks', {
        method: 'POST',
        body: { workspace_id: workspaceId, name, url, events },
      });
      this.webhooks = [webhook, ...this.webhooks];
      return webhook;
    },
    async toggleWebhook({ workspaceId, id, is_active }) {
      const { webhook } = await api(`/webhooks/${id}?workspace_id=${workspaceId}`, {
        method: 'PATCH',
        body: { is_active },
      });
      this.webhooks = this.webhooks.map((w) => (w.id === id ? webhook : w));
    },
    async deleteWebhook({ workspaceId, id }) {
      await api(`/webhooks/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' });
      this.webhooks = this.webhooks.filter((w) => w.id !== id);
    },
  },
});
