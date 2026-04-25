import type { Request, Response } from 'express';
import {
  getCommunities, getCommunity, createCommunity,
  updateCommunity, deleteCommunity, joinCommunity,
  leaveCommunity, kickMember, updateMemberRole, transferOwnership, getMembers,
} from './communities.service';
import { CreateCommunitySchema, UpdateCommunitySchema, UpdateMemberRoleSchema } from './communities.types';

export async function listHandler(req: Request, res: Response) {
  if (!req.user.campusId) {
    res.status(403).json({ error: 'Campus not assigned' });
    return;
  }
  const communities = await getCommunities(req.user.campusId, req.user.userId, req.query.search as string | undefined);
  res.json(communities);
}

export async function getHandler(req: Request, res: Response) {
  const community = await getCommunity(req.params.id as string, req.user.userId);
  res.json(community);
}

export async function createHandler(req: Request, res: Response) {
  if (!req.user.campusId) {
    res.status(403).json({ error: 'Campus not assigned' });
    return;
  }
  const parsed = CreateCommunitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  const community = await createCommunity(parsed.data, req.user.userId, req.user.campusId);
  res.status(201).json(community);
}

export async function updateHandler(req: Request, res: Response) {
  const parsed = UpdateCommunitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  const community = await updateCommunity(req.params.id as string, parsed.data, req.user.userId);
  res.json(community);
}

export async function deleteHandler(req: Request, res: Response) {
  await deleteCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function joinHandler(req: Request, res: Response) {
  await joinCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function leaveHandler(req: Request, res: Response) {
  await leaveCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function kickHandler(req: Request, res: Response) {
  await kickMember(req.params.id as string, req.user.userId, req.params.userId as string);
  res.status(204).send();
}

export async function updateRoleHandler(req: Request, res: Response) {
  const parsed = UpdateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  await updateMemberRole(req.params.id as string, req.user.userId, req.params.userId as string, parsed.data);
  res.status(204).send();
}

export async function transferOwnershipHandler(req: Request, res: Response) {
  const { newOwnerId } = req.body as { newOwnerId: string };
  if (!newOwnerId) { res.status(400).json({ error: 'newOwnerId is required' }); return; }
  await transferOwnership(req.params.id as string, req.user.userId, newOwnerId);
  res.status(204).send();
}

export async function getMembersHandler(req: Request, res: Response) {
  const members = await getMembers(req.params.id as string, req.user.userId);
  res.json(members);
}
