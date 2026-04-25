import type { Request, Response } from 'express';
import { z } from 'zod';
import { getHistory } from './messages.service';
import { getMemberRole } from '../communities/communities.service';
import { AppError } from '../../lib/errors';

const GetHistoryQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export async function getHistoryHandler(req: Request, res: Response) {
  const communityId = req.params.id as string;

  if (!z.string().uuid().safeParse(communityId).success) {
    throw new AppError(400, 'Invalid community id');
  }

  const role = await getMemberRole(communityId, req.user.userId);
  if (!role) throw new AppError(403, 'You are not a member of this community');

  const parsed = GetHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', errors: parsed.error.issues });
    return;
  }

  const messages = await getHistory(communityId, parsed.data.before, parsed.data.limit);
  res.json(messages);
}
