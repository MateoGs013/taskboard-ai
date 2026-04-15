import { z } from 'zod';
import { velocityByCycle, burndown, distribution, throughput } from './analytics.service.js';
import { requireAuth } from '../../middleware/auth.js';

export default async function analyticsRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/velocity', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const cycles = await velocityByCycle({ teamId, userId: request.user.sub, limit: Number(request.query.limit) || 10 });
    return { cycles };
  });

  app.get('/burndown', async (request, reply) => {
    const { team_id: teamId, cycle_id: cycleId } = request.query || {};
    if (!teamId || !cycleId) return reply.code(400).send({ error: 'team_id and cycle_id required' });
    return burndown({ teamId, userId: request.user.sub, cycleId });
  });

  app.get('/distribution', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    return distribution({ teamId, userId: request.user.sub });
  });

  app.get('/throughput', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const data = await throughput({
      teamId,
      userId: request.user.sub,
      weeks: Number(request.query.weeks) || 8,
    });
    return { weeks: data };
  });
}
