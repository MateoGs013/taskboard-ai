import { listForUser, unreadCount, markRead, markAllRead } from './notification.service.js';
import { requireAuth } from '../../middleware/auth.js';

export default async function notificationRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const onlyUnread = request.query?.unread === 'true';
    const notifications = await listForUser({
      userId: request.user.sub,
      onlyUnread,
      limit: Number(request.query?.limit) || 50,
    });
    const unread = await unreadCount(request.user.sub);
    return { notifications, unread_count: unread };
  });

  app.get('/unread-count', async (request) => {
    const c = await unreadCount(request.user.sub);
    return { unread_count: c };
  });

  app.patch('/:id/read', async (request, reply) => {
    await markRead({ notificationId: request.params.id, userId: request.user.sub });
    reply.code(204).send();
  });

  app.post('/read-all', async (request, reply) => {
    await markAllRead(request.user.sub);
    reply.code(204).send();
  });
}
