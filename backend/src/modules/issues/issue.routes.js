import { z } from 'zod';
import {
  listIssues,
  createIssue,
  getIssue,
  updateIssue,
  moveIssue,
  archiveIssue,
  listComments,
  createComment,
  setIssueLabels,
} from './issue.service.js';
import { requireAuth } from '../../middleware/auth.js';

const CreateBody = z.object({
  team_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  project_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  cycle_id: z.string().uuid().nullable().optional(),
  status_id: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'sub_task']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  estimate: z.number().min(0).max(999).optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  label_ids: z.array(z.string().uuid()).optional(),
});

const UpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'sub_task']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  cycle_id: z.string().uuid().nullable().optional(),
  estimate: z.number().min(0).max(999).nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

const MoveBody = z.object({
  status_id: z.string().uuid().optional(),
  before_id: z.string().uuid().nullable().optional(),
  after_id: z.string().uuid().nullable().optional(),
});

const CommentBody = z.object({
  body: z.string().min(1).max(10000),
  parent_id: z.string().uuid().nullable().optional(),
});

const LabelsBody = z.object({
  label_ids: z.array(z.string().uuid()),
});

export default async function issueRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const teamId = request.query?.team_id;
    if (!teamId) return reply.code(400).send({ error: 'team_id required' });
    const issues = await listIssues({
      teamId,
      userId: request.user.sub,
      filters: {
        project_id: request.query.project_id,
        status_id: request.query.status_id,
        assignee_id: request.query.assignee_id,
        cycle_id: request.query.cycle_id,
      },
    });
    return { issues };
  });

  app.post('/', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    const issue = await createIssue({
      teamId: body.team_id,
      userId: request.user.sub,
      payload: body,
    });
    reply.code(201).send({ issue });
  });

  app.get('/:issueId', async (request, reply) => {
    const issue = await getIssue({ issueId: request.params.issueId, userId: request.user.sub });
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    return { issue };
  });

  app.patch('/:issueId', async (request) => {
    const body = UpdateBody.parse(request.body);
    const issue = await updateIssue({ issueId: request.params.issueId, userId: request.user.sub, patch: body });
    return { issue };
  });

  app.post('/:issueId/move', async (request) => {
    const body = MoveBody.parse(request.body);
    const issue = await moveIssue({
      issueId: request.params.issueId,
      userId: request.user.sub,
      statusId: body.status_id,
      beforeId: body.before_id,
      afterId: body.after_id,
    });
    return { issue };
  });

  app.post('/:issueId/archive', async (request, reply) => {
    await archiveIssue({ issueId: request.params.issueId, userId: request.user.sub });
    reply.code(204).send();
  });

  app.put('/:issueId/labels', async (request) => {
    const body = LabelsBody.parse(request.body);
    const issue = await setIssueLabels({
      issueId: request.params.issueId,
      userId: request.user.sub,
      labelIds: body.label_ids,
    });
    return { issue };
  });

  app.get('/:issueId/comments', async (request) => {
    const comments = await listComments({ issueId: request.params.issueId, userId: request.user.sub });
    return { comments };
  });

  app.post('/:issueId/comments', async (request, reply) => {
    const body = CommentBody.parse(request.body);
    const comment = await createComment({
      issueId: request.params.issueId,
      userId: request.user.sub,
      body: body.body,
      parentId: body.parent_id,
    });
    reply.code(201).send({ comment });
  });
}
