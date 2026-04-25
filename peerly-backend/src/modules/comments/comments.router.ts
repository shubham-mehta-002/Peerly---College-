import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { addCommentSchema } from './comments.types';
import * as controller from './comments.controller';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', controller.getComments);
router.post('/', validateBody(addCommentSchema), controller.addComment);
router.delete('/:commentId', controller.deleteComment);

export default router;
