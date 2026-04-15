import { z } from 'zod';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
} from './project.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  team_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(4).optional(),
  lead_user_id: z.string().uuid().optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(4).nullable().optional(),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'cancelled']).optional(),
  lead_user_id: z.string().uuid().nullable().optional(),
  start_date: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export default async function projectRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const projects = await listProjects({ teamId, userId: request.user.sub });
    return { projects };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const project = await createProject({
      teamId: body.team_id,
      userId: request.user.sub,
      name: body.name,
      description: body.description,
      color: body.color,
      icon: body.icon,
      lead_user_id: body.lead_user_id,
    });
    reply.code(201).send({ project });
  });

  app.get('/:projectId', async (request, reply) => {
    const project = await getProject({ projectId: request.params.projectId, userId: request.user.sub });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return { project };
  });

  app.patch('/:projectId', async (request) => {
    const body = UpdateBody.parse(request.body);
    const project = await updateProject({
      projectId: request.params.projectId,
      userId: request.user.sub,
      patch: body,
    });
    return { project };
  });
}
