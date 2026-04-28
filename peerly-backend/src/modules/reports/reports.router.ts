import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { reportPostHandler } from './reports.controller';

const router = Router();
router.use(authenticate);
router.post('/:id/report', reportPostHandler);

export default router;
