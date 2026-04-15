import { query, withTransaction } from '../../config/db.js';
import { rankBetween } from '../../utils/lexorank.js';
import { notify } from '../notifications/notification.service.js';
import { emitIssueEvent, emitToUser } from './issue.events.js';
import { dispatch as dispatchWebhook } from '../webhooks/webhook.service.js';

async function workspaceIdForTeam(teamId) {
  const { rows } = await query(`SELECT workspace_id FROM teams WHERE id = $1`, [teamId]);
  return rows[0]?.workspace_id;
}

const SELECT_ISSUE = `
  i.id, i.team_id, i.project_id, i.parent_id, i.cycle_id, i.status_id,
  i.identifier, i.number, i.title, i.description, i.description_html,
  i.priority, i.type, i.assignee_id, i.reporter_id, i.estimate,
  i.start_date, i.due_date, i.sort_order, i.is_archived, i.completed_at,
  i.created_at, i.updated_at,
  u_assignee.name AS assignee_name,
  u_assignee.avatar_url AS assignee_avatar,
  u_reporter.name AS reporter_name,
  COALESCE(
    json_agg(
      json_build_object('id', l.id, 'name', l.name, 'color', l.color)
      ORDER BY l.name
    ) FILTER (WHERE l.id IS NOT NULL),
    '[]'::json
  ) AS labels
`;

const FROM_ISSUE = `
  FROM issues i
  LEFT JOIN users u_assignee ON u_assignee.id = i.assignee_id
  LEFT JOIN users u_reporter ON u_reporter.id = i.reporter_id
  LEFT JOIN issue_labels il ON il.issue_id = i.id
  LEFT JOIN labels l ON l.id = il.label_id
`;

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

export async function listIssues({ teamId, userId, filters = {} }) {
  await assertTeamAccess(teamId, userId);
  const conditions = ['i.team_id = $1', 'i.is_archived = FALSE'];
  const params = [teamId];
  let idx = 2;

  if (filters.project_id) {
    conditions.push(`i.project_id = $${idx++}`);
    params.push(filters.project_id);
  }
  if (filters.status_id) {
    conditions.push(`i.status_id = $${idx++}`);
    params.push(filters.status_id);
  }
  if (filters.assignee_id) {
    conditions.push(`i.assignee_id = $${idx++}`);
    params.push(filters.assignee_id);
  }
  if (filters.cycle_id) {
    conditions.push(`i.cycle_id = $${idx++}`);
    params.push(filters.cycle_id);
  }

  const { rows } = await query(
    `SELECT ${SELECT_ISSUE}
     ${FROM_ISSUE}
     WHERE ${conditions.join(' AND ')}
     GROUP BY i.id, u_assignee.id, u_reporter.id
     ORDER BY i.sort_order ASC, i.created_at ASC`,
    params
  );
  return rows;
}

export async function getIssue({ issueId, userId }) {
  const { rows } = await query(
    `SELECT ${SELECT_ISSUE}
     ${FROM_ISSUE}
     JOIN teams t ON t.id = i.team_id
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE i.id = $1
     GROUP BY i.id, u_assignee.id, u_reporter.id`,
    [issueId, userId]
  );
  return rows[0] || null;
}

async function nextSortOrder(client, teamId, statusId) {
  const { rows } = await client.query(
    `SELECT sort_order FROM issues
     WHERE team_id = $1 AND status_id = $2 AND is_archived = FALSE
     ORDER BY sort_order DESC LIMIT 1`,
    [teamId, statusId]
  );
  const last = rows[0]?.sort_order || '';
  return rankBetween(last, '');
}

