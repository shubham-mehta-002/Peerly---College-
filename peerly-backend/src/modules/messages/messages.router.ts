import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getHistoryHandler } from './messages.controller';

const router = Router({ mergeParams: true });
router.use(authenticate);
router.get('/', getHistoryHandler);

export default router;
