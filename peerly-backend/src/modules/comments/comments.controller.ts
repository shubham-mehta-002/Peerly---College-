import { Request, Response } from 'express';
import * as commentsService from './comments.service';

export async function addComment(req: Request, res: Response): Promise<void> {
  const comment = await commentsService.addComment(req.params.postId as string, req.user.userId, req.body);
  res.status(201).json(comment);
}

export async function getComments(req: Request, res: Response): Promise<void> {
  const comments = await commentsService.getComments(req.params.postId as string);
  res.json(comments);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await commentsService.deleteComment(
    req.params.commentId as string,
    req.params.postId as string,
    req.user.userId,
    req.user.isAdmin
  );
  res.status(204).send();
}
