import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getProfileHandler, getPublicProfileHandler, updateProfileHandler } from './profile.controller';

const router = Router();
router.use(authenticate);
router.get('/', getProfileHandler);
router.get('/:username', getPublicProfileHandler);
router.patch('/', updateProfileHandler);

export default router;
