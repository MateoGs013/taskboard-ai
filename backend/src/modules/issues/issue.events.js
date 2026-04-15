/**
 * Helper singleton that holds a reference to the Fastify app
 * so service functions can broadcast WS events without needing
 * the request context.
 */
let app = null;

export function bindRealtime(fastify) {
  app = fastify;
}

export async function emitIssueEvent({ event, workspaceId, issueId, payload }) {
  if (!app) return;
  app.realtime.toWorkspace(workspaceId, event, { issue_id: issueId, ...payload });
}

export async function emitToUser({ userId, event, payload }) {
  if (!app) return;
  app.realtime.toUser(userId, event, payload);
}
