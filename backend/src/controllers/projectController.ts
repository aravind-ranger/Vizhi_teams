import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             u.name as creator_name,
             (SELECT count(*) FROM tasks WHERE project_id = p.id) as total_tasks,
             (SELECT count(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  const { name, description, start_date, end_date } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, start_date, end_date, created_by) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description, start_date, end_date, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
