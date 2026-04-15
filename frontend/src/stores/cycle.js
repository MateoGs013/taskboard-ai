import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useCycleStore = defineStore('cycle', {
  state: () => ({
    list: [],
    active: null,
    loading: false,
  }),
  getters: {
    upcoming: (s) => s.list.filter((c) => c.status === 'upcoming'),
    completed: (s) => s.list.filter((c) => c.status === 'completed'),
  },
  actions: {
    async fetch(teamId) {
      if (!teamId) return;
      this.loading = true;
      try {
        const [{ cycles }, { cycle }] = await Promise.all([
          api(`/cycles?team_id=${teamId}`),
          api(`/cycles/active?team_id=${teamId}`),
        ]);
        this.list = cycles;
        this.active = cycle;
      } finally {
        this.loading = false;
      }
    },
    async create({ teamId, name, startDate, endDate }) {
      const { cycle } = await api('/cycles', {
        method: 'POST',
        body: { team_id: teamId, name, start_date: startDate, end_date: endDate },
      });
      this.list = [cycle, ...this.list];
      return cycle;
    },
    async start(cycleId) {
      const { cycle } = await api(`/cycles/${cycleId}/start`, { method: 'POST' });
      this.active = cycle;
      this.list = this.list.map((c) => (c.id === cycleId ? { ...c, status: 'active' } : c));
    },
    async complete(cycleId) {
      await api(`/cycles/${cycleId}/complete`, { method: 'POST' });
      if (this.active?.id === cycleId) this.active = null;
      this.list = this.list.map((c) => (c.id === cycleId ? { ...c, status: 'completed' } : c));
    },
    async remove(cycleId) {
      await api(`/cycles/${cycleId}`, { method: 'DELETE' });
      this.list = this.list.filter((c) => c.id !== cycleId);
      if (this.active?.id === cycleId) this.active = null;
    },
    reset() { this.list = []; this.active = null; },
  },
});
