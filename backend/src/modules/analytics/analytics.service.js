import { query } from '../../config/db.js';

async function assertTeamAccess(teamId, userId) {
  const { rows } = await query(
    `SELECT 1 FROM teams t
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE t.id = $1`,
    [teamId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('Team forbidden'), { statusCode: 403 });
}

export async function velocityByCycle({ teamId, userId, limit = 10 }) {
  await assertTeamAccess(teamId, userId);
  const { rows } = await query(
    `SELECT c.id, c.number, c.name, c.start_date, c.end_date, c.status,
            COUNT(i.id) FILTER (WHERE i.is_archived = FALSE) AS planned_count,
            COUNT(i.id) FILTER (WHERE i.completed_at IS NOT NULL) AS completed_count,
            COALESCE(SUM(i.estimate) FILTER (WHERE i.is_archived = FALSE), 0)::float AS planned_points,
            COALESCE(SUM(i.estimate) FILTER (WHERE i.completed_at IS NOT NULL), 0)::float AS completed_points
     FROM cycles c
     LEFT JOIN issues i ON i.cycle_id = c.id
     WHERE c.team_id = $1 AND c.status IN ('completed', 'active')
     GROUP BY c.id
     ORDER BY c.start_date DESC
     LIMIT $2`,
    [teamId, limit]
  );
  return rows.reverse();
}

export async function burndown({ teamId, userId, cycleId }) {
  await assertTeamAccess(teamId, userId);
  const { rows: cycleRows } = await query(
    `SELECT id, start_date, end_date, status FROM cycles WHERE id = $1 AND team_id = $2`,
    [cycleId, teamId]
  );
  if (!cycleRows.length) throw Object.assign(new Error('Cycle not found'), { statusCode: 404 });
  const cycle = cycleRows[0];

  // Total scope (story points)
  const { rows: scopeRows } = await query(
    `SELECT COALESCE(SUM(estimate), 0)::float AS total,
            COUNT(*) AS count_total
     FROM issues
     WHERE cycle_id = $1 AND is_archived = FALSE`,
    [cycleId]
  );
  const total = scopeRows[0].total || scopeRows[0].count_total; // fallback to issue count

  // Daily completion deltas
  const { rows: completedRows } = await query(
    `SELECT DATE(completed_at) AS day,
            COALESCE(SUM(estimate), 0)::float AS pts,
            COUNT(*) AS cnt
     FROM issues
     WHERE cycle_id = $1 AND completed_at IS NOT NULL
     GROUP BY day ORDER BY day ASC`,
    [cycleId]
  );

  // Build day-by-day series from start to today (or end)
  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const today = new Date();
  const lastDay = today < end ? today : end;
  const series = [];
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  let remaining = total;
  const completedMap = new Map(completedRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.pts || r.cnt)]));

  for (let d = new Date(start); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const drop = completedMap.get(key) || 0;
    remaining -= drop;
    const dayIndex = Math.round((d - start) / 86400000);
    const ideal = Math.max(0, total - (total / totalDays) * dayIndex);
    series.push({
      day: key,
      remaining: Math.max(0, +remaining.toFixed(2)),
      ideal: +ideal.toFixed(2),
    });
  }

  return {
    cycle: { id: cycle.id, start_date: cycle.start_date, end_date: cycle.end_date, status: cycle.status },
    total,
    series,
  };
}

export async function distribution({ teamId, userId }) {
  await assertTeamAccess(teamId, userId);
  const [byStatus, byPriority, byAssignee, byType] = await Promise.all([
    query(
      `SELECT ws.id, ws.name, ws.color, ws.type,
              COUNT(i.id) FILTER (WHERE i.is_archived = FALSE) AS count
       FROM workflow_statuses ws
       LEFT JOIN issues i ON i.status_id = ws.id
       WHERE ws.team_id = $1
       GROUP BY ws.id ORDER BY ws.position ASC`,
      [teamId]
    ),
    query(
      `SELECT priority, COUNT(*) AS count
       FROM issues WHERE team_id = $1 AND is_archived = FALSE
       GROUP BY priority ORDER BY priority ASC`,
      [teamId]
    ),
    query(
      `SELECT u.id, u.name, COUNT(*) AS count
       FROM issues i
       LEFT JOIN users u ON u.id = i.assignee_id
       WHERE i.team_id = $1 AND i.is_archived = FALSE AND i.assignee_id IS NOT NULL
       GROUP BY u.id ORDER BY count DESC LIMIT 10`,
      [teamId]
    ),
    query(
      `SELECT type, COUNT(*) AS count FROM issues
       WHERE team_id = $1 AND is_archived = FALSE
       GROUP BY type`,
      [teamId]
    ),
  ]);
  return {
    by_status: byStatus.rows,
    by_priority: byPriority.rows,
    by_assignee: byAssignee.rows,
    by_type: byType.rows,
  };
}

export async function throughput({ teamId, userId, weeks = 8 }) {
  await assertTeamAccess(teamId, userId);
  const { rows } = await query(
    `SELECT
       date_trunc('week', completed_at)::date AS week,
       COUNT(*) AS count,
       COALESCE(SUM(estimate), 0)::float AS pts
     FROM issues
     WHERE team_id = $1 AND completed_at >= NOW() - ($2 || ' weeks')::interval
     GROUP BY week ORDER BY week ASC`,
    [teamId, weeks]
  );
  return rows;
}
