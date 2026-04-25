import type { Request, Response } from 'express';
import { getProfile, getPublicProfile, updateProfile } from './profile.service';
import { UpdateProfileSchema } from './profile.types';

export async function getProfileHandler(req: Request, res: Response) {
  const profile = await getProfile(req.user.userId);
  res.json(profile);
}

export async function getPublicProfileHandler(req: Request, res: Response) {
  const profile = await getPublicProfile(req.params.username as string);
  res.json(profile);
}

export async function updateProfileHandler(req: Request, res: Response) {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: 'At least one field must be provided' });
    return;
  }
  const profile = await updateProfile(req.user.userId, parsed.data);
  res.json(profile);
}