export async function createIssue({ teamId, userId, payload }) {
  await assertTeamAccess(teamId, userId);

  return withTransaction(async (client) => {
    // Default status = lowest position (backlog)
    let statusId = payload.status_id;
    if (!statusId) {
      const { rows } = await client.query(
        `SELECT id FROM workflow_statuses WHERE team_id = $1 ORDER BY position ASC LIMIT 1`,
        [teamId]
      );
      if (!rows.length) throw new Error('No workflow statuses configured for team');
      statusId = rows[0].id;
    }

    // Atomic counter + identifier
    const { rows: counterRows } = await client.query(
      `UPDATE teams SET issue_counter = issue_counter + 1
       WHERE id = $1
       RETURNING issue_counter, identifier`,
      [teamId]
    );
    const { issue_counter: number, identifier: prefix } = counterRows[0];
    const identifier = `${prefix}-${number}`;

    const sortOrder = await nextSortOrder(client, teamId, statusId);

    const { rows: issueRows } = await client.query(
      `INSERT INTO issues (
         team_id, project_id, parent_id, cycle_id, status_id,
         identifier, number, title, description,
         priority, type, assignee_id, reporter_id, estimate,
         start_date, due_date, sort_order
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         COALESCE($10, 4), COALESCE($11, 'task'), $12, $13, $14, $15, $16, $17
       ) RETURNING id`,
      [
        teamId,
        payload.project_id || null,
        payload.parent_id || null,
        payload.cycle_id || null,
        statusId,
        identifier,
        number,
        payload.title,
        payload.description || null,
        payload.priority,
        payload.type,
        payload.assignee_id || null,
        userId,
        payload.estimate || null,
        payload.start_date || null,
        payload.due_date || null,
        sortOrder,
      ]
    );
    const issueId = issueRows[0].id;

    if (Array.isArray(payload.label_ids) && payload.label_ids.length) {
      const valuesSql = payload.label_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO issue_labels (issue_id, label_id) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
        [issueId, ...payload.label_ids]
      );
    }

    await client.query(
      `INSERT INTO activity_log (issue_id, user_id, action, new_value)
       VALUES ($1, $2, 'created', $3::jsonb)`,
      [issueId, userId, JSON.stringify({ identifier })]
    );

    if (payload.assignee_id) {
      const wsId = await workspaceIdForTeam(teamId);
      await notify({
        userId: payload.assignee_id,
        workspaceId: wsId,
        issueId,
        actorId: userId,
        type: 'assigned',
        title: `Te asignaron ${identifier}`,
        body: payload.title,
      }).catch(() => {});
    }

    // Re-read with joins
    const { rows: finalRows } = await client.query(
      `SELECT ${SELECT_ISSUE}
       ${FROM_ISSUE}
       WHERE i.id = $1
       GROUP BY i.id, u_assignee.id, u_reporter.id`,
      [issueId]
    );
    const fresh = finalRows[0];
    const wsId = await workspaceIdForTeam(teamId);
    emitIssueEvent({ event: 'issue.created', workspaceId: wsId, issueId, payload: { issue: fresh } });
    dispatchWebhook({ workspaceId: wsId, event: 'issue.created', payload: { issue: fresh } });
    await client.query(
      `UPDATE activity_log SET workspace_id = $1 WHERE issue_id = $2 AND workspace_id IS NULL`,
      [wsId, issueId]
    );
    return fresh;
  });
}

export async function updateIssue({ issueId, userId, patch }) {
  const existing = await getIssue({ issueId, userId });
  if (!existing) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });

  const allowed = [
    'title', 'description', 'priority', 'type', 'assignee_id',
    'project_id', 'cycle_id', 'estimate', 'start_date', 'due_date',
  ];
  const keys = Object.keys(patch).filter((k) => allowed.includes(k));
  if (!keys.length) return existing;

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await query(
    `UPDATE issues SET ${sets} WHERE id = $${keys.length + 1}`,
    [...keys.map((k) => patch[k]), issueId]
  );

  await query(
    `INSERT INTO activity_log (issue_id, user_id, action, new_value)
     VALUES ($1, $2, 'updated', $3::jsonb)`,
    [issueId, userId, JSON.stringify(patch)]
  );

  const wsId = await workspaceIdForTeam(existing.team_id);

  if ('assignee_id' in patch && patch.assignee_id && patch.assignee_id !== existing.assignee_id) {
    await notify({
      userId: patch.assignee_id,
      workspaceId: wsId,
      issueId,
      actorId: userId,
      type: 'assigned',
      title: `Te asignaron ${existing.identifier}`,
      body: existing.title,
    }).catch(() => {});
  }

  const updated = await getIssue({ issueId, userId });
  emitIssueEvent({ event: 'issue.updated', workspaceId: wsId, issueId, payload: { issue: updated } });
  dispatchWebhook({ workspaceId: wsId, event: 'issue.updated', payload: { issue: updated, patch } });
  return updated;
}

