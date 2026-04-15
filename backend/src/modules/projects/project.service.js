import { query } from '../../config/db.js';
import { slugify } from '../../utils/slug.js';

async function assertTeamAccess(teamId, userId) {
  const { rows } = await query(
    `SELECT wm.role AS ws_role, tm.role AS tm_role
     FROM teams t
     JOIN workspace_members wm
       ON wm.workspace_id = t.workspace_id AND wm.user_id = $2 AND wm.status = 'active'
     LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
     WHERE t.id = $1`,
    [teamId, userId]
  );
  if (!rows.length) {
    throw Object.assign(new Error('Team not found or forbidden'), { statusCode: 403 });
  }
  return rows[0];
}

export async function listProjects({ teamId, userId }) {
  await assertTeamAccess(teamId, userId);
  const { rows } = await query(
    `SELECT p.*,
            u.name AS lead_name,
            u.avatar_url AS lead_avatar
     FROM projects p
     LEFT JOIN users u ON u.id = p.lead_user_id
     WHERE p.team_id = $1
     ORDER BY p.sort_order ASC, p.created_at ASC`,
    [teamId]
  );
  return rows;
}

export async function createProject({ teamId, userId, name, description, color, icon, lead_user_id }) {
  await assertTeamAccess(teamId, userId);
  const slug = slugify(name) || 'project';
  const { rows } = await query(
    `INSERT INTO projects (team_id, name, slug, description, color, icon, lead_user_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, '#3B82F6'), $6, $7)
     RETURNING *`,
    [teamId, name, slug, description || null, color, icon, lead_user_id || userId]
  );
  return rows[0];
}

export async function getProject({ projectId, userId }) {
  const { rows } = await query(
    `SELECT p.*
     FROM projects p
     JOIN teams t ON t.id = p.team_id
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = $2 AND wm.status = 'active'
     WHERE p.id = $1`,
    [projectId, userId]
  );
  return rows[0] || null;
}

export async function updateProject({ projectId, userId, patch }) {
  await getProjectOrThrow(projectId, userId);
  const keys = Object.keys(patch);
  if (!keys.length) return getProject({ projectId, userId });
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const { rows } = await query(
    `UPDATE projects SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => patch[k]), projectId]
  );
  return rows[0];
}

async function getProjectOrThrow(projectId, userId) {
  const p = await getProject({ projectId, userId });
  if (!p) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  return p;
}
