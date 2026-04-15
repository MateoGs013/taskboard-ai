import { defineStore } from 'pinia';
import { api } from '@/services/api';

export const useIssueStore = defineStore('issue', {
  state: () => ({
    byId: new Map(),
    teamId: null,
    loading: false,
    selected: null,
    comments: [],
    subIssues: [],
    relations: [],
  }),
  getters: {
    all: (s) => Array.from(s.byId.values()),
    byStatus: (s) => {
      const map = new Map();
      for (const issue of s.byId.values()) {
        const arr = map.get(issue.status_id) || [];
        arr.push(issue);
        map.set(issue.status_id, arr);
      }
      for (const arr of map.values()) {
        arr.sort((a, b) => a.sort_order.localeCompare(b.sort_order));
      }
      return map;
    },
  },
  actions: {
    _setMany(issues) {
      this.byId = new Map(issues.map((i) => [i.id, i]));
    },
    _upsert(issue) {
      const next = new Map(this.byId);
      next.set(issue.id, issue);
      this.byId = next;
    },
    async fetch(teamId, filters = {}) {
      if (!teamId) return;
      this.teamId = teamId;
      this.loading = true;
      try {
        const qs = new URLSearchParams({ team_id: teamId, ...filters }).toString();
        const { issues } = await api(`/issues?${qs}`);
        this._setMany(issues);
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const { issue } = await api('/issues', { method: 'POST', body: payload });
      this._upsert(issue);
      return issue;
    },
    async update(issueId, patch) {
      const { issue } = await api(`/issues/${issueId}`, { method: 'PATCH', body: patch });
      this._upsert(issue);
      if (this.selected?.id === issueId) this.selected = issue;
      return issue;
    },
    async move({ issueId, statusId, beforeId, afterId }) {
      // Optimistic: update locally, then reconcile
      const current = this.byId.get(issueId);
      if (current && statusId) {
        this._upsert({ ...current, status_id: statusId });
      }
      const { issue } = await api(`/issues/${issueId}/move`, {
        method: 'POST',
        body: { status_id: statusId, before_id: beforeId, after_id: afterId },
      });
      this._upsert(issue);
      return issue;
    },
    async select(issueId) {
      if (!issueId) { this.clearSelected(); return; }
      const [{ issue }, { comments }, { sub_issues }, { relations }] = await Promise.all([
        api(`/issues/${issueId}`),
        api(`/issues/${issueId}/comments`),
        api(`/issues/${issueId}/sub-issues`),
        api(`/issues/${issueId}/relations`),
      ]);
      this.selected = issue;
      this.comments = comments;
      this.subIssues = sub_issues;
      this.relations = relations;
    },
    async addComment(issueId, body) {
      const { comment } = await api(`/issues/${issueId}/comments`, { method: 'POST', body: { body } });
      this.comments = [...this.comments, comment];
      return comment;
    },
    async setLabels(issueId, labelIds) {
      const { issue } = await api(`/issues/${issueId}/labels`, { method: 'PUT', body: { label_ids: labelIds } });
      this._upsert(issue);
      if (this.selected?.id === issueId) this.selected = issue;
    },
    async createSubIssue(parentId, title) {
      if (!this.teamId) return;
      const { issue } = await api('/issues', {
        method: 'POST',
        body: { team_id: this.teamId, title, parent_id: parentId },
      });
      this._upsert(issue);
      this.subIssues = [...this.subIssues, issue];
      return issue;
    },
    async addRelation(issueId, relatedIssueId, type) {
      await api(`/issues/${issueId}/relations`, {
        method: 'POST',
        body: { related_issue_id: relatedIssueId, type },
      });
      const { relations } = await api(`/issues/${issueId}/relations`);
      this.relations = relations;
    },
    async removeRelation(issueId, relationId) {
      await api(`/issues/${issueId}/relations/${relationId}`, { method: 'DELETE' });
      this.relations = this.relations.filter((r) => r.id !== relationId);
    },
    clearSelected() {
      this.selected = null;
      this.comments = [];
      this.subIssues = [];
      this.relations = [];
    },
    reset() {
      this.byId = new Map();
      this.teamId = null;
      this.selected = null;
      this.comments = [];
    },
  },
});
