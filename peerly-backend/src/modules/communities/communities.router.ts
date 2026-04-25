import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  listHandler, getHandler, createHandler, updateHandler,
  deleteHandler, joinHandler, leaveHandler, kickHandler, updateRoleHandler,
  transferOwnershipHandler, getMembersHandler,
} from './communities.controller';

const router = Router();
router.use(authenticate);

router.get('/', listHandler);
router.post('/', createHandler);
router.get('/:id', getHandler);
router.patch('/:id', updateHandler);
router.delete('/:id', deleteHandler);

router.get('/:id/members', getMembersHandler);
router.post('/:id/join', joinHandler);
router.post('/:id/leave', leaveHandler);
router.post('/:id/transfer-ownership', transferOwnershipHandler);
router.delete('/:id/members/:userId', kickHandler);
router.patch('/:id/members/:userId', updateRoleHandler);

export default router;
