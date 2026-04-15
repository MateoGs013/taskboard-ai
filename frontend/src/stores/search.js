import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useSearchStore = defineStore('search', {
  state: () => ({
    open: false,
    query: '',
    results: { issues: [], projects: [], cycles: [] },
    loading: false,
  }),
  getters: {
    flat: (s) => [
      ...s.results.issues.map((i) => ({ kind: 'issue', ...i })),
      ...s.results.projects.map((p) => ({ kind: 'project', ...p })),
      ...s.results.cycles.map((c) => ({ kind: 'cycle', ...c })),
    ],
  },
  actions: {
    openPalette() { this.open = true; },
    closePalette() { this.open = false; this.query = ''; this.results = { issues: [], projects: [], cycles: [] }; },
    async search(workspaceId) {
      const q = this.query.trim();
      if (!q || !workspaceId) {
        this.results = { issues: [], projects: [], cycles: [] };
        return;
      }
      this.loading = true;
      try {
        const data = await api(`/search?q=${encodeURIComponent(q)}&workspace_id=${workspaceId}`);
        this.results = data;
      } finally {
        this.loading = false;
      }
    },
  },
});
