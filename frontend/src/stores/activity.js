import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useActivityStore = defineStore('activity', {
  state: () => ({
    feed: [],
    perIssue: new Map(),
    loading: false,
  }),
  actions: {
    async fetchFeed(workspaceId) {
      if (!workspaceId) return;
      this.loading = true;
      try {
        const { activity } = await api(`/activity?workspace_id=${workspaceId}&limit=80`);
        this.feed = activity;
      } finally {
        this.loading = false;
      }
    },
    async fetchForIssue(issueId) {
      const { activity } = await api(`/activity/issues/${issueId}`);
      this.perIssue.set(issueId, activity);
      return activity;
    },
  },
});
