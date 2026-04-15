import { z } from 'zod';
import { listWebhooks, createWebhook, updateWebhook, deleteWebhook, SUPPORTED_EVENTS } from './webhook.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export default async function webhookRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/events', async () => ({ events: SUPPORTED_EVENTS }));

  app.get('/', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    const webhooks = await listWebhooks({ workspaceId, userId: request.user.sub });
    return { webhooks };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const webhook = await createWebhook({
      workspaceId: body.workspace_id,
      userId: request.user.sub,
      name: body.name,
      url: body.url,
      events: body.events,
    });
    reply.code(201).send({ webhook });
  });

  app.patch('/:id', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    const body = UpdateBody.parse(request.body);
    const webhook = await updateWebhook({
      workspaceId,
      webhookId: request.params.id,
      userId: request.user.sub,
      patch: body,
    });
    if (!webhook) return reply.code(404).send({ error: 'Webhook not found' });
    return { webhook };
  });

  app.delete('/:id', async (request, reply) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return reply.code(400).send({ error: 'workspace_id required' });
    await deleteWebhook({
      workspaceId,
      webhookId: request.params.id,
      userId: request.user.sub,
    });
    reply.code(204).send();
  });
}
