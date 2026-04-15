import { query } from '../../config/db.js';

export async function listForUser({ userId, onlyUnread = false, limit = 50 }) {
  const where = onlyUnread ? 'AND n.is_read = FALSE' : '';
  const { rows } = await query(
    `SELECT n.id, n.type, n.title, n.body, n.is_read, n.created_at,
            n.issue_id, n.workspace_id,
            i.identifier AS issue_identifier, i.title AS issue_title,
            a.name AS actor_name, a.avatar_url AS actor_avatar
     FROM notifications n
     LEFT JOIN issues i ON i.id = n.issue_id
     LEFT JOIN users a ON a.id = n.actor_id
     WHERE n.user_id = $1 ${where}
     ORDER BY n.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function unreadCount(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return rows[0].c;
}

export async function markRead({ notificationId, userId }) {
  await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllRead(userId) {
  await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
}

/**
 * Helper to be called from issue service hooks. Skips notifications
 * to the actor itself (no self-notify).
 */
let realtimeApp = null;
export function bindRealtime(fastify) { realtimeApp = fastify; }

export async function notify({ userId, workspaceId, issueId, actorId, type, title, body }) {
  if (userId === actorId) return;
  const { rows } = await query(
    `INSERT INTO notifications (user_id, workspace_id, issue_id, actor_id, type, title, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, type, title, body, is_read, created_at, issue_id`,
    [userId, workspaceId, issueId || null, actorId || null, type, title, body || null]
  );
  if (realtimeApp && rows[0]) {
    realtimeApp.realtime.toUser(userId, 'notification.created', { notification: rows[0] });
  }
}