export async function moveIssue({ issueId, userId, statusId, beforeId, afterId }) {
  const existing = await getIssue({ issueId, userId });
  if (!existing) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });

  return withTransaction(async (client) => {
    let leftRank = '';
    let rightRank = '';

    if (beforeId) {
      const { rows } = await client.query('SELECT sort_order FROM issues WHERE id = $1', [beforeId]);
      if (rows[0]) leftRank = rows[0].sort_order;
    }
    if (afterId) {
      const { rows } = await client.query('SELECT sort_order FROM issues WHERE id = $1', [afterId]);
      if (rows[0]) rightRank = rows[0].sort_order;
    }

    // If only target status + no neighbours given → append to end
    let newRank;
    if (!beforeId && !afterId) {
      const { rows } = await client.query(
        `SELECT sort_order FROM issues
         WHERE team_id = $1 AND status_id = $2 AND id <> $3 AND is_archived = FALSE
         ORDER BY sort_order DESC LIMIT 1`,
        [existing.team_id, statusId || existing.status_id, issueId]
      );
      leftRank = rows[0]?.sort_order || '';
      rightRank = '';
    }
    newRank = rankBetween(leftRank, rightRank);

    const completedAtExpr = statusId
      ? `(SELECT CASE WHEN type = 'completed' THEN NOW() ELSE NULL END FROM workflow_statuses WHERE id = $2)`
      : 'completed_at';

    const sql = statusId
      ? `UPDATE issues SET status_id = $2, sort_order = $3, completed_at = ${completedAtExpr}
         WHERE id = $1 RETURNING id`
      : `UPDATE issues SET sort_order = $2 WHERE id = $1 RETURNING id`;
    const params = statusId ? [issueId, statusId, newRank] : [issueId, newRank];
    await client.query(sql, params);

    await client.query(
      `INSERT INTO activity_log (issue_id, user_id, action, old_value, new_value)
       VALUES ($1, $2, 'moved', $3::jsonb, $4::jsonb)`,
      [issueId, userId,
        JSON.stringify({ status_id: existing.status_id, sort_order: existing.sort_order }),
        JSON.stringify({ status_id: statusId || existing.status_id, sort_order: newRank })]
    );

    const moved = await getIssue({ issueId, userId });
    const wsId = await workspaceIdForTeam(existing.team_id);
    emitIssueEvent({ event: 'issue.moved', workspaceId: wsId, issueId, payload: { issue: moved, actor_id: userId } });
    dispatchWebhook({ workspaceId: wsId, event: 'issue.moved', payload: { issue: moved } });
    return moved;
  });
}

export async function archiveIssue({ issueId, userId }) {
  const existing = await getIssue({ issueId, userId });
  if (!existing) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  await query(`UPDATE issues SET is_archived = TRUE WHERE id = $1`, [issueId]);
}

// ============================================================
// COMMENTS
// ============================================================

export async function listComments({ issueId, userId }) {
  const issue = await getIssue({ issueId, userId });
  if (!issue) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  const { rows } = await query(
    `SELECT c.id, c.issue_id, c.user_id, c.parent_id, c.body,
            c.is_ai_generated, c.edited_at, c.created_at,
            u.name AS user_name, u.avatar_url AS user_avatar
     FROM comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.issue_id = $1
     ORDER BY c.created_at ASC`,
    [issueId]
  );
  return rows;
}

export async function createComment({ issueId, userId, body, parentId }) {
  const issue = await getIssue({ issueId, userId });
  if (!issue) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  const { rows } = await query(
    `INSERT INTO comments (issue_id, user_id, parent_id, body)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [issueId, userId, parentId || null, body]
  );
  const comment = rows[0];

  // Parse @mentions — resolve names in team members
  const wsId = await workspaceIdForTeam(issue.team_id);
  const mentionNames = Array.from(body.matchAll(/@([a-záéíóúñ][\w.-]+)/gi)).map((m) => m[1].toLowerCase());
  const mentionedIds = new Set();
  if (mentionNames.length) {
    const { rows: users } = await query(
      `SELECT DISTINCT u.id, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1`,
      [issue.team_id]
    );
    for (const u of users) {
      const first = u.name?.split(' ')[0]?.toLowerCase();
      const full = u.name?.toLowerCase().replace(/\s+/g, '');
      if (mentionNames.some((n) => n === first || n === full)) {
        mentionedIds.add(u.id);
      }
    }
    for (const uid of mentionedIds) {
      await query(
        `INSERT INTO comment_mentions (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [comment.id, uid]
      );
      await notify({
        userId: uid,
        workspaceId: wsId,
        issueId,
        actorId: userId,
        type: 'mentioned',
        title: `Te mencionaron en ${issue.identifier}`,
        body: body.slice(0, 140),
      }).catch(() => {});
    }
  }

  if (issue.assignee_id && !mentionedIds.has(issue.assignee_id)) {
    await notify({
      userId: issue.assignee_id,
      workspaceId: wsId,
      issueId,
      actorId: userId,
      type: 'commented',
      title: `Nuevo comentario en ${issue.identifier}`,
      body: body.slice(0, 140),
    }).catch(() => {});
  }
  emitIssueEvent({ event: 'comment.created', workspaceId: wsId, issueId, payload: { comment } });
  dispatchWebhook({ workspaceId: wsId, event: 'comment.created', payload: { comment, issue_id: issueId } });
  return comment;
}

