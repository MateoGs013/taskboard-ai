import { query, withTransaction } from '../../config/db.js';
import { slugify } from '../../utils/slug.js';

const DEFAULT_STATUSES = [
  { name: 'Backlog',     color: '#6b7280', type: 'backlog',    position: 0 },
  { name: 'Todo',        color: '#3b82f6', type: 'unstarted',  position: 1 },
  { name: 'In Progress', color: '#eab308', type: 'started',    position: 2 },
  { name: 'In Review',   color: '#a855f7', type: 'started',    position: 3 },
  { name: 'Done',        color: '#10b981', type: 'completed',  position: 4 },
  { name: 'Cancelled',   color: '#ef4444', type: 'cancelled',  position: 5 },
];

export async function assertWorkspaceMember(workspaceId, userId) {
  const { rows } = await query(
    `SELECT role FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
    [workspaceId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Not a workspace member'), { statusCode: 403 });
  }
  return rows[0].role;
}

export async function createTeam({ workspaceId, userId, name, identifier }) {
  const role = await assertWorkspaceMember(workspaceId, userId);
  if (!['owner', 'admin', 'member'].includes(role)) {
    throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
  }

  const slug = slugify(name) || 'team';
  const ident = (identifier || slugify(name).slice(0, 4) || 'TM').toUpperCase();

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO teams (workspace_id, name, slug, identifier)
       VALUES ($1, $2, $3, $4)
       RETURNING id, workspace_id, name, slug, identifier, icon, description,
                 cycle_duration, issue_counter, settings, created_at`,
      [workspaceId, name, slug, ident]
    );
    const team = rows[0];

    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'lead')`,
      [team.id, userId]
    );

    for (const s of DEFAULT_STATUSES) {
      await client.query(
        `INSERT INTO workflow_statuses (team_id, name, color, type, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [team.id, s.name, s.color, s.type, s.position]
      );
    }

    return team;
  });
}

export async function listTeamsInWorkspace({ workspaceId, userId }) {
  await assertWorkspaceMember(workspaceId, userId);
  const { rows } = await query(
    `SELECT t.id, t.name, t.slug, t.identifier, t.icon, t.description,
            t.cycle_duration, t.issue_counter, t.created_at,
            COALESCE(tm.role, NULL) AS member_role
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
     WHERE t.workspace_id = $1
     ORDER BY t.created_at ASC`,
    [workspaceId, userId]
  );
  return rows;
}

export async function getTeamById({ teamId, userId }) {
  const { rows } = await query(
    `SELECT t.*, tm.role AS member_role
     FROM teams t
     JOIN workspace_members wm
       ON wm.workspace_id = t.workspace_id AND wm.user_id = $2 AND wm.status = 'active'
     LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
     WHERE t.id = $1`,
    [teamId, userId]
  );
  return rows[0] || null;
}

export async function listWorkflowStatuses(teamId) {
  const { rows } = await query(
    `SELECT id, team_id, name, color, type, position, wip_limit, description
     FROM workflow_statuses
     WHERE team_id = $1
     ORDER BY position ASC`,
    [teamId]
  );
  return rows;
}

export async function listTeamMembers(teamId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, tm.role, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at ASC`,
    [teamId]
  );
  return rows;
}
