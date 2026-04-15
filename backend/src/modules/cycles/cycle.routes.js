import { z } from 'zod';
import {
  listCycles,
  getActiveCycle,
  createCycle,
  startCycle,
  completeCycle,
  deleteCycle,
} from './cycle.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  team_id: z.string().uuid(),
  name: z.string().max(80).optional(),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
});

export default async function cycleRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const cycles = await listCycles({ teamId, userId: request.user.sub });
    return { cycles };
  });

  app.get('/active', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const cycle = await getActiveCycle({ teamId, userId: request.user.sub });
    return { cycle };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const cycle = await createCycle({
      teamId: body.team_id,
      userId: request.user.sub,
      name: body.name,
      startDate: body.start_date,
      endDate: body.end_date,
    });
    reply.code(201).send({ cycle });
  });

  app.post('/:cycleId/start', async (request) => {
    const cycle = await startCycle({ cycleId: request.params.cycleId, userId: request.user.sub });
    return { cycle };
  });

  app.post('/:cycleId/complete', async (request) => {
    const cycle = await completeCycle({ cycleId: request.params.cycleId, userId: request.user.sub });
    return { cycle };
  });

  app.delete('/:cycleId', async (request, reply) => {
    await deleteCycle({ cycleId: request.params.cycleId, userId: request.user.sub });
    reply.code(204).send();
  });
}
