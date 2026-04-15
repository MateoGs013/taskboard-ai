import { z } from 'zod';
import {
  createTeam,
  listTeamsInWorkspace,
  getTeamById,
  listWorkflowStatuses,
  listTeamMembers,
  createStatus,
  deleteStatus,
  reorderStatuses,
} from './team.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  identifier: z.string().min(1).max(6).regex(/^[A-Za-z0-9]+$/).optional(),
});

const UpdateStatusBody = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
  wip_limit: z.number().int().min(0).nullable().optional(),
});

const CreateStatusBody = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  type: z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']),
  position: z.number().int().min(0).optional(),
  wip_limit: z.number().int().min(0).nullable().optional(),
});

const ReorderBody = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export default async function teamRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    const teams = await listTeamsInWorkspace({ workspaceId, userId: request.user.sub });
    return { teams };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const team = await createTeam({
      workspaceId: body.workspace_id,
      userId: request.user.sub,
      name: body.name,
      identifier: body.identifier,
    });
    reply.code(201).send({ team });
  });

  app.get('/:teamId', async (request, reply) => {
    const team = await getTeamById({ teamId: request.params.teamId, userId: request.user.sub });
    if (!team) return reply.code(404).send({ error: 'Team not found' });
    return { team };
  });

  app.get('/:teamId/statuses', async (request) => {
    const statuses = await listWorkflowStatuses(request.params.teamId);
    return { statuses };
  });

  app.patch('/:teamId/statuses/:statusId', async (request, reply) => {
    const body = UpdateStatusBody.parse(request.body);
    const keys = Object.keys(body);
    if (!keys.length) return reply.code(400).send({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await request.server.db.query(
      `UPDATE workflow_statuses SET ${sets} WHERE id = $${keys.length + 1} AND team_id = $${keys.length + 2} RETURNING *`,
      [...keys.map((k) => body[k]), request.params.statusId, request.params.teamId]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Status not found' });
    return { status: rows[0] };
  });

  app.post('/:teamId/statuses', async (request, reply) => {
    const body = CreateStatusBody.parse(request.body);
    const status = await createStatus({
      teamId: request.params.teamId,
      userId: request.user.sub,
      name: body.name,
      color: body.color,
      type: body.type,
      position: body.position,
      wipLimit: body.wip_limit,
    });
    reply.code(201).send({ status });
  });

  app.delete('/:teamId/statuses/:statusId', async (request, reply) => {
    await deleteStatus({
      teamId: request.params.teamId,
      statusId: request.params.statusId,
      userId: request.user.sub,
      reassignTo: request.query?.reassign_to || null,
    });
    reply.code(204).send();
  });

  app.post('/:teamId/statuses/reorder', async (request, reply) => {
    const body = ReorderBody.parse(request.body);
    await reorderStatuses({
      teamId: request.params.teamId,
      userId: request.user.sub,
      orderedIds: body.ordered_ids,
    });
    reply.code(204).send();
  });

  app.get('/:teamId/members', async (request) => {
    const members = await listTeamMembers(request.params.teamId);
    return { members };
  });
}
