import { defineStore } from 'pinia';
import { api } from '@/services/api';

const ACTIVE_KEY = 'tb.active_workspace';

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    list: [],
    activeId: localStorage.getItem(ACTIVE_KEY) || null,
    loading: false,
  }),
  getters: {
    active: (s) => s.list.find((w) => w.id === s.activeId) || null,
  },
  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { workspaces } = await api('/workspaces');
        this.list = workspaces;
        if (!this.activeId || !this.list.find((w) => w.id === this.activeId)) {
          this.setActive(workspaces[0]?.id || null);
        }
      } finally {
        this.loading = false;
      }
    },
    async create(name) {
      const { workspace } = await api('/workspaces', { method: 'POST', body: { name } });
      this.list = [workspace, ...this.list];
      this.setActive(workspace.id);
      return workspace;
    },
    setActive(id) {
      this.activeId = id;
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    },
    reset() {
      this.list = [];
      this.activeId = null;
      localStorage.removeItem(ACTIVE_KEY);
    },
  },
});
