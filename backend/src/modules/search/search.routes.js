import { query } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

export default async function searchRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const q = (request.query?.q || '').trim();
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    if (q.length < 1) return { issues: [], projects: [], cycles: [] };

    const userId = request.user.sub;
    const isIdentifierLike = /^[A-Za-z]+-?\d*$/.test(q);
    const pattern = `%${q}%`;

    const [issues, projects, cycles] = await Promise.all([
      app.db.query(
        `SELECT i.id, i.identifier, i.title, i.priority, i.team_id,
                t.name AS team_name, t.identifier AS team_identifier
         FROM issues i
         JOIN teams t ON t.id = i.team_id
         JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
           AND wm.user_id = $1 AND wm.status = 'active'
         WHERE t.workspace_id = $2 AND i.is_archived = FALSE
           AND (
             ${isIdentifierLike ? 'i.identifier ILIKE $3 OR' : ''}
             i.title ILIKE $3
           )
         ORDER BY similarity(i.title, $4) DESC, i.created_at DESC
         LIMIT 20`,
        [userId, workspaceId, pattern, q]
      ),
      app.db.query(
        `SELECT p.id, p.name, p.color, p.team_id, t.name AS team_name
         FROM projects p
         JOIN teams t ON t.id = p.team_id
         JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
           AND wm.user_id = $1 AND wm.status = 'active'
         WHERE t.workspace_id = $2 AND p.name ILIKE $3
         ORDER BY similarity(p.name, $4) DESC LIMIT 10`,
        [userId, workspaceId, pattern, q]
      ),
      app.db.query(
        `SELECT c.id, c.number, c.name, c.team_id, t.name AS team_name
         FROM cycles c
         JOIN teams t ON t.id = c.team_id
         JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
           AND wm.user_id = $1 AND wm.status = 'active'
         WHERE t.workspace_id = $2 AND (c.name ILIKE $3 OR ('cycle ' || c.number) ILIKE $3)
         ORDER BY c.start_date DESC LIMIT 10`,
        [userId, workspaceId, pattern]
      ),
    ]);

    return {
      issues: issues.rows,
      projects: projects.rows,
      cycles: cycles.rows,
    };
  });
}
