import { Request, Response } from 'express';
import pool from '../db';

export const getTasks = async (req: any, res: Response) => {
  try {
    const { role, id: userId } = req.user;
    let query = `
      SELECT 
        t.*, 
        p.name as project_name, 
        u.name as assignee_name, 
        u2.name as creator_name,
        (SELECT COALESCE(SUM(duration_minutes), 0) FROM task_sessions WHERE task_id = t.id) as total_minutes_logged,
        (SELECT id FROM task_sessions WHERE task_id = t.id AND user_id = $1 AND end_time IS NULL LIMIT 1) as active_session_id,
        (SELECT start_time FROM task_sessions WHERE task_id = t.id AND user_id = $1 AND end_time IS NULL LIMIT 1) as active_session_start
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
    `;

    const params: any[] = [userId];
    if (role === 'employee') {
      query += ` WHERE t.assigned_to = $1`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const tasks = await pool.query(query, params);
    res.json(tasks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createTask = async (req: any, res: Response) => {
  const { project_id, title, description, assigned_to, priority, due_date, estimated_hours } = req.body;
  const created_by = req.user.id;

  try {
    // Generate Unique Task Code
    // Format: AssigneeInitials + ProjectFirstChar + Random3Digits
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [assigned_to]);
    const projRes = await pool.query('SELECT name FROM projects WHERE id = $1', [project_id]);
    
    const userName = userRes.rows[0]?.name || 'Unknown';
    const projName = projRes.rows[0]?.name || 'Project';
    
    const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    const projChar = projName[0].toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const task_code = `${userInitials}${projChar}${randomNum}`;

    const newTask = await pool.query(`
      INSERT INTO tasks (project_id, title, description, assigned_to, assigned_by, priority, due_date, estimated_hours, task_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [project_id, title, description, assigned_to, created_by, priority, due_date, estimated_hours, task_code]);

    res.status(200).json(newTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateTaskStatus = async (req: any, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updatedTask = await pool.query(`
      UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *
    `, [status, id]);

    if (updatedTask.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(updatedTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const startTaskSession = async (req: any, res: Response) => {
  const { id: taskId } = req.params;
  const userId = req.user.id;

  try {
    const activeSession = await pool.query(
      'SELECT id FROM task_sessions WHERE user_id = $1 AND end_time IS NULL',
      [userId]
    );

    if (activeSession.rows.length > 0) {
      return res.status(400).json({ message: 'You already have an active task session. Stop it first.' });
    }

    const session = await pool.query(`
      INSERT INTO task_sessions (task_id, user_id, start_time)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING *
    `, [taskId, userId]);

    await pool.query(
      "UPDATE tasks SET status = 'in_progress' WHERE id = $1 AND status = 'todo'",
      [taskId]
    );

    res.status(201).json(session.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const stopTaskSession = async (req: any, res: Response) => {
  const { id: taskId } = req.params;
  const userId = req.user.id;

  try {
    const sessionResult = await pool.query(`
      UPDATE task_sessions 
      SET end_time = CURRENT_TIMESTAMP,
          duration_minutes = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))/60)
      WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL
      RETURNING *
    `, [taskId, userId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'No active session found for this task' });
    }

    res.json(sessionResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
