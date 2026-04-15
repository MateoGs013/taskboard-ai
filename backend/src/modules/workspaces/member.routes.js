import { z } from 'zod';
import crypto from 'node:crypto';
import { query, withTransaction } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'guest']),
});

const UpdateMemberBody = z.object({
  role: z.enum(['owner', 'admin', 'member', 'guest']).optional(),
  status: z.enum(['active', 'deactivated']).optional(),
});

async function assertAdmin(workspaceId, userId) {
  const { rows } = await query(
    `SELECT role FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
    [workspaceId, userId]
  );
  if (!rows.length || !['owner', 'admin'].includes(rows[0].role)) {
    throw Object.assign(new Error('Admin-only'), { statusCode: 403 });
  }
  return rows[0].role;
}

export default async function memberRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/:workspaceId/members', async (request, reply) => {
    const { rows: access } = await app.db.query(
      `SELECT 1 FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
      [request.params.workspaceId, request.user.sub]
    );
    if (!access.length) return reply.code(403).send({ error: 'Forbidden' });

    const { rows } = await app.db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.status, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at ASC`,
      [request.params.workspaceId]
    );
    return { members: rows };
  });

  app.post('/:workspaceId/invitations', async (request, reply) => {
    const body = InviteBody.parse(request.body);
    await assertAdmin(request.params.workspaceId, request.user.sub);

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 14 * 86400000);

    const { rows } = await app.db.query(
      `INSERT INTO invitations (workspace_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, token, expires_at`,
      [request.params.workspaceId, body.email, body.role, token, request.user.sub, expiresAt]
    );
    reply.code(201).send({ invitation: rows[0] });
  });

  app.get('/:workspaceId/invitations', async (request, reply) => {
    await assertAdmin(request.params.workspaceId, request.user.sub);
    const { rows } = await app.db.query(
      `SELECT id, email, role, token, expires_at, accepted_at, created_at
       FROM invitations
       WHERE workspace_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [request.params.workspaceId]
    );
    return { invitations: rows };
  });

  app.delete('/:workspaceId/invitations/:id', async (request, reply) => {
    await assertAdmin(request.params.workspaceId, request.user.sub);
    await app.db.query(
      `DELETE FROM invitations WHERE id = $1 AND workspace_id = $2`,
      [request.params.id, request.params.workspaceId]
    );
    reply.code(204).send();
  });

  app.patch('/:workspaceId/members/:userId', async (request, reply) => {
    const body = UpdateMemberBody.parse(request.body);
    const role = await assertAdmin(request.params.workspaceId, request.user.sub);
    if (request.params.userId === request.user.sub) {
      return reply.code(400).send({ error: 'Cannot modify your own role' });
    }
    if (body.role === 'owner' && role !== 'owner') {
      return reply.code(403).send({ error: 'Only owners can grant owner role' });
    }
    const keys = Object.keys(body);
    if (!keys.length) return reply.code(400).send({ error: 'No changes' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await app.db.query(
      `UPDATE workspace_members SET ${sets}
       WHERE workspace_id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
      [...keys.map((k) => body[k]), request.params.workspaceId, request.params.userId]
    );
    reply.code(204).send();
  });

  app.delete('/:workspaceId/members/:userId', async (request, reply) => {
    await assertAdmin(request.params.workspaceId, request.user.sub);
    if (request.params.userId === request.user.sub) {
      return reply.code(400).send({ error: 'Use leave workspace instead' });
    }
    await app.db.query(
      `DELETE FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND role <> 'owner'`,
      [request.params.workspaceId, request.params.userId]
    );
    reply.code(204).send();
  });

  // Public-ish: lookup invitation by token (requires auth to bind to user)
  app.get('/invitations/by-token/:token', async (request, reply) => {
    const { rows } = await app.db.query(
      `SELECT i.id, i.email, i.role, i.workspace_id, i.expires_at, i.accepted_at,
              w.name AS workspace_name, w.slug AS workspace_slug,
              u.name AS inviter_name
       FROM invitations i
       JOIN workspaces w ON w.id = i.workspace_id
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.token = $1`,
      [request.params.token]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Invitation not found' });
    return { invitation: rows[0] };
  });

  app.post('/invitations/by-token/:token/accept', async (request, reply) => {
    const userId = request.user.sub;
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM invitations WHERE token = $1 FOR UPDATE`,
        [request.params.token]
      );
      if (!rows.length) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
      const inv = rows[0];
      if (inv.accepted_at) throw Object.assign(new Error('Already accepted'), { statusCode: 400 });
      if (new Date(inv.expires_at) < new Date()) {
        throw Object.assign(new Error('Invitation expired'), { statusCode: 400 });
      }

      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET status = 'active'`,
        [inv.workspace_id, userId, inv.role]
      );
      await client.query(
        `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
        [inv.id]
      );
      return { workspace_id: inv.workspace_id };
    });
    reply.send(result);
  });
}
