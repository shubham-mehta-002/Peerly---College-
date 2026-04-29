import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: config.BREVO_SMTP_USER,
    pass: config.BREVO_SMTP_KEY,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
} as any);

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Peerly" <${config.BREVO_SMTP_USER}>`,
      to,
      subject: 'Reset your Peerly password',
      html: `
        <p>You requested a password reset for your Peerly account.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      `,
    });
  } catch (err) {
    logger.error('Failed to send password reset email', { to, err });
    throw new Error('Email delivery failed');
  }
}

export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Peerly" <${config.BREVO_SMTP_USER}>`,
      to,
      subject: 'Verify your Peerly email',
      html: `
        <p>Your Peerly verification code is:</p>
        <h2>${otp}</h2>
        <p>This code expires in 15 minutes.</p>
      `,
    });
  } catch (err: any) {
    logger.error('Failed to send OTP email', { to, message: err?.message });
    throw new Error(`Email delivery failed: ${err?.message}`);
  }
}
