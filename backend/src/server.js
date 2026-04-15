import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { env, isDev } from './config/env.js';
import dbPlugin from './plugins/db.js';
import realtimePlugin from './plugins/realtime.js';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspaces/workspace.routes.js';
import teamRoutes from './modules/teams/team.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import labelRoutes from './modules/labels/label.routes.js';
import issueRoutes from './modules/issues/issue.routes.js';
import cycleRoutes from './modules/cycles/cycle.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import attachmentRoutes from './modules/attachments/attachment.routes.js';
import exportRoutes from './modules/exports/export.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import webhookRoutes from './modules/webhooks/webhook.routes.js';
import memberRoutes from './modules/workspaces/member.routes.js';
import { bindRealtime as bindIssueRealtime } from './modules/issues/issue.events.js';
import { bindRealtime as bindNotifRealtime } from './modules/notifications/notification.service.js';

export async function buildApp() {
  const app = Fastify({
    logger: isDev
      ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
      : { level: 'info' },
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  await app.register(jwt, {
    secret: {
      private: env.JWT_ACCESS_SECRET,
      public: env.JWT_ACCESS_SECRET,
    },
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });

  await app.register(dbPlugin);
  await app.register(realtimePlugin);

  bindIssueRealtime(app);
  bindNotifRealtime(app);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'taskboard-api',
  }));

  app.get('/health/db', async () => {
    const { rows } = await app.db.query('SELECT NOW() AS now');
    return { status: 'ok', now: rows[0].now };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(workspaceRoutes, { prefix: '/api/workspaces' });
  await app.register(teamRoutes, { prefix: '/api/teams' });
  await app.register(projectRoutes, { prefix: '/api/projects' });
  await app.register(labelRoutes, { prefix: '/api/labels' });
  await app.register(issueRoutes, { prefix: '/api/issues' });
  await app.register(cycleRoutes, { prefix: '/api/cycles' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(attachmentRoutes, { prefix: '/api/attachments' });
  await app.register(exportRoutes, { prefix: '/api/export' });
  await app.register(activityRoutes, { prefix: '/api/activity' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(memberRoutes, { prefix: '/api/workspaces' });

  app.setErrorHandler((err, request, reply) => {
    request.log.error(err);
    if (err.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: err.validation });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    reply.status(500).send({ error: 'Internal server error' });
  });

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const entry = process.argv[1] || '';
if (entry.endsWith('server.js') || entry.endsWith('server')) start();
