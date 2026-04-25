import { z } from 'zod';

const strongPassword = z.string()
  .min(8, 'At least 8 characters')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[0-9]/, 'Must include a number')
  .regex(/[^a-zA-Z0-9]/, 'Must include a special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: strongPassword,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: strongPassword,
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

export const sendOTPSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export type SendOTPBody = z.infer<typeof sendOTPSchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

export type GoogleAuthBody = z.infer<typeof googleAuthSchema>;
