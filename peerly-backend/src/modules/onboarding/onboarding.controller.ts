import { Request, Response } from 'express';
import * as onboardingService from './onboarding.service';

export async function getCampuses(req: Request, res: Response): Promise<void> {
  const campuses = await onboardingService.getCampusesForUser(req.user.email);
  res.json(campuses);
}

export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  // req.body pre-validated by completeOnboardingSchema
  const result = await onboardingService.completeOnboarding(
    req.user.userId,
    req.user.email,
    req.user.isAdmin,
    req.body
  );
  res.json(result);
}
