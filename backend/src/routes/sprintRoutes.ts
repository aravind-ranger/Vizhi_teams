import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as sprintController from '../controllers/sprintController';

const router = express.Router();

router.use(authenticate);

router.get('/', sprintController.getSprints);
router.post('/', authorize(['admin', 'manager']), sprintController.createSprint);
router.patch('/:id/status', authorize(['admin', 'manager']), sprintController.updateSprintStatus);

export default router;