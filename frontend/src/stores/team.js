import { defineStore } from 'pinia';
import { api } from '@/services/api';

const ACTIVE_KEY = 'tb.active_team';

export const useTeamStore = defineStore('team', {
  state: () => ({
    list: [],
    activeId: localStorage.getItem(ACTIVE_KEY) || null,
    statuses: [],
    members: [],
    loading: false,
  }),
  getters: {
    active: (s) => s.list.find((t) => t.id === s.activeId) || null,
  },
  actions: {
    async fetch(workspaceId) {
      if (!workspaceId) return;
      this.loading = true;
      try {
        const { teams } = await api(`/teams?workspace_id=${workspaceId}`);
        this.list = teams;
        if (!this.activeId || !teams.find((t) => t.id === this.activeId)) {
          this.setActive(teams[0]?.id || null);
        }
      } finally {
        this.loading = false;
      }
    },
    async create({ workspaceId, name, identifier }) {
      const body = { workspace_id: workspaceId, name };
      if (identifier) body.identifier = identifier;
      const { team } = await api('/teams', { method: 'POST', body });
      this.list = [...this.list, team];
      this.setActive(team.id);
      return team;
    },
    async fetchStatuses(teamId) {
      const { statuses } = await api(`/teams/${teamId}/statuses`);
      this.statuses = statuses;
      return statuses;
    },
    async fetchMembers(teamId) {
      const { members } = await api(`/teams/${teamId}/members`);
      this.members = members;
      return members;
    },
    setActive(id) {
      this.activeId = id;
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    },
    reset() {
      this.list = [];
      this.activeId = null;
      this.statuses = [];
      this.members = [];
      localStorage.removeItem(ACTIVE_KEY);
    },
  },
});
