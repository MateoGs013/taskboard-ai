import { createReadStream } from 'node:fs';
import { saveUpload, listForIssue, getForServe, deleteAttachment } from './attachment.service.js';
import { requireAuth } from '../../middleware/auth.js';

export default async function attachmentRoutes(app) {
  // File serve route — accepts token via query for <img src> usage
  app.get('/file/:key', async (request, reply) => {
    let userId;
    try {
      const token = request.query?.token;
      if (token) {
        const decoded = app.jwt.verify(token);
        userId = decoded.sub;
      } else {
        await request.jwtVerify();
        userId = request.user.sub;
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const key = decodeURIComponent(request.params.key);
    const hit = await getForServe({ storageKey: key, userId });
    if (!hit) return reply.code(404).send({ error: 'Not found' });
    reply.type(hit.row.mime_type || 'application/octet-stream');
    reply.header('Cache-Control', 'private, max-age=86400');
    return reply.send(createReadStream(hit.absPath));
  });

  app.register(async (instance) => {
    instance.addHook('preHandler', requireAuth);

    instance.get('/issues/:issueId', async (request) => {
      const attachments = await listForIssue({
        issueId: request.params.issueId,
        userId: request.user.sub,
      });
      return { attachments };
    });

    instance.post('/issues/:issueId', async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: 'No file uploaded' });
      const att = await saveUpload({
        issueId: request.params.issueId,
        userId: request.user.sub,
        file,
      });
      // Broadcast to workspace room
      const { rows } = await instance.db.query(
        `SELECT t.workspace_id FROM issues i JOIN teams t ON t.id = i.team_id WHERE i.id = $1`,
        [request.params.issueId]
      );
      if (rows[0]) {
        instance.realtime.toWorkspace(rows[0].workspace_id, 'attachment.created', {
          issue_id: request.params.issueId,
          attachment: att,
        });
      }
      reply.code(201).send({ attachment: att });
    });

    instance.delete('/:attachmentId', async (request, reply) => {
      await deleteAttachment({
        attachmentId: request.params.attachmentId,
        userId: request.user.sub,
      });
      reply.code(204).send();
    });
  });
}
