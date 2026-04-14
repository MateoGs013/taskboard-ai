import { defineStore } from 'pinia';
import { api, tokens } from '@/services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    initialized: false,
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
  },
  actions: {
    async init() {
      if (this.initialized) return;
      if (tokens.access) {
        try {
          const { user } = await api('/auth/me');
          this.user = user;
        } catch {
          tokens.clear();
        }
      }
      this.initialized = true;
    },
    async login({ email, password }) {
      this.loading = true;
      try {
        const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
        tokens.set(data);
        this.user = data.user;
      } finally {
        this.loading = false;
      }
    },
    async register({ email, password, name }) {
      this.loading = true;
      try {
        const data = await api('/auth/register', { method: 'POST', body: { email, password, name }, auth: false });
        tokens.set(data);
        this.user = data.user;
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      try {
        if (tokens.refresh) {
          await api('/auth/logout', { method: 'POST', body: { refresh_token: tokens.refresh } });
        }
      } catch { /* ignore */ }
      tokens.clear();
      this.user = null;
    },
  },
});
