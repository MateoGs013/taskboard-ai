import { query } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

export default async function activityRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });

    const { rows: access } = await app.db.query(
      `SELECT 1 FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
      [workspaceId, request.user.sub]
    );
    if (!access.length) return reply.code(403).send({ error: 'Forbidden' });

    const limit = Math.min(Number(request.query?.limit) || 50, 200);
    const { rows } = await app.db.query(
      `SELECT al.id, al.action, al.field_changed, al.old_value, al.new_value, al.created_at,
              al.issue_id,
              i.identifier AS issue_identifier, i.title AS issue_title,
              u.name AS user_name, u.avatar_url AS user_avatar
       FROM activity_log al
       LEFT JOIN issues i ON i.id = al.issue_id
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.workspace_id = $1
       ORDER BY al.created_at DESC LIMIT $2`,
      [workspaceId, limit]
    );
    return { activity: rows };
  });

  app.get('/issues/:issueId', async (request, reply) => {
    const { rows: access } = await app.db.query(
      `SELECT 1 FROM issues i
       JOIN teams t ON t.id = i.team_id
       JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
         AND wm.user_id = $2 AND wm.status = 'active'
       WHERE i.id = $1`,
      [request.params.issueId, request.user.sub]
    );
    if (!access.length) return reply.code(403).send({ error: 'Forbidden' });

    const { rows } = await app.db.query(
      `SELECT al.id, al.action, al.field_changed, al.old_value, al.new_value, al.created_at,
              u.name AS user_name
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.issue_id = $1
       ORDER BY al.created_at DESC LIMIT 100`,
      [request.params.issueId]
    );
    return { activity: rows };
  });
}
