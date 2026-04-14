export async function requireAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireWorkspaceRole(...allowedRoles) {
  return async function (request, reply) {
    const workspaceId = request.params.workspaceId || request.body?.workspace_id;
    if (!workspaceId) {
      return reply.code(400).send({ error: 'workspace_id required' });
    }
    const { rows } = await request.server.db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = $3',
      [workspaceId, request.user.sub, 'active']
    );
    if (rows.length === 0) {
      return reply.code(403).send({ error: 'Not a workspace member' });
    }
    if (allowedRoles.length && !allowedRoles.includes(rows[0].role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
    request.workspaceRole = rows[0].role;
  };
}
