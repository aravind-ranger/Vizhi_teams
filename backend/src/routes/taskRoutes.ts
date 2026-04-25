import express from 'express';
import { getTasks, createTask, updateTaskStatus, startTaskSession, stopTaskSession } from '../controllers/taskController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/start', startTaskSession);
router.post('/:id/stop', stopTaskSession);

export default router;
