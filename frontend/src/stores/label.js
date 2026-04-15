import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useLabelStore = defineStore('label', {
  state: () => ({
    list: [],
  }),
  actions: {
    async fetch({ workspaceId, teamId }) {
      if (!workspaceId) return;
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      if (teamId) qs.set('team_id', teamId);
      const { labels } = await api(`/labels?${qs.toString()}`);
      this.list = labels;
    },
    async create({ workspaceId, teamId, name, color }) {
      const { label } = await api('/labels', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, name, color },
      });
      this.list = [...this.list, label];
      return label;
    },
  },
});
