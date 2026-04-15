import { z } from 'zod';
import {
  generateTasks,
  enhanceDescription,
  suggestPriority,
  detectDuplicates,
  planSprint,
  buildChatMessages,
  getOrCreateConversation,
  appendMessage,
  listConversations,
  getMessages,
  MODELS,
} from './ai.service.js';
import { checkHealth, chatStream } from './ollama.client.js';
import { requireAuth } from '../../middleware/auth.js';

const WsRequired = z.object({ workspace_id: z.string().uuid() });

const GenerateBody = WsRequired.extend({
  team_id: z.string().uuid().optional(),
  description: z.string().min(10).max(2000),
});

const EnhanceBody = WsRequired.extend({
  team_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
});

const PriorityBody = WsRequired.extend({
  team_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
});

const DuplicatesBody = WsRequired.extend({
  team_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
});

const SprintBody = WsRequired.extend({
  team_id: z.string().uuid(),
  cycle_id: z.string().uuid().optional(),
  capacity: z.number().min(0).optional(),
});

const ChatBody = WsRequired.extend({
  team_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  context_type: z.enum(['workspace', 'team', 'project', 'cycle', 'issue']).optional(),
  context_id: z.string().uuid().optional(),
});

export default async function aiRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/status', async () => {
    const h = await checkHealth();
    return { ...h, models_configured: MODELS };
  });

  app.post('/status/refresh', async () => {
    const h = await checkHealth(true);
    return { ...h, models_configured: MODELS };
  });

  app.post('/generate-tasks', async (request) => {
    const body = GenerateBody.parse(request.body);
    return generateTasks({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      description: body.description,
    });
  });

  app.post('/enhance-description', async (request) => {
    const body = EnhanceBody.parse(request.body);
    return enhanceDescription({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      title: body.title,
      currentDescription: body.description,
    });
  });

  app.post('/suggest-priority', async (request) => {
    const body = PriorityBody.parse(request.body);
    return suggestPriority({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      title: body.title,
      description: body.description,
    });
  });

  app.post('/detect-duplicates', async (request) => {
    const body = DuplicatesBody.parse(request.body);
    return detectDuplicates({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      title: body.title,
      description: body.description,
    });
  });

  app.post('/sprint-plan', async (request) => {
    const body = SprintBody.parse(request.body);
    return planSprint({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      cycleId: body.cycle_id,
      capacity: body.capacity,
    });
  });

  app.get('/conversations', async (request) => {
    const workspaceId = request.query?.workspace_id;
    if (!workspaceId) return { conversations: [] };
    const conversations = await listConversations({ workspaceId, userId: request.user.sub });
    return { conversations };
  });

  app.get('/conversations/:id/messages', async (request) => {
    const messages = await getMessages(request.params.id);
    return { messages };
  });

  // SSE streaming chat
  app.post('/chat', async (request, reply) => {
    const body = ChatBody.parse(request.body);
    const conversationId = await getOrCreateConversation({
      conversationId: body.conversation_id,
      workspaceId: body.workspace_id,
      userId: request.user.sub,
      contextType: body.context_type,
      contextId: body.context_id,
      title: body.message.slice(0, 60),
    });

    // Persist user message immediately
    await appendMessage({ conversationId, role: 'user', content: body.message });

    const previous = await getMessages(conversationId);
    const history = previous.slice(0, -1); // exclude the message we just inserted
    const messages = await buildChatMessages({
      workspaceId: body.workspace_id,
      teamId: body.team_id,
      userId: request.user.sub,
      history,
      userMessage: body.message,
    });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('start', { conversation_id: conversationId });

    let assistantContent = '';
    let finalMeta = {};

    try {
      for await (const part of chatStream({ messages })) {
        if (part.type === 'chunk') {
          assistantContent += part.content;
          send('chunk', { content: part.content });
        } else if (part.type === 'done') {
          finalMeta = part;
        }
      }
      await appendMessage({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        model: MODELS.quick,
        tokens: finalMeta.tokens_out,
      });
      send('done', { ...finalMeta, conversation_id: conversationId });
    } catch (err) {
      send('error', { error: err.message });
    } finally {
      reply.raw.end();
    }
  });
}
