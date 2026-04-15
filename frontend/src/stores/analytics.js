import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useAnalyticsStore = defineStore('analytics', {
  state: () => ({
    velocity: [],
    burndown: null,
    distribution: null,
    throughput: [],
    loading: false,
  }),
  actions: {
    async fetch({ teamId, cycleId }) {
      if (!teamId) return;
      this.loading = true;
      try {
        const [v, d, t] = await Promise.all([
          api(`/analytics/velocity?team_id=${teamId}`),
          api(`/analytics/distribution?team_id=${teamId}`),
          api(`/analytics/throughput?team_id=${teamId}`),
        ]);
        this.velocity = v.cycles;
        this.distribution = d;
        this.throughput = t.weeks;
        if (cycleId) {
          this.burndown = await api(`/analytics/burndown?team_id=${teamId}&cycle_id=${cycleId}`);
        } else {
          this.burndown = null;
        }
      } finally {
        this.loading = false;
      }
    },
    async fetchBurndown({ teamId, cycleId }) {
      this.burndown = await api(`/analytics/burndown?team_id=${teamId}&cycle_id=${cycleId}`);
    },
    reset() {
      this.velocity = [];
      this.burndown = null;
      this.distribution = null;
      this.throughput = [];
    },
  },
});
