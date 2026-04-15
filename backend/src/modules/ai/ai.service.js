import { query } from '../../config/db.js';
import { env } from '../../config/env.js';
import { chat, tryParseJson } from './ollama.client.js';

const MODEL_QUICK = env.OLLAMA_MODEL_QUICK;
const MODEL_STANDARD = env.OLLAMA_MODEL_STANDARD;

// ============================================================
// CONTEXT BUILDER
// ============================================================

export async function buildContext({ workspaceId, teamId, userId }) {
  const [wsRows, teamRows, statusRows, labelRows, memberRows] = await Promise.all([
    query(`SELECT id, name, slug FROM workspaces WHERE id = $1`, [workspaceId]),
    teamId
      ? query(`SELECT id, name, identifier, cycle_duration FROM teams WHERE id = $1`, [teamId])
      : Promise.resolve({ rows: [] }),
    teamId
      ? query(
          `SELECT id, name, type, position, wip_limit FROM workflow_statuses WHERE team_id = $1 ORDER BY position ASC`,
          [teamId]
        )
      : Promise.resolve({ rows: [] }),
    query(
      `SELECT id, name, color FROM labels WHERE workspace_id = $1 AND (team_id IS NULL OR team_id = $2) ORDER BY name ASC`,
      [workspaceId, teamId || null]
    ),
    teamId
      ? query(
          `SELECT u.id, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = $1`,
          [teamId]
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    workspace: wsRows.rows[0],
    team: teamRows.rows[0],
    statuses: statusRows.rows,
    labels: labelRows.rows,
    members: memberRows.rows,
    user_id: userId,
  };
}

function systemPrompt(ctx) {
  const teamLine = ctx.team
    ? `Team: ${ctx.team.name} (prefix ${ctx.team.identifier}, cycles de ${ctx.team.cycle_duration} días)`
    : 'Team: (sin team activo)';
  const workflow = ctx.statuses?.length
    ? ctx.statuses.map((s) => s.name).join(' → ')
    : 'Backlog → Todo → In Progress → Done';
  const labels = ctx.labels?.length
    ? ctx.labels.map((l) => l.name).slice(0, 30).join(', ')
    : '(sin labels definidas)';
  const members = ctx.members?.length
    ? ctx.members.map((m) => m.name).slice(0, 20).join(', ')
    : '(sin miembros)';
  return `Sos un asistente de PM integrado en TaskBoard AI.

Workspace: ${ctx.workspace?.name || 'N/A'}
${teamLine}
Workflow: ${workflow}
Labels disponibles: ${labels}
Miembros: ${members}

Reglas:
- Respondé en español rioplatense.
- Sé conciso, directo, accionable. Sin disclaimers.
- Cuando generes tareas, hacelas atómicas (1 deliverable = 1 tarea).
- Prioridades: 0=Urgent, 1=High, 2=Medium, 3=Low, 4=None.
- Tipos: epic, story, task, bug, sub_task.
- Si te piden JSON, devolvé SOLO el JSON sin markdown ni texto extra.`;
}

// ============================================================
// LOGGING
// ============================================================

async function logAction({ workspaceId, userId, teamId, actionType, model, input, output, error, durationMs, tokensIn, tokensOut }) {
  try {
    await query(
      `INSERT INTO ai_action_logs
       (workspace_id, user_id, team_id, action_type, model, input, output, tokens_in, tokens_out, duration_ms, error)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)`,
      [
        workspaceId,
        userId,
        teamId || null,
        actionType,
        model,
        JSON.stringify(input || null),
        output ? JSON.stringify(output) : null,
        tokensIn || null,
        tokensOut || null,
        durationMs || null,
        error || null,
      ]
    );
  } catch (e) {
    // Logging must never break the user-facing call
    console.warn('[ai] logAction failed:', e.message);
  }
}

// ============================================================
// FEATURES
// ============================================================

const TASKS_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['task', 'bug', 'story', 'epic'] },
          priority: { type: 'integer', minimum: 0, maximum: 4 },
          estimate: { type: 'number' },
          labels: { type: 'array', items: { type: 'string' } },
          acceptance_criteria: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'priority', 'type'],
      },
    },
  },
  required: ['issues'],
};

