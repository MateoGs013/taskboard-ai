import { z } from 'zod';
import { listLabels, createLabel, deleteLabel } from './label.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  workspace_id: z.string().uuid(),
  team_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

export default async function labelRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    const labels = await listLabels({
      workspaceId,
      teamId: request.query?.team_id,
      userId: request.user.sub,
    });
    return { labels };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const label = await createLabel({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      name: body.name,
      color: body.color,
      description: body.description,
    });
    reply.code(201).send({ label });
  });

  app.delete('/:labelId', async (request, reply) => {
    await deleteLabel({ labelId: request.params.labelId, userId: request.user.sub });
    reply.code(204).send();
  });
}
