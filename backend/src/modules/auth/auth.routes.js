import { z } from 'zod';
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refresh_token: z.string().min(1),
});

function signAccessToken(app, user) {
  return app.jwt.sign({ sub: user.id, email: user.email, name: user.name });
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar_url: u.avatar_url,
    timezone: u.timezone,
    locale: u.locale,
    onboarding_completed: u.onboarding_completed,
  };
}

export default async function authRoutes(app) {
  app.post('/register', async (request, reply) => {
    const body = RegisterBody.parse(request.body);
    const existing = await findUserByEmail(body.email);
    if (existing) return reply.code(409).send({ error: 'Email already registered' });

    const user = await createUser(body);
    const accessToken = signAccessToken(app, user);
    const { token: refreshToken } = await issueRefreshToken({
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    reply.code(201).send({
      user: publicUser(user),
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  });

  app.post('/login', async (request, reply) => {
    const body = LoginBody.parse(request.body);
    const user = await findUserByEmail(body.email);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

    const accessToken = signAccessToken(app, user);
    const { token: refreshToken } = await issueRefreshToken({
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    await app.db.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    reply.send({
      user: publicUser(user),
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  });

  app.post('/refresh', async (request, reply) => {
    const body = RefreshBody.parse(request.body);
    const { userId, token: newRefresh } = await rotateRefreshToken({
      oldToken: body.refresh_token,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    const user = await findUserById(userId);
    if (!user) return reply.code(401).send({ error: 'User not found' });
    const accessToken = signAccessToken(app, user);
    reply.send({ access_token: accessToken, refresh_token: newRefresh });
  });

  app.post('/logout', { preHandler: requireAuth }, async (request, reply) => {
    const body = RefreshBody.parse(request.body);
    await revokeRefreshToken(body.refresh_token);
    reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (request) => {
    const user = await findUserById(request.user.sub);
    return { user: publicUser(user) };
  });
}
