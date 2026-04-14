import { query, withTransaction } from '../../config/db.js';
import { uniqueSlug } from '../../utils/slug.js';

export async function createWorkspace({ name, ownerId }) {
  const slug = uniqueSlug(name);
  return withTransaction(async (client) => {
    const { rows: ws } = await client.query(
      `INSERT INTO workspaces (name, slug) VALUES ($1, $2)
       RETURNING id, name, slug, plan, settings, created_at`,
      [name, slug]
    );
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [ws[0].id, ownerId]
    );
    return ws[0];
  });
}

export async function listWorkspacesForUser(userId) {
  const { rows } = await query(
    `SELECT w.id, w.name, w.slug, w.plan, w.settings, w.created_at, m.role
     FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = $1 AND m.status = 'active'
     ORDER BY w.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getWorkspaceById(id, userId) {
  const { rows } = await query(
    `SELECT w.id, w.name, w.slug, w.plan, w.settings, w.created_at, m.role
     FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.id
     WHERE w.id = $1 AND m.user_id = $2 AND m.status = 'active'`,
    [id, userId]
  );
  return rows[0] || null;
}
