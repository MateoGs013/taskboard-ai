import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { query } from '../../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = join(__dirname, '..', '..', '..', 'uploads');

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
  'application/zip', 'application/json',
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function assertIssueAccess(issueId, userId) {
  const { rows } = await query(
    `SELECT i.team_id, t.workspace_id
     FROM issues i JOIN teams t ON t.id = i.team_id
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE i.id = $1`,
    [issueId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  return rows[0];
}

export async function saveUpload({ issueId, userId, file }) {
  await assertIssueAccess(issueId, userId);

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw Object.assign(new Error(`Tipo no permitido: ${file.mimetype}`), { statusCode: 400 });
  }
  const buffer = await file.toBuffer();
  if (buffer.length > MAX_SIZE) {
    throw Object.assign(new Error(`Archivo > ${MAX_SIZE / 1024 / 1024} MB`), { statusCode: 400 });
  }

  const ext = file.filename?.match(/\.[a-zA-Z0-9]+$/)?.[0] || '';
  const key = `${issueId}/${crypto.randomUUID()}${ext}`;
  const absPath = join(UPLOAD_ROOT, key);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);

  const url = `/api/attachments/file/${encodeURIComponent(key)}`;
  const { rows } = await query(
    `INSERT INTO attachments (issue_id, user_id, filename, url, mime_type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, issue_id, filename, url, mime_type, size_bytes, storage_key, created_at`,
    [issueId, userId, file.filename, url, file.mimetype, buffer.length, key]
  );
  return rows[0];
}

export async function listForIssue({ issueId, userId }) {
  await assertIssueAccess(issueId, userId);
  const { rows } = await query(
    `SELECT a.id, a.filename, a.url, a.mime_type, a.size_bytes, a.created_at,
            u.name AS user_name
     FROM attachments a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.issue_id = $1 ORDER BY a.created_at DESC`,
    [issueId]
  );
  return rows;
}

export async function getForServe({ storageKey, userId }) {
  const { rows } = await query(
    `SELECT a.*, t.workspace_id
     FROM attachments a
     JOIN issues i ON i.id = a.issue_id
     JOIN teams t ON t.id = i.team_id
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE a.storage_key = $1`,
    [storageKey, userId]
  );
  if (!rows.length) return null;
  const absPath = join(UPLOAD_ROOT, rows[0].storage_key);
  try {
    await stat(absPath);
  } catch {
    return null;
  }
  return { row: rows[0], absPath };
}

export async function deleteAttachment({ attachmentId, userId }) {
  const { rows } = await query(
    `SELECT a.*, t.workspace_id, wm.role AS ws_role
     FROM attachments a
     JOIN issues i ON i.id = a.issue_id
     JOIN teams t ON t.id = i.team_id
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
       AND wm.user_id = $2 AND wm.status = 'active'
     WHERE a.id = $1`,
    [attachmentId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('Attachment not found'), { statusCode: 404 });
  const att = rows[0];
  const canDelete = att.user_id === userId || ['owner', 'admin'].includes(att.ws_role);
  if (!canDelete) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  if (att.storage_key) {
    try { await unlink(join(UPLOAD_ROOT, att.storage_key)); } catch { /* ignore */ }
  }
  await query('DELETE FROM attachments WHERE id = $1', [attachmentId]);
}

export { UPLOAD_ROOT };
