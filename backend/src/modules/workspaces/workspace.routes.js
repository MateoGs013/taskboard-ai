import { z } from 'zod';
import { createWorkspace, listWorkspacesForUser, getWorkspaceById } from './workspace.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  name: z.string().min(1).max(120),
});

export default async function workspaceRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const workspaces = await listWorkspacesForUser(request.user.sub);
    return { workspaces };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const ws = await createWorkspace({ name: body.name, ownerId: request.user.sub });
    reply.code(201).send({ workspace: { ...ws, role: 'owner' } });
  });

  app.get('/:workspaceId', async (request, reply) => {
    const ws = await getWorkspaceById(request.params.workspaceId, request.user.sub);
    if (!ws) return reply.code(404).send({ error: 'Workspace not found' });
    return { workspace: ws };
  });
}