export async function generateTasks({ workspaceId, teamId, userId, description }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  const result = await chat({
    model: MODEL_STANDARD,
    messages: [
      { role: 'system', content: systemPrompt(ctx) },
      {
        role: 'user',
        content: `Generá una lista de tareas atómicas para este objetivo:

"""${description}"""

Devolvé JSON con la forma: { "issues": [{ "title", "description", "type", "priority", "estimate", "labels", "acceptance_criteria" }] }
Entre 3 y 12 tareas. acceptance_criteria es array de strings cortos.`,
      },
    ],
    format: TASKS_SCHEMA,
    temperature: 0.3,
  });

  let parsed;
  try {
    parsed = tryParseJson(result.content);
  } catch (err) {
    await logAction({
      workspaceId, userId, teamId,
      actionType: 'generate_tasks',
      model: result.model,
      input: { description },
      error: err.message,
      durationMs: result.duration_ms,
    });
    throw err;
  }

  await logAction({
    workspaceId, userId, teamId,
    actionType: 'generate_tasks',
    model: result.model,
    input: { description },
    output: parsed,
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    durationMs: result.duration_ms,
  });

  return parsed;
}

export async function enhanceDescription({ workspaceId, userId, teamId, title, currentDescription }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  const result = await chat({
    model: MODEL_QUICK,
    messages: [
      { role: 'system', content: systemPrompt(ctx) },
      {
        role: 'user',
        content: `Mejorá esta descripción de issue. Si está vacía, escribí una desde el título.
Incluí: contexto breve, qué hay que hacer, criterios de aceptación (lista bullet).
Devolvé SOLO el texto en markdown (sin backticks), máximo 250 palabras.

Título: ${title}
Descripción actual: ${currentDescription || '(vacía)'}`,
      },
    ],
    temperature: 0.4,
  });

  await logAction({
    workspaceId, userId, teamId,
    actionType: 'enhance_description',
    model: result.model,
    input: { title, current: currentDescription },
    output: { description: result.content },
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    durationMs: result.duration_ms,
  });

  return { description: result.content.trim() };
}

const PRIORITY_SCHEMA = {
  type: 'object',
  properties: {
    priority: { type: 'integer', minimum: 0, maximum: 4 },
    reasoning: { type: 'string' },
  },
  required: ['priority', 'reasoning'],
};

export async function suggestPriority({ workspaceId, userId, teamId, title, description }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  const result = await chat({
    model: MODEL_QUICK,
    messages: [
      { role: 'system', content: systemPrompt(ctx) },
      {
        role: 'user',
        content: `Sugerí prioridad para esta issue. Devolvé JSON: { "priority": 0-4, "reasoning": "..." }
0=Urgent, 1=High, 2=Medium, 3=Low, 4=None.

Título: ${title}
${description ? `Descripción: ${description}` : ''}`,
      },
    ],
    format: PRIORITY_SCHEMA,
    temperature: 0.2,
  });

  const parsed = tryParseJson(result.content);
  await logAction({
    workspaceId, userId, teamId,
    actionType: 'suggest_priority',
    model: result.model,
    input: { title, description },
    output: parsed,
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    durationMs: result.duration_ms,
  });
  return parsed;
}

const DUPS_SCHEMA = {
  type: 'object',
  properties: {
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          identifier: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['identifier', 'confidence'],
      },
    },
  },
  required: ['duplicates'],
};

export async function detectDuplicates({ workspaceId, userId, teamId, title, description }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  const { rows: existing } = await query(
    `SELECT identifier, title FROM issues
     WHERE team_id = $1 AND is_archived = FALSE
     ORDER BY created_at DESC LIMIT 80`,
    [teamId]
  );
  if (!existing.length) return { duplicates: [] };

  const list = existing.map((i) => `- [${i.identifier}] ${i.title}`).join('\n');
  const result = await chat({
    model: MODEL_QUICK,
    messages: [
      { role: 'system', content: systemPrompt(ctx) },
      {
        role: 'user',
        content: `Detectá si esta nueva issue duplica alguna existente.

Nueva: "${title}"
${description ? `Descripción: ${description}` : ''}

Issues existentes:
${list}

Devolvé JSON: { "duplicates": [{ "identifier": "FE-12", "confidence": 0.0-1.0, "reason": "..." }] }
Solo issues con confidence >= 0.6. Si no hay candidatas, devolvé { "duplicates": [] }.`,
      },
    ],
    format: DUPS_SCHEMA,
    temperature: 0.1,
  });
  const parsed = tryParseJson(result.content);
  await logAction({
    workspaceId, userId, teamId,
    actionType: 'detect_duplicates',
    model: result.model,
    input: { title, description },
    output: parsed,
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    durationMs: result.duration_ms,
  });
  return parsed;
}

