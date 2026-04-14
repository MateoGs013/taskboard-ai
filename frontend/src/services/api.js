const ACCESS_KEY = 'tb.access_token';
const REFRESH_KEY = 'tb.refresh_token';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshing = null;

async function doRefresh() {
  if (!tokens.refresh) throw new Error('no-refresh');
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh }),
  });
  if (!res.ok) throw new Error('refresh-failed');
  const data = await res.json();
  tokens.set(data);
  return data.access_token;
}

export async function api(path, { method = 'GET', body, headers = {}, auth = true, retry = true } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth && tokens.access) finalHeaders.Authorization = `Bearer ${tokens.access}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry && tokens.refresh) {
    try {
      refreshing = refreshing ?? doRefresh();
      await refreshing;
      refreshing = null;
      return api(path, { method, body, headers, auth, retry: false });
    } catch {
      refreshing = null;
      tokens.clear();
      throw Object.assign(new Error('Unauthorized'), { status: 401 });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, details: err });
  }

  if (res.status === 204) return null;
  return res.json();
}
