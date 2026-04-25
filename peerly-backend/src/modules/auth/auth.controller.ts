import { Request, Response } from 'express';
import * as authService from './auth.service';
import { supabaseAdmin } from '../../lib/supabase';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.register(email, password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
}

export async function me(req: Request, res: Response): Promise<void> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin, created_at')
    .eq('id', req.user.userId)
    .single();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, username, bio, campus_id, onboarding_completed, avatar_url, updated_at')
    .eq('id', req.user.userId)
    .single();

  res.json({ ...user, profile });
}

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.json({ message: 'If that email is registered, a reset link has been sent' });
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  res.json({ message: 'Password reset successful' });
}

export async function sendOTPHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  await authService.sendEmailOTP(email);
  res.json({ message: 'Verification code sent' });
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body;
  const result = await authService.verifyEmailOTP(email, otp);
  res.json(result);
}

export async function googleAuthHandler(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body;
  const result = await authService.googleAuth(idToken);
  res.json(result);
}

export async function checkUsernameHandler(req: Request, res: Response): Promise<void> {
  const username = req.query.username as string;
  if (!username || username.trim().length < 1) {
    res.status(400).json({ error: 'username query param is required' });
    return;
  }
  const result = await authService.checkUsername(username);
  res.json(result);
}

export async function checkDomainHandler(req: Request, res: Response): Promise<void> {
  const email = req.query.email as string;
  if (!email) {
    res.status(400).json({ error: 'email query param is required' });
    return;
  }
  const result = await authService.checkDomain(email);
  res.json(result);
}