const SPRINT_SCHEMA = {
  type: 'object',
  properties: {
    selected: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          identifier: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['identifier'],
      },
    },
    total_points: { type: 'number' },
    risks: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['selected', 'risks'],
};

export async function planSprint({ workspaceId, userId, teamId, cycleId, capacity }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  const { rows: backlog } = await query(
    `SELECT i.identifier, i.title, i.priority, i.estimate, ws.type AS status_type
     FROM issues i
     JOIN workflow_statuses ws ON ws.id = i.status_id
     WHERE i.team_id = $1 AND i.is_archived = FALSE AND i.cycle_id IS NULL
       AND ws.type IN ('backlog', 'unstarted')
     ORDER BY i.priority ASC, i.created_at ASC LIMIT 60`,
    [teamId]
  );
  if (!backlog.length) return { selected: [], risks: ['Backlog vacío'], recommendations: ['Agregá issues al backlog primero.'] };

  const list = backlog
    .map((i) => `- [${i.identifier}] (P${i.priority}, ${i.estimate || '?'}pts) ${i.title}`)
    .join('\n');

  const result = await chat({
    model: MODEL_STANDARD,
    messages: [
      { role: 'system', content: systemPrompt(ctx) },
      {
        role: 'user',
        content: `Planificá el próximo cycle del team ${ctx.team.name}.
Capacidad estimada: ${capacity || 'no definida'} story points.

Backlog disponible (P0=urgent ... P4=none):
${list}

Devolvé JSON: { "selected": [{ "identifier", "reason" }], "total_points", "risks": [], "recommendations": [] }
Priorizá P0/P1, no excedas la capacidad si está definida, identificá riesgos (deps, ambigüedad, scope creep).`,
      },
    ],
    format: SPRINT_SCHEMA,
    temperature: 0.3,
  });
  const parsed = tryParseJson(result.content);
  await logAction({
    workspaceId, userId, teamId,
    actionType: 'plan_sprint',
    model: result.model,
    input: { cycle_id: cycleId, capacity, backlog_size: backlog.length },
    output: parsed,
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    durationMs: result.duration_ms,
  });
  return parsed;
}

// ============================================================
// CHAT (streaming)
// ============================================================

export async function buildChatMessages({ workspaceId, teamId, userId, history, userMessage }) {
  const ctx = await buildContext({ workspaceId, teamId, userId });
  return [
    { role: 'system', content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
}

// Conversation persistence
export async function getOrCreateConversation({ conversationId, workspaceId, userId, contextType, contextId, title }) {
  if (conversationId) {
    const { rows } = await query(
      `SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    if (rows.length) return rows[0].id;
  }
  const { rows } = await query(
    `INSERT INTO ai_conversations (workspace_id, user_id, context_type, context_id, title)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [workspaceId, userId, contextType || 'workspace', contextId || null, title || null]
  );
  return rows[0].id;
}

export async function appendMessage({ conversationId, role, content, model, tokens }) {
  await query(
    `INSERT INTO ai_messages (conversation_id, role, content, model, tokens)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, role, content, model || null, tokens || null]
  );
}

export async function listConversations({ workspaceId, userId }) {
  const { rows } = await query(
    `SELECT c.id, c.title, c.context_type, c.context_id, c.updated_at,
            (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS msg_count
     FROM ai_conversations c
     WHERE c.workspace_id = $1 AND c.user_id = $2
     ORDER BY c.updated_at DESC LIMIT 30`,
    [workspaceId, userId]
  );
  return rows;
}

export async function getMessages(conversationId) {
  const { rows } = await query(
    `SELECT id, role, content, model, tokens, created_at
     FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

export const MODELS = { quick: MODEL_QUICK, standard: MODEL_STANDARD };
