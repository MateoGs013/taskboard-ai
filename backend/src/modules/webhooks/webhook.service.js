import crypto from 'node:crypto';
import { query } from '../../config/db.js';

export const SUPPORTED_EVENTS = [
  'issue.created', 'issue.updated', 'issue.moved', 'issue.archived',
  'comment.created', 'cycle.started', 'cycle.completed',
];

function randomSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

async function assertAdmin(workspaceId, userId) {
  const { rows } = await query(
    `SELECT role FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
    [workspaceId, userId]
  );
  if (!rows.length || !['owner', 'admin'].includes(rows[0].role)) {
    throw Object.assign(new Error('Admin-only'), { statusCode: 403 });
  }
}

export async function listWebhooks({ workspaceId, userId }) {
  await assertAdmin(workspaceId, userId);
  const { rows } = await query(
    `SELECT id, name, url, events, is_active, last_fired_at, last_status, failure_count, created_at
     FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  return rows;
}

export async function createWebhook({ workspaceId, userId, name, url, events }) {
  await assertAdmin(workspaceId, userId);
  const secret = randomSecret();
  const { rows } = await query(
    `INSERT INTO webhooks (workspace_id, name, url, secret, events, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, name, url, secret, events, is_active, created_at`,
    [workspaceId, name, url, secret, JSON.stringify(events), userId]
  );
  return rows[0];
}

export async function updateWebhook({ workspaceId, webhookId, userId, patch }) {
  await assertAdmin(workspaceId, userId);
  const allowed = ['name', 'url', 'events', 'is_active'];
  const keys = Object.keys(patch).filter((k) => allowed.includes(k));
  if (!keys.length) return null;
  const sets = keys.map((k, i) => `${k} = ${k === 'events' ? `$${i + 1}::jsonb` : `$${i + 1}`}`).join(', ');
  const values = keys.map((k) => (k === 'events' ? JSON.stringify(patch[k]) : patch[k]));
  const { rows } = await query(
    `UPDATE webhooks SET ${sets}
     WHERE id = $${keys.length + 1} AND workspace_id = $${keys.length + 2}
     RETURNING id, name, url, events, is_active, last_fired_at, last_status, failure_count`,
    [...values, webhookId, workspaceId]
  );
  return rows[0] || null;
}

export async function deleteWebhook({ workspaceId, webhookId, userId }) {
  await assertAdmin(workspaceId, userId);
  await query(`DELETE FROM webhooks WHERE id = $1 AND workspace_id = $2`, [webhookId, workspaceId]);
}

/**
 * Fire-and-forget delivery. Never throws.
 * Computes HMAC-SHA256 signature of body with webhook secret.
 */
export async function dispatch({ workspaceId, event, payload }) {
  try {
    const { rows: hooks } = await query(
      `SELECT id, url, secret, events FROM webhooks
       WHERE workspace_id = $1 AND is_active = TRUE`,
      [workspaceId]
    );
    for (const h of hooks) {
      const events = Array.isArray(h.events) ? h.events : [];
      if (!events.includes(event) && !events.includes('*')) continue;
      deliverOne(h, event, payload).catch(() => {});
    }
  } catch (e) {
    console.warn('[webhook] dispatch failed:', e.message);
  }
}

async function deliverOne(hook, event, payload) {
  const body = JSON.stringify({ event, payload, ts: Date.now() });
  const signature = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
  const start = Date.now();
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TaskBoard-AI-Webhook/1',
        'X-TaskBoard-Event': event,
        'X-TaskBoard-Signature': `sha256=${signature}`,
        'X-TaskBoard-Delivery': crypto.randomUUID(),
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const duration = Date.now() - start;
    await query(
      `UPDATE webhooks
       SET last_fired_at = NOW(), last_status = $1,
           failure_count = CASE WHEN $1 < 400 THEN 0 ELSE failure_count + 1 END
       WHERE id = $2`,
      [res.status, hook.id]
    );
    if (res.status >= 500 || duration > 10_000) {
      console.warn(`[webhook] ${hook.id} returned ${res.status} in ${duration}ms`);
    }
  } catch (err) {
    await query(
      `UPDATE webhooks SET last_fired_at = NOW(), last_status = 0, failure_count = failure_count + 1
       WHERE id = $1`,
      [hook.id]
    );
  }
}
