import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateBody } from '../../lib/validate';
import {
  createCollegeSchema, updateCollegeSchema,
  createDomainSchema, updateDomainSchema,
  createCampusSchema, updateCampusSchema,
} from './admin.types';
import * as controller from './admin.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.post('/colleges', validateBody(createCollegeSchema), controller.createCollege);
router.get('/colleges', controller.listColleges);
router.patch('/colleges/:id', validateBody(updateCollegeSchema), controller.updateCollege);

router.get('/colleges/:id/domains', controller.listDomains);
router.post('/colleges/:id/domains', validateBody(createDomainSchema), controller.createDomain);
router.patch('/colleges/:id/domains/:domainId', validateBody(updateDomainSchema), controller.updateDomain);

router.post('/colleges/:id/campuses', validateBody(createCampusSchema), controller.createCampus);
router.get('/colleges/:id/campuses', controller.listCampuses);
router.patch('/colleges/:id/campuses/:campusId', validateBody(updateCampusSchema), controller.updateCampus);

export default router;
