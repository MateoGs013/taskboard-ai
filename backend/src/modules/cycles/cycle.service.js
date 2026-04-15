import { query, withTransaction } from '../../config/db.js';

async function assertTeamAccess(teamId, userId) {
  const { rows } = await query(
    `SELECT 1 FROM teams t
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE t.id = $1`,
    [teamId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('Team not found or forbidden'), { statusCode: 403 });
}

export async function listCycles({ teamId, userId }) {
  await assertTeamAccess(teamId, userId);
  const { rows } = await query(
    `SELECT c.*,
            COUNT(i.id) FILTER (WHERE i.is_archived = FALSE) AS issue_count,
            COUNT(i.id) FILTER (WHERE i.completed_at IS NOT NULL) AS completed_count,
            COALESCE(SUM(i.estimate) FILTER (WHERE i.is_archived = FALSE), 0) AS total_points,
            COALESCE(SUM(i.estimate) FILTER (WHERE i.completed_at IS NOT NULL), 0) AS completed_points
     FROM cycles c
     LEFT JOIN issues i ON i.cycle_id = c.id
     WHERE c.team_id = $1
     GROUP BY c.id
     ORDER BY c.start_date DESC`,
    [teamId]
  );
  return rows;
}

export async function getActiveCycle({ teamId, userId }) {
  await assertTeamAccess(teamId, userId);
  const { rows } = await query(
    `SELECT * FROM cycles
     WHERE team_id = $1 AND status = 'active'
     ORDER BY start_date DESC LIMIT 1`,
    [teamId]
  );
  return rows[0] || null;
}

export async function createCycle({ teamId, userId, name, startDate, endDate }) {
  await assertTeamAccess(teamId, userId);
  return withTransaction(async (client) => {
    const { rows: numRows } = await client.query(
      `SELECT COALESCE(MAX(number), 0) + 1 AS next FROM cycles WHERE team_id = $1`,
      [teamId]
    );
    const number = numRows[0].next;
    const { rows } = await client.query(
      `INSERT INTO cycles (team_id, number, name, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [teamId, number, name || null, startDate, endDate]
    );
    return rows[0];
  });
}

export async function startCycle({ cycleId, userId }) {
  const { rows: meta } = await query(
    `SELECT c.team_id FROM cycles c WHERE c.id = $1`,
    [cycleId]
  );
  if (!meta.length) throw Object.assign(new Error('Cycle not found'), { statusCode: 404 });
  await assertTeamAccess(meta[0].team_id, userId);
  const { rows } = await query(
    `UPDATE cycles SET status = 'active' WHERE id = $1 RETURNING *`,
    [cycleId]
  );
  return rows[0];
}

export async function completeCycle({ cycleId, userId }) {
  const { rows: meta } = await query(
    `SELECT c.team_id FROM cycles c WHERE c.id = $1`,
    [cycleId]
  );
  if (!meta.length) throw Object.assign(new Error('Cycle not found'), { statusCode: 404 });
  await assertTeamAccess(meta[0].team_id, userId);
  const { rows } = await query(
    `UPDATE cycles SET status = 'completed' WHERE id = $1 RETURNING *`,
    [cycleId]
  );
  return rows[0];
}

export async function deleteCycle({ cycleId, userId }) {
  const { rows: meta } = await query(
    `SELECT team_id FROM cycles WHERE id = $1`,
    [cycleId]
  );
  if (!meta.length) throw Object.assign(new Error('Cycle not found'), { statusCode: 404 });
  await assertTeamAccess(meta[0].team_id, userId);
  await query('DELETE FROM cycles WHERE id = $1', [cycleId]);
}