// ============================================================
// LABELS ON ISSUE
// ============================================================

// ============================================================
// SUB-ISSUES (parent-child)
// ============================================================

export async function listSubIssues({ issueId, userId }) {
  const parent = await getIssue({ issueId, userId });
  if (!parent) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  const { rows } = await query(
    `SELECT ${SELECT_ISSUE}
     ${FROM_ISSUE}
     WHERE i.parent_id = $1
     GROUP BY i.id, u_assignee.id, u_reporter.id
     ORDER BY i.created_at ASC`,
    [issueId]
  );
  return rows;
}

// ============================================================
// RELATIONS
// ============================================================

const REVERSE = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  relates_to: 'relates_to',
  duplicate_of: 'duplicate_of',
};

export async function listRelations({ issueId, userId }) {
  const issue = await getIssue({ issueId, userId });
  if (!issue) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  const { rows } = await query(
    `SELECT r.id, r.type, r.created_at,
            r.related_issue_id,
            ri.identifier AS related_identifier,
            ri.title AS related_title,
            ri.status_id AS related_status_id
     FROM issue_relations r
     JOIN issues ri ON ri.id = r.related_issue_id
     WHERE r.issue_id = $1
     ORDER BY r.created_at ASC`,
    [issueId]
  );
  return rows;
}

export async function addRelation({ issueId, userId, relatedIssueId, type }) {
  const [issue, related] = await Promise.all([
    getIssue({ issueId, userId }),
    getIssue({ issueId: relatedIssueId, userId }),
  ]);
  if (!issue || !related) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  if (issueId === relatedIssueId) throw Object.assign(new Error('Cannot relate issue to itself'), { statusCode: 400 });

  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO issue_relations (issue_id, related_issue_id, type)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [issueId, relatedIssueId, type]
    );
    const reverse = REVERSE[type];
    if (reverse) {
      await client.query(
        `INSERT INTO issue_relations (issue_id, related_issue_id, type)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [relatedIssueId, issueId, reverse]
      );
    }
  });
}

export async function removeRelation({ relationId, userId }) {
  const { rows } = await query(
    `SELECT issue_id, related_issue_id, type FROM issue_relations WHERE id = $1`,
    [relationId]
  );
  if (!rows.length) throw Object.assign(new Error('Relation not found'), { statusCode: 404 });
  const { issue_id, related_issue_id, type } = rows[0];
  const issue = await getIssue({ issueId: issue_id, userId });
  if (!issue) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  return withTransaction(async (client) => {
    await client.query('DELETE FROM issue_relations WHERE id = $1', [relationId]);
    const reverse = REVERSE[type];
    if (reverse) {
      await client.query(
        `DELETE FROM issue_relations
         WHERE issue_id = $1 AND related_issue_id = $2 AND type = $3`,
        [related_issue_id, issue_id, reverse]
      );
    }
  });
}

export async function setIssueLabels({ issueId, userId, labelIds }) {
  const issue = await getIssue({ issueId, userId });
  if (!issue) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  return withTransaction(async (client) => {
    await client.query('DELETE FROM issue_labels WHERE issue_id = $1', [issueId]);
    if (labelIds.length) {
      const valuesSql = labelIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO issue_labels (issue_id, label_id) VALUES ${valuesSql}`,
        [issueId, ...labelIds]
      );
    }
    return getIssue({ issueId, userId });
  });
}
