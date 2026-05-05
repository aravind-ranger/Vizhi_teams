import express from 'express';
import { getLeaves, applyLeave, updateLeaveStatus } from '../controllers/leaveController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/', getLeaves);
router.post('/', applyLeave);
router.patch('/:id/status', authorize(['admin', 'manager']), updateLeaveStatus);

export default router;
