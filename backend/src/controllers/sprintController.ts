import { Request, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

export const getSprints = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT s.*, p.name as project_name,
             (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id AND status = 'done') as completed_tasks
      FROM sprints s
      LEFT JOIN projects p ON s.project_id = p.id
      ORDER BY s.end_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSprint = async (req: AuthRequest, res: Response) => {
  const { project_id, name, start_date, end_date } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO sprints (project_id, name, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [project_id, name, start_date, end_date]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSprintStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(`
      UPDATE sprints SET status = $1 WHERE id = $2 RETURNING *
    `, [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
