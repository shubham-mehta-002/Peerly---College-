import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabase';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { config } from '../../config';
import { sendPasswordResetEmail, sendOTPEmail } from '../../lib/email';
import { OAuth2Client } from 'google-auth-library';
import redis from '../../lib/redis';

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase();
}

export async function validateDomain(domain: string): Promise<{ collegeId: string }> {
  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('id, college_id, is_active, colleges(is_active)')
    .eq('domain', domain)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');
  if (!domainRow.is_active) throw new AppError(403, 'Your institution is not currently active');

  const college = (domainRow.colleges as any) as { is_active: boolean } | null;
  if (!college?.is_active) throw new AppError(403, 'Your institution is not currently active');

  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!campus) throw new AppError(403, 'No active campus available for your institution');

  return { collegeId: domainRow.college_id };
}

export async function checkDomain(email: string) {
  const domain = extractDomain(email.toLowerCase().trim());
  if (!domain) return { status: 'invalid' as const, domain: '' };

  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('id, is_active, college_id, colleges(name, is_active)')
    .eq('domain', domain)
    .single();

  if (!domainRow) return { status: 'not_found' as const, domain };

  const college = domainRow.colleges as any;
  if (!domainRow.is_active || !college?.is_active) {
    return { status: 'inactive' as const, domain, college_name: college?.name ?? null };
  }

  return { status: 'active' as const, domain, college_name: college?.name ?? null };
}

export async function register(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = extractDomain(normalizedEmail);
  await validateDomain(domain);

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    if (existing.is_email_verified) throw new AppError(409, 'Email already registered');
    // Re-send OTP for unverified existing user
    await sendEmailOTP(normalizedEmail);
    return { email: normalizedEmail, pending_verification: true };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ email: normalizedEmail, password_hash: passwordHash })
    .select('id, email, is_admin')
    .single();

  if (error || !user) {
    logger.error('Failed to insert user during register', { error: error?.message });
    throw new AppError(500, 'Failed to create user');
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id });

  if (profileError) {
    logger.error('Failed to insert profile after user create', { userId: user.id, error: profileError.message });
    throw new AppError(500, 'Failed to create user profile');
  }

  logger.info('User registered, sending OTP', { userId: user.id, domain });

  await sendEmailOTP(normalizedEmail);

  return { email: normalizedEmail, pending_verification: true };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, password_hash, is_admin, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  if (!user.is_email_verified) {
    throw new AppError(403, 'Please verify your email before logging in');
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', user.id)
    .single();

  const token = signToken({
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin,
    campusId: profile?.campus_id ?? null,
  });

  logger.info('User logged in', { userId: user.id });

  return {
    token,
    onboarding_completed: profile?.onboarding_completed ?? false,
  };
}

export async function forgotPassword(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .single();

  if (!user) return;

  const plain = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plain).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('user_id', user.id)
    .eq('used', false);

  await supabaseAdmin.from('password_reset_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  const resetLink = `${config.FRONTEND_URL}/auth/reset-password?token=${plain}`;
  await sendPasswordResetEmail(normalizedEmail, resetLink);
  logger.info('Password reset email sent', { userId: user.id });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: record, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !record) throw new AppError(400, 'Invalid or expired reset token');
  if (record.used) throw new AppError(400, 'Reset token already used');
  if (new Date(record.expires_at) < new Date()) throw new AppError(400, 'Reset token expired');

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await supabaseAdmin
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', record.user_id);

  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('id', record.id);

  logger.info('Password reset successful', { userId: record.user_id });
}

export async function sendEmailOTP(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(404, 'User not found');
  if (user.is_email_verified) throw new AppError(409, 'Email already verified');

  const plain = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(plain).digest('hex');

  await redis.set(`otp:${user.id}`, JSON.stringify({ hash: otpHash }), 'EX', 900);

  await sendOTPEmail(normalizedEmail, plain);
  logger.info('OTP sent via Redis', { userId: user.id });
}

export async function verifyEmailOTP(email: string, otp: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, is_email_verified, is_admin')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(404, 'User not found');
  if (user.is_email_verified) throw new AppError(409, 'Email already verified');

  const stored = await redis.get(`otp:${user.id}`);
  if (!stored) throw new AppError(400, 'OTP expired or not found');

  const { hash } = JSON.parse(stored) as { hash: string };
  if (hash !== otpHash) throw new AppError(400, 'Invalid OTP');

  await redis.del(`otp:${user.id}`);

  await supabaseAdmin
    .from('users')
    .update({ is_email_verified: true })
    .eq('id', user.id);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', user.id)
    .single();

  const token = signToken({
    userId: user.id,
    email: normalizedEmail,
    isAdmin: user.is_admin,
    campusId: profile?.campus_id ?? null,
  });

  logger.info('Email verified', { userId: user.id });

  return { token, onboarding_completed: profile?.onboarding_completed ?? false };
}

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

export async function googleAuth(idToken: string) {
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new AppError(401, 'Invalid Google token');
  }

  const payload = ticket.getPayload();
  if (!payload?.email) throw new AppError(401, 'Google token missing email');
  if (!payload.email_verified) throw new AppError(401, 'Google email not verified');

  const email = payload.email.toLowerCase();
  const domain = extractDomain(email);

  if (domain === 'gmail.com') throw new AppError(403, 'Only college email IDs are allowed');

  await validateDomain(domain);

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, is_admin')
    .eq('email', email)
    .single();

  let userId: string;
  let isAdmin = false;

  if (existing) {
    userId = existing.id;
    isAdmin = existing.is_admin;
  } else {
    const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({ email, password_hash: randomPasswordHash, is_email_verified: true })
      .select('id')
      .single();

    if (error || !newUser) throw new AppError(500, 'Failed to create user');

    await supabaseAdmin.from('profiles').insert({ id: newUser.id });
    userId = newUser.id;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', userId)
    .single();

  const token = signToken({
    userId,
    email,
    isAdmin,
    campusId: profile?.campus_id ?? null,
  });

  logger.info('Google auth successful', { userId });

  return {
    token,
    onboarding_completed: profile?.onboarding_completed ?? false,
  };
}

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const normalized = username.toLowerCase().trim();
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .single();
  return { available: !data };
}
