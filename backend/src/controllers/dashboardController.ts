import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const date = new Date().toISOString().split('T')[0];

  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT count(*) FROM tasks WHERE assigned_to = $1) as total_tasks,
        (SELECT count(*) FROM tasks WHERE assigned_to = $1 AND status = 'in_progress') as in_progress,
        (SELECT count(*) FROM tasks WHERE assigned_to = $1 AND status = 'done' AND created_at::date = CURRENT_DATE) as completed_today,
        (SELECT COALESCE(SUM(duration_minutes), 0) FROM task_sessions WHERE user_id = $1 AND created_at::date = CURRENT_DATE) as minutes_today
    `, [userId]);

    const recentTasks = await pool.query(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.assigned_to = $1 
      ORDER BY t.created_at DESC 
      LIMIT 5
    `, [userId]);

    res.json({
      ...stats.rows[0],
      recentTasks: recentTasks.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
