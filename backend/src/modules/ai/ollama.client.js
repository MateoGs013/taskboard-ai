import { env } from '../../config/env.js';

let cachedHealth = { ok: false, models: [], checkedAt: 0 };
const HEALTH_TTL_MS = 30_000;

export async function checkHealth(force = false) {
  const now = Date.now();
  if (!force && now - cachedHealth.checkedAt < HEALTH_TTL_MS) return cachedHealth;
  try {
    const res = await fetch(`${env.OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedHealth = {
      ok: true,
      models: (data.models || []).map((m) => m.name),
      host: env.OLLAMA_HOST,
      checkedAt: now,
    };
  } catch (err) {
    cachedHealth = {
      ok: false,
      error: err.message,
      host: env.OLLAMA_HOST,
      checkedAt: now,
    };
  }
  return cachedHealth;
}

export async function ensureOnline() {
  const h = await checkHealth();
  if (!h.ok) {
    throw Object.assign(new Error('AI service offline (Ollama not reachable)'), {
      statusCode: 503,
    });
  }
}

/**
 * Single-shot chat completion with optional structured JSON output.
 * Pass `format` as a JSON Schema object (Ollama supports this directly)
 * to coerce responses to a schema.
 */
export async function chat({ model, messages, format, temperature = 0.4, num_predict = 1024 }) {
  await ensureOnline();
  const body = {
    model: model || env.OLLAMA_MODEL_QUICK,
    messages,
    stream: false,
    options: { temperature, num_predict },
  };
  if (format) body.format = format;

  const res = await fetch(`${env.OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.message?.content || '',
    model: data.model,
    tokens_in: data.prompt_eval_count,
    tokens_out: data.eval_count,
    duration_ms: Math.round((data.total_duration || 0) / 1e6),
    raw: data,
  };
}

/**
 * Async iterator that yields content chunks as they arrive from Ollama.
 * Use for SSE-style streaming to the frontend.
 */
export async function* chatStream({ model, messages, temperature = 0.5 }) {
  await ensureOnline();
  const res = await fetch(`${env.OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || env.OLLAMA_MODEL_QUICK,
      messages,
      stream: true,
      options: { temperature },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) yield { type: 'chunk', content: obj.message.content };
        if (obj.done) {
          yield {
            type: 'done',
            tokens_in: obj.prompt_eval_count,
            tokens_out: obj.eval_count,
            duration_ms: Math.round((obj.total_duration || 0) / 1e6),
          };
        }
      } catch { /* ignore malformed line */ }
    }
  }
}

export function tryParseJson(content) {
  // Models sometimes wrap JSON in code fences. Strip them.
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract first {...} or [...] block
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error('AI response was not valid JSON');
  }
}
