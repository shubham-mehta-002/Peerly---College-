import { Request, Response } from 'express';
import * as postsService from './posts.service';
import { feedQuerySchema } from './posts.types';

export async function createPost(req: Request, res: Response): Promise<void> {
  const post = await postsService.createPost(req.user.userId, req.user.campusId!, req.body);
  res.status(201).json(post);
}

export async function getCampusFeed(req: Request, res: Response): Promise<void> {
  const query = feedQuerySchema.parse(req.query);
  const posts = await postsService.getFeed({
    ...query,
    feedType: 'campus',
    campusId: req.user.campusId!,
    viewerUserId: req.user.userId,
  });
  res.json(posts);
}

export async function getGlobalFeed(req: Request, res: Response): Promise<void> {
  const query = feedQuerySchema.parse(req.query);
  const posts = await postsService.getFeed({
    ...query,
    feedType: 'global',
    campusId: req.user.campusId!,
    viewerUserId: req.user.userId,
  });
  res.json(posts);
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await postsService.getPost(req.params.id as string, req.user.userId);
  res.json(post);
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  await postsService.deletePost(req.params.id as string, req.user.userId, req.user.isAdmin);
  res.status(204).send();
}

export async function vote(req: Request, res: Response): Promise<void> {
  await postsService.castVote(req.params.id as string, req.user.userId, req.body.vote_type);
  res.status(200).json({ ok: true });
}
