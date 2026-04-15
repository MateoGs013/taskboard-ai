import { defineStore } from 'pinia';
import { api, tokens } from '@/services/api';

export const useAiStore = defineStore('ai', {
  state: () => ({
    status: { ok: false, models: [], checkedAt: 0 },
    statusChecking: false,
    chatOpen: false,
    conversations: [],
    activeConversationId: null,
    messages: [],          // {role, content, streaming?: boolean}
    streaming: false,
  }),
  getters: {
    online: (s) => s.status.ok,
    hasQuickModel: (s) => s.status.models?.length > 0,
  },
  actions: {
    async fetchStatus(force = false) {
      this.statusChecking = true;
      try {
        this.status = force
          ? await api('/ai/status/refresh', { method: 'POST' })
          : await api('/ai/status');
      } catch {
        this.status = { ok: false, models: [], error: 'unreachable' };
      } finally {
        this.statusChecking = false;
      }
    },
    async generateTasks({ workspaceId, teamId, description }) {
      return api('/ai/generate-tasks', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, description },
      });
    },
    async enhanceDescription({ workspaceId, teamId, title, description }) {
      return api('/ai/enhance-description', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, title, description },
      });
    },
    async suggestPriority({ workspaceId, teamId, title, description }) {
      return api('/ai/suggest-priority', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, title, description },
      });
    },
    async detectDuplicates({ workspaceId, teamId, title, description }) {
      return api('/ai/detect-duplicates', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, title, description },
      });
    },
    async planSprint({ workspaceId, teamId, cycleId, capacity }) {
      return api('/ai/sprint-plan', {
        method: 'POST',
        body: { workspace_id: workspaceId, team_id: teamId, cycle_id: cycleId, capacity },
      });
    },

    // ---- Chat ----
    openChat() { this.chatOpen = true; },
    closeChat() { this.chatOpen = false; },
    async fetchConversations(workspaceId) {
      const { conversations } = await api(`/ai/conversations?workspace_id=${workspaceId}`);
      this.conversations = conversations;
    },
    async loadConversation(conversationId) {
      this.activeConversationId = conversationId;
      const { messages } = await api(`/ai/conversations/${conversationId}/messages`);
      this.messages = messages.map((m) => ({ role: m.role, content: m.content }));
    },
    newConversation() {
      this.activeConversationId = null;
      this.messages = [];
    },
    async sendMessage({ workspaceId, teamId, message, contextType, contextId }) {
      this.messages = [...this.messages, { role: 'user', content: message }];
      this.messages = [...this.messages, { role: 'assistant', content: '', streaming: true }];
      this.streaming = true;

      const last = () => this.messages[this.messages.length - 1];

      const body = {
        workspace_id: workspaceId,
        team_id: teamId,
        message,
        conversation_id: this.activeConversationId || undefined,
        context_type: contextType,
        context_id: contextId,
      };

      const headers = { 'Content-Type': 'application/json' };
      if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop();
          for (const ev of events) {
            const lines = ev.split('\n');
            const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim();
            const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
            if (!dataLine) continue;
            let data;
            try { data = JSON.parse(dataLine); } catch { continue; }

            if (eventType === 'start') {
              this.activeConversationId = data.conversation_id;
            } else if (eventType === 'chunk') {
              const m = last();
              m.content += data.content;
              this.messages = [...this.messages.slice(0, -1), m];
            } else if (eventType === 'done') {
              const m = last();
              m.streaming = false;
              this.messages = [...this.messages.slice(0, -1), m];
            } else if (eventType === 'error') {
              const m = last();
              m.content += `\n\n[Error: ${data.error}]`;
              m.streaming = false;
              this.messages = [...this.messages.slice(0, -1), m];
            }
          }
        }
      } catch (e) {
        const m = last();
        m.content = (m.content || '') + `\n\n[Conexión perdida: ${e.message}]`;
        m.streaming = false;
        this.messages = [...this.messages.slice(0, -1), m];
      } finally {
        this.streaming = false;
      }
    },
    reset() {
      this.chatOpen = false;
      this.conversations = [];
      this.activeConversationId = null;
      this.messages = [];
    },
  },
});
