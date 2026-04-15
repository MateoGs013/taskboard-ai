import { query } from '../../config/db.js';

async function assertWorkspaceAccess(workspaceId, userId) {
  const { rows } = await query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
    [workspaceId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  return rows[0].role;
}

export async function listLabels({ workspaceId, teamId, userId }) {
  await assertWorkspaceAccess(workspaceId, userId);
  const params = [workspaceId];
  let teamFilter = 'AND team_id IS NULL';
  if (teamId) {
    params.push(teamId);
    teamFilter = 'AND (team_id IS NULL OR team_id = $2)';
  }
  const { rows } = await query(
    `SELECT id, workspace_id, team_id, name, color, description, created_at
     FROM labels
     WHERE workspace_id = $1 ${teamFilter}
     ORDER BY name ASC`,
    params
  );
  return rows;
}

export async function createLabel({ workspaceId, teamId, userId, name, color, description }) {
  await assertWorkspaceAccess(workspaceId, userId);
  const { rows } = await query(
    `INSERT INTO labels (workspace_id, team_id, name, color, description)
     VALUES ($1, $2, $3, COALESCE($4, '#6B7280'), $5)
     RETURNING *`,
    [workspaceId, teamId || null, name, color, description || null]
  );
  return rows[0];
}

export async function deleteLabel({ labelId, userId }) {
  const { rows } = await query(
    `SELECT l.workspace_id FROM labels l WHERE l.id = $1`,
    [labelId]
  );
  if (!rows.length) throw Object.assign(new Error('Label not found'), { statusCode: 404 });
  await assertWorkspaceAccess(rows[0].workspace_id, userId);
  await query('DELETE FROM labels WHERE id = $1', [labelId]);
}
