import { query } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const lines = [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))];
  return lines.join('\n');
}

export default async function exportRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/issues', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const format = request.query?.format === 'csv' ? 'csv' : 'json';

    // Check access
    const { rows: access } = await app.db.query(
      `SELECT 1 FROM teams t
       JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
         AND wm.user_id = $2 AND wm.status = 'active'
       WHERE t.id = $1`,
      [teamId, request.user.sub]
    );
    if (!access.length) return reply.code(403).send({ error: 'Forbidden' });

    const { rows } = await app.db.query(
      `SELECT i.identifier, i.title, i.description, i.type, i.priority,
              ws.name AS status, u.name AS assignee, r.name AS reporter,
              i.estimate, i.start_date, i.due_date, i.completed_at,
              i.created_at, i.updated_at,
              COALESCE(string_agg(l.name, ';' ORDER BY l.name), '') AS labels
       FROM issues i
       JOIN workflow_statuses ws ON ws.id = i.status_id
       LEFT JOIN users u ON u.id = i.assignee_id
       LEFT JOIN users r ON r.id = i.reporter_id
       LEFT JOIN issue_labels il ON il.issue_id = i.id
       LEFT JOIN labels l ON l.id = il.label_id
       WHERE i.team_id = $1 AND i.is_archived = FALSE
       GROUP BY i.id, ws.name, u.name, r.name
       ORDER BY i.created_at ASC`,
      [teamId]
    );

    const ts = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="issues-${ts}.csv"`);
      return reply.send(toCsv(rows));
    }
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="issues-${ts}.json"`);
    return reply.send({ exported_at: new Date().toISOString(), count: rows.length, issues: rows });
  });
}
