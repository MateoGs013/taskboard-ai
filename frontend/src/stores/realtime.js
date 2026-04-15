import { defineStore } from 'pinia';
import { tokens } from '@/services/api';

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    socket: null,
    connected: false,
    reconnectAttempts: 0,
    workspaceId: null,
    listeners: new Map(), // event -> Set<fn>
  }),
  actions: {
    on(event, fn) {
      let set = this.listeners.get(event);
      if (!set) { set = new Set(); this.listeners.set(event, set); }
      set.add(fn);
      return () => set.delete(fn);
    },
    _emit(event, payload) {
      const set = this.listeners.get(event);
      if (set) for (const fn of set) { try { fn(payload); } catch { /* ignore */ } }
    },
    connect(workspaceId) {
      if (!tokens.access) return;
      if (this.socket && this.connected && this.workspaceId === workspaceId) return;

      this.workspaceId = workspaceId;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}/ws?token=${tokens.access}`;
      try { this.socket?.close(); } catch {}

      const ws = new WebSocket(url);
      this.socket = ws;

      ws.addEventListener('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        if (workspaceId) ws.send(JSON.stringify({ type: 'subscribe', workspace_id: workspaceId }));
      });

      ws.addEventListener('message', (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);
          this._emit(event, payload);
        } catch {}
      });

      ws.addEventListener('close', () => {
        this.connected = false;
        this.socket = null;
        const delay = Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempts));
        this.reconnectAttempts++;
        if (tokens.access && this.workspaceId) {
          setTimeout(() => this.connect(this.workspaceId), delay);
        }
      });

      ws.addEventListener('error', () => { /* handled by close */ });
    },
    subscribeWorkspace(workspaceId) {
      this.workspaceId = workspaceId;
      if (this.connected && this.socket) {
        this.socket.send(JSON.stringify({ type: 'subscribe', workspace_id: workspaceId }));
      } else {
        this.connect(workspaceId);
      }
    },
    disconnect() {
      try { this.socket?.close(); } catch {}
      this.socket = null; this.connected = false; this.workspaceId = null;
    },
  },
});
