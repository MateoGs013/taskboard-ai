import fp from 'fastify-plugin';
import websocketPlugin from '@fastify/websocket';
import { env } from '../config/env.js';

/**
 * Real-time plugin:
 * - Upgrades /ws?token=<jwt> to a WebSocket connection
 * - Clients auto-join rooms "workspace:<id>" and "user:<id>" after auth
 * - Exposes app.realtime.broadcast(room, event, payload)
 */
export default fp(async (fastify) => {
  await fastify.register(websocketPlugin, {
    options: { maxPayload: 512 * 1024 },
  });

  /** Map<roomName, Set<WebSocket>> */
  const rooms = new Map();
  /** Map<WebSocket, { userId, rooms: Set<string> }> */
  const sockets = new Map();

  function joinRoom(ws, room) {
    const set = rooms.get(room) || new Set();
    set.add(ws);
    rooms.set(room, set);
    const meta = sockets.get(ws);
    if (meta) meta.rooms.add(room);
  }

  function leaveAll(ws) {
    const meta = sockets.get(ws);
    if (!meta) return;
    for (const room of meta.rooms) {
      const set = rooms.get(room);
      if (set) { set.delete(ws); if (set.size === 0) rooms.delete(room); }
    }
    sockets.delete(ws);
  }

  function broadcast(room, event, payload) {
    const set = rooms.get(room);
    if (!set || set.size === 0) return 0;
    const frame = JSON.stringify({ event, payload, ts: Date.now() });
    let sent = 0;
    for (const ws of set) {
      if (ws.readyState === 1) {
        try { ws.send(frame); sent++; } catch { /* ignore */ }
      }
    }
    return sent;
  }

  fastify.decorate('realtime', {
    broadcast,
    // Emit to a user directly
    toUser(userId, event, payload) { return broadcast(`user:${userId}`, event, payload); },
    toWorkspace(workspaceId, event, payload) { return broadcast(`workspace:${workspaceId}`, event, payload); },
    connectedCount() { return sockets.size; },
  });

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const token = req.query?.token;
    if (!token) { socket.close(1008, 'missing token'); return; }
    let decoded;
    try {
      decoded = fastify.jwt.verify(token);
    } catch {
      socket.close(1008, 'invalid token'); return;
    }

    sockets.set(socket, { userId: decoded.sub, rooms: new Set() });
    joinRoom(socket, `user:${decoded.sub}`);

    socket.send(JSON.stringify({ event: 'connected', payload: { user_id: decoded.sub } }));

    socket.on('message', async (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }

      if (msg.type === 'subscribe' && msg.workspace_id) {
        const { rows } = await fastify.db.query(
          `SELECT 1 FROM workspace_members
           WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
          [msg.workspace_id, decoded.sub]
        );
        if (rows.length) {
          joinRoom(socket, `workspace:${msg.workspace_id}`);
          socket.send(JSON.stringify({ event: 'subscribed', payload: { workspace_id: msg.workspace_id } }));
        }
      } else if (msg.type === 'ping') {
        socket.send(JSON.stringify({ event: 'pong', ts: Date.now() }));
      }
    });

    socket.on('close', () => leaveAll(socket));
    socket.on('error', () => leaveAll(socket));
  });
}, { name: 'realtime', dependencies: ['db'] });
