import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useProjectStore = defineStore('project', {
  state: () => ({
    list: [],
    loading: false,
  }),
  actions: {
    async fetch(teamId) {
      if (!teamId) return;
      this.loading = true;
      try {
        const { projects } = await api(`/projects?team_id=${teamId}`);
        this.list = projects;
      } finally {
        this.loading = false;
      }
    },
    async create({ teamId, name, description, color, icon }) {
      const { project } = await api('/projects', {
        method: 'POST',
        body: { team_id: teamId, name, description, color, icon },
      });
      this.list = [...this.list, project];
      return project;
    },
  },
});
