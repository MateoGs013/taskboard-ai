import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';

const BCRYPT_COST = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function parseTtlToDate(ttl) {
  // Supports formats: '7d', '15m', '1h', '30s'
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const n = Number(match[1]);
  const unit = match[2];
  const ms = { s: 1e3, m: 60e3, h: 36e5, d: 864e5 }[unit];
  return new Date(Date.now() + n * ms);
}

export async function createUser({ email, password, name }) {
  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, avatar_url, timezone, locale, created_at`,
    [email, passwordHash, name]
  );
  return rows[0];
}

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, email, name, password_hash, avatar_url FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, email, name, avatar_url, timezone, locale, onboarding_completed, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function issueRefreshToken({ userId, userAgent, ip }) {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = parseTtlToDate(env.JWT_REFRESH_TTL);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ip]
  );
  return { token, expiresAt };
}

export async function rotateRefreshToken({ oldToken, userAgent, ip }) {
  const oldHash = hashRefreshToken(oldToken);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [oldHash]
    );
    const record = rows[0];
    if (!record) throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    if (record.revoked_at) throw Object.assign(new Error('Token revoked'), { statusCode: 401 });
    if (new Date(record.expires_at) < new Date()) {
      throw Object.assign(new Error('Token expired'), { statusCode: 401 });
    }

    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);

    const newToken = generateRefreshToken();
    const newHash = hashRefreshToken(newToken);
    const expiresAt = parseTtlToDate(env.JWT_REFRESH_TTL);
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [record.user_id, newHash, expiresAt, userAgent, ip]
    );
    return { userId: record.user_id, token: newToken, expiresAt };
  });
}

export async function revokeRefreshToken(token) {
  const hash = hashRefreshToken(token);
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [hash]);
}
