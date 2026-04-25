import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { createPostSchema, voteSchema } from './posts.types';
import * as controller from './posts.controller';

const router = Router();
router.use(authenticate);

router.get('/campus', controller.getCampusFeed);
router.get('/global', controller.getGlobalFeed);
router.get('/:id', controller.getPost);
router.post('/', validateBody(createPostSchema), controller.createPost);
router.delete('/:id', controller.deletePost);
router.post('/:id/vote', validateBody(voteSchema), controller.vote);

export default router;
