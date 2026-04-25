import { Router } from 'express';
import { validateBody } from '../../lib/validate';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './auth.controller';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendOTPSchema,
  verifyEmailSchema,
  googleAuthSchema,
} from './auth.types';

const router = Router();

// Existing
router.post('/register', validateBody(registerSchema), controller.register);
router.post('/login', validateBody(loginSchema), controller.login);
router.get('/me', authenticate, controller.me);

// Password reset
router.post('/forgot-password', validateBody(forgotPasswordSchema), controller.forgotPasswordHandler);
router.post('/reset-password', validateBody(resetPasswordSchema), controller.resetPasswordHandler);

// Email verification
router.post('/send-otp', validateBody(sendOTPSchema), controller.sendOTPHandler);
router.post('/verify-email', validateBody(verifyEmailSchema), controller.verifyEmailHandler);

// Google OAuth
router.post('/google', validateBody(googleAuthSchema), controller.googleAuthHandler);

// Username check
router.get('/check-username', controller.checkUsernameHandler);

// Domain whitelist check
router.get('/check-domain', controller.checkDomainHandler);

export default router;
